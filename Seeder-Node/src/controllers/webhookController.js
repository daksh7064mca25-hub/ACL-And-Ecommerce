const Order = require('../models/Order');
const Product = require('../models/Product');
const { getStripe } = require('../config/stripe');

/**
 * Stripe Webhook Handler
 * POST /api/stripe/webhook
 */
const handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  // 1. Verify Stripe Webhook Signature
  try {
    const stripe = getStripe();
    const payload = req.rawBody || req.body;

    if (!webhookSecret || webhookSecret.trim() === '') {
      console.warn('[Stripe Webhook Warning]: STRIPE_WEBHOOK_SECRET is not configured in .env. Parsing event directly.');
      event = typeof payload === 'string' ? JSON.parse(payload) : payload;
    } else {
      if (!sig) {
        console.error('[Stripe Webhook Error]: Missing stripe-signature header');
        return res.status(400).json({ error: 'Missing stripe-signature header' });
      }
      event = stripe.webhooks.constructEvent(payload, sig, webhookSecret.trim());
    }
  } catch (err) {
    console.error(`[Stripe Webhook Error]: Signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`[Stripe Webhook] Received event: ${event.type} (ID: ${event.id})`);

  // 2. Handle specific Stripe event types
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const orderId = session.metadata?.orderId || session.client_reference_id;

        console.log(`[Stripe Webhook] Processing checkout.session.completed for Order ID: ${orderId}, Session ID: ${session.id}`);

        let order = null;
        if (orderId) {
          order = await Order.findById(orderId);
        }
        if (!order) {
          order = await Order.findOne({ stripeCheckoutSessionId: session.id });
        }

        if (!order) {
          console.warn(`[Stripe Webhook] No matching order found for session ${session.id}`);
          return res.status(200).json({ received: true, message: 'Order not found' });
        }

        // Idempotency check: avoid double deduction if webhook is received multiple times
        if (order.paymentStatus === 'paid') {
          console.log(`[Stripe Webhook] Order ${order._id} is already marked as paid. Skipping inventory decrement.`);
          return res.status(200).json({ received: true, message: 'Order already processed' });
        }

        // Atomically decrement product inventory in MongoDB
        for (const item of order.items) {
          try {
            const updatedProduct = await Product.findByIdAndUpdate(
              item.product,
              { $inc: { quantity: -item.quantity } },
              { new: true }
            );

            // Prevent negative inventory in case of race conditions
            if (updatedProduct && updatedProduct.quantity < 0) {
              await Product.findByIdAndUpdate(item.product, { quantity: 0 });
            }

            console.log(`[Stripe Webhook] Decremented stock for product '${item.title}' by ${item.quantity}. New stock: ${updatedProduct?.quantity}`);
          } catch (itemErr) {
            console.error(`[Stripe Webhook Error] Failed to decrement inventory for product ${item.product}:`, itemErr.message);
          }
        }

        // Update Order details & status
        order.paymentStatus = 'paid';
        order.orderStatus = 'confirmed';
        order.stripePaymentIntentId = session.payment_intent || order.stripePaymentIntentId;

        if (session.customer_details?.email) {
          order.customerEmail = session.customer_details.email.toLowerCase().trim();
        }
        if (session.customer_details?.name && !order.customerName) {
          order.customerName = session.customer_details.name.trim();
        }

        const shipping = session.shipping_details?.address || session.customer_details?.address;
        if (shipping) {
          order.shippingAddress = {
            line1: shipping.line1 || '',
            line2: shipping.line2 || '',
            city: shipping.city || '',
            state: shipping.state || '',
            postal_code: shipping.postal_code || '',
            country: shipping.country || '',
          };
        }

        await order.save();
        console.log(`[Stripe Webhook] Order ${order._id} marked as PAID & CONFIRMED.`);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        console.warn(`[Stripe Webhook] Payment failed for PaymentIntent: ${paymentIntent.id}`);

        const order = await Order.findOne({
          $or: [
            { stripePaymentIntentId: paymentIntent.id },
            { stripeCheckoutSessionId: paymentIntent.metadata?.sessionId },
          ],
        });

        if (order && order.paymentStatus !== 'paid') {
          order.paymentStatus = 'failed';
          order.orderStatus = 'cancelled';
          await order.save();
          console.log(`[Stripe Webhook] Order ${order._id} marked as FAILED.`);
        }
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (procErr) {
    console.error(`[Stripe Webhook Processing Error]:`, procErr);
    return res.status(500).json({ error: 'Internal server error while processing webhook' });
  }
};

module.exports = {
  handleStripeWebhook,
};
