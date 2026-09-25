const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { getStripe } = require('../config/stripe');

/**
 * Create Stripe Checkout Session & Pending Order
 * POST /api/orders/checkout
 */
const createCheckoutSession = async (req, res) => {
  let order = null;
  try {
    const { items, customerEmail, customerName } = req.body;

    // 1. Validate items payload
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty. Please provide at least one item to checkout.',
      });
    }

    // 2. Validate format of each item
    for (const item of items) {
      if (!item.productId || !mongoose.Types.ObjectId.isValid(item.productId)) {
        return res.status(400).json({
          success: false,
          message: `Invalid product ID: ${item.productId}`,
        });
      }
      const qty = Number(item.quantity);
      if (!Number.isInteger(qty) || qty <= 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid quantity for product ${item.productId}. Quantity must be a positive whole number.`,
        });
      }
    }

    // 3. Fetch real products from MongoDB
    const productIds = items.map((i) => i.productId);
    const dbProducts = await Product.find({ _id: { $in: productIds } });
    const productMap = new Map();
    dbProducts.forEach((p) => productMap.set(p._id.toString(), p));

    // 4. Verify stock and calculate real server-side totals
    const orderItems = [];
    let calculatedTotal = 0;

    for (const item of items) {
      const dbProduct = productMap.get(item.productId.toString());
      if (!dbProduct) {
        return res.status(404).json({
          success: false,
          message: `Product not found or has been removed from store. (ID: ${item.productId})`,
        });
      }

      const requestedQty = Number(item.quantity);
      if (dbProduct.quantity < requestedQty) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${dbProduct.title}". Only ${dbProduct.quantity} item(s) available in inventory.`,
        });
      }

      const realPrice = Number(dbProduct.price);
      if (isNaN(realPrice) || realPrice < 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid price configured for product "${dbProduct.title}".`,
        });
      }

      const primaryImage =
        dbProduct.images && dbProduct.images.length > 0 ? dbProduct.images[0] : '';

      orderItems.push({
        product: dbProduct._id,
        title: dbProduct.title,
        priceAtPurchase: realPrice,
        quantity: requestedQty,
        image: primaryImage,
      });

      calculatedTotal += realPrice * requestedQty;
    }

    // 5. Determine customer email (from authenticated user or checkout input)
    let email = customerEmail;
    let name = customerName;
    let customerUserId = null;

    if (req.user) {
      customerUserId = req.user._id;
      if (!email) email = req.user.email;
      if (!name) name = req.user.name;
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      email = 'customer@example.com';
    }

    const currency = (process.env.STRIPE_CURRENCY || 'inr').toLowerCase();

    // 6. Create Pending Order in MongoDB
    order = await Order.create({
      customer: customerUserId,
      customerEmail: email.toLowerCase().trim(),
      customerName: name ? name.trim() : '',
      items: orderItems,
      totalAmount: Math.round(calculatedTotal * 100) / 100,
      currency,
      paymentStatus: 'pending',
      orderStatus: 'pending',
    });

    const customerFrontendUrl =
      process.env.CUSTOMER_FRONTEND_URL || 'http://localhost:3001';
    const backendUrl = process.env.BASE_URL || 'http://localhost:5000';

    // 7. Live Stripe Checkout Session Creation
    const stripe = getStripe();
    const line_items = orderItems.map((item) => {
      let imageUrl = null;
      if (item.image) {
        imageUrl = item.image.startsWith('http')
          ? item.image
          : `${backendUrl}${item.image.startsWith('/') ? '' : '/'}${item.image}`;
      }

      // Stripe requires images to be publicly accessible HTTPS URLs; avoid passing localhost URLs
      const isPublicHttps = Boolean(imageUrl && imageUrl.startsWith('https://'));

      return {
        price_data: {
          currency,
          product_data: {
            name: item.title,
            images: isPublicHttps ? [imageUrl] : [],
            metadata: {
              productId: item.product.toString(),
            },
          },
          unit_amount: Math.round(item.priceAtPurchase * 100), // Stripe expects unit amount in cents/paise
        },
        quantity: item.quantity,
      };
    });

    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded_page',
      mode: 'payment',
      billing_address_collection: 'required',
      line_items,
      customer_email: order.customerEmail,
      client_reference_id: order._id.toString(),
      metadata: {
        orderId: order._id.toString(),
      },
      return_url: `${customerFrontendUrl}/success?session_id={CHECKOUT_SESSION_ID}&order_id=${order._id}`,
    });

    // Attach Stripe Checkout Session ID to Order
    order.stripeCheckoutSessionId = session.id;
    await order.save();

    console.log(`[Checkout] Created Stripe Embedded Checkout session ${session.id} for Order ${order._id}`);

    return res.status(200).json({
      success: true,
      message: 'Embedded checkout session created successfully',
      clientSecret: session.client_secret,
      url: session.url,
      sessionId: session.id,
      orderId: order._id,
      totalAmount: order.totalAmount,
    });
  } catch (error) {
    console.error('[OrderController - createCheckoutSession Error]:', error);

    let clientMessage = error.message || 'Failed to create checkout session. Please try again.';
    if (error.type === 'StripeAuthenticationError' || (error.message && error.message.includes('API Key'))) {
      clientMessage = 'Stripe payment gateway is not configured with a valid test key. Please set a valid STRIPE_SECRET_KEY in Seeder-Node/.env file.';
    }

    // Clean up draft order if it failed before Stripe session could be created
    if (order && order._id && !order.stripeCheckoutSessionId) {
      try {
        await Order.findByIdAndDelete(order._id);
      } catch (cleanupErr) {
        console.error('[OrderController] Failed to cleanup failed draft order:', cleanupErr.message);
      }
    }

    return res.status(500).json({
      success: false,
      message: clientMessage,
    });
  }
};

/**
 * Get Order by ID
 * GET /api/orders/:id
 */
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format',
      });
    }

    const order = await Order.findById(id).populate('items.product', 'title images quantity');
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    return res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    console.error('[OrderController - getOrderById Error]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve order details',
    });
  }
};

/**
 * Get Order by Stripe Session ID
 * GET /api/orders/session/:sessionId
 */
const getOrderBySessionId = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Stripe session ID is required',
      });
    }

    const order = await Order.findOne({ stripeCheckoutSessionId: sessionId }).populate(
      'items.product',
      'title images quantity'
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found for the provided Stripe session ID',
      });
    }

    return res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    console.error('[OrderController - getOrderBySessionId Error]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve order by session ID',
    });
  }
};

/**
 * Get Logged-in Customer Orders
 * GET /api/orders/my-orders (Protected)
 */
const getMyOrders = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const orders = await Order.find({ customer: req.user._id }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    console.error('[OrderController - getMyOrders Error]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve customer order history',
    });
  }
};

/**
 * Get All Orders for Admin Panel
 * GET /api/admin/orders (Protected Admin)
 */
const getAllOrdersAdmin = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('customer', 'name email')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    console.error('[OrderController - getAllOrdersAdmin Error]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve orders list',
    });
  }
};

module.exports = {
  createCheckoutSession,
  getOrderById,
  getOrderBySessionId,
  getMyOrders,
  getAllOrdersAdmin,
};
