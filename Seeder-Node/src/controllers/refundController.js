const mongoose = require('mongoose');
const RefundRequest = require('../models/RefundRequest');
const Order = require('../models/Order');
const { getStripe } = require('../config/stripe');
const {
  sendRefundRequestReceivedEmail,
  sendRefundSuccessEmail,
  sendRefundRejectedEmail,
  sendRefundFailedEmail,
} = require('../services/emailService');

const VALID_REASONS = [
  'Product is incorrect',
  'Wrong product received',
  'Product damaged',
  'Product not as described',
  'Product missing',
  'Other',
];

/**
 * Customer: Create a Refund Request for an eligible Order
 * POST /api/orders/:orderId/refund-request
 */
const createRefundRequest = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason, description } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Order ID format.',
      });
    }

    if (!reason || !VALID_REASONS.includes(reason.trim())) {
      return res.status(400).json({
        success: false,
        message: `Please select a valid refund reason (${VALID_REASONS.join(', ')}).`,
      });
    }

    // 1. Locate Order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.',
      });
    }

    // 2. Verify Customer Ownership (never trust arbitrary input)
    const isOwner =
      (order.customer && order.customer.toString() === req.user._id.toString()) ||
      (order.customerEmail && order.customerEmail.toLowerCase() === req.user.email.toLowerCase());

    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have permission to request a refund for this order.',
      });
    }

    // 3. Verify Order Payment Status
    if (order.paymentStatus !== 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Only fully paid orders are eligible for refund requests.',
      });
    }

    // 4. Verify Order Refund Status
    if (order.refundStatus === 'refunded') {
      return res.status(409).json({
        success: false,
        message: 'This order has already been fully refunded.',
      });
    }

    // 5. Prevent Duplicate Active Refund Requests
    const existingActiveRequest = await RefundRequest.findOne({
      order: order._id,
      status: { $in: ['pending', 'processing', 'approved', 'refunded'] },
    });

    if (existingActiveRequest) {
      return res.status(409).json({
        success: false,
        message: `An active refund request (${existingActiveRequest.status.toUpperCase()}) already exists for this order.`,
        refundRequest: existingActiveRequest,
      });
    }

    // 6. Create RefundRequest record
    const refundRequest = await RefundRequest.create({
      order: order._id,
      customer: req.user._id,
      customerEmail: order.customerEmail,
      customerName: req.user.name || order.customerName || '',
      reason: reason.trim(),
      description: description ? description.trim() : '',
      requestedAmount: order.totalAmount,
      currency: order.currency || 'inr',
      status: 'pending',
    });

    // 7. Update Order refund status
    order.refundStatus = 'requested';
    order.refundRequestId = refundRequest._id;
    await order.save();

    console.log(`[Refund Controller] Created RefundRequest #${refundRequest._id} for Order #${order._id} by Customer ${req.user.email}`);

    // 8. Dispatch notification email safely
    try {
      await sendRefundRequestReceivedEmail({ order, refundRequest });
    } catch (mailErr) {
      console.error('[Refund Controller Error] Failed to send refund request confirmation email:', mailErr.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Refund request submitted successfully. Our team will review your request.',
      refundRequest,
    });
  } catch (error) {
    console.error('[RefundController - createRefundRequest Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit refund request. Please try again later.',
    });
  }
};

/**
 * Customer: Get Refund Request details for a specific order
 * GET /api/orders/:orderId/refund-request
 */
const getOrderRefundRequest = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Order ID format.',
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.',
      });
    }

    const isOwner =
      (order.customer && order.customer.toString() === req.user._id.toString()) ||
      (order.customerEmail && order.customerEmail.toLowerCase() === req.user.email.toLowerCase()) ||
      (req.user.role && req.user.role.name === 'Admin');

    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Access denied.',
      });
    }

    const refundRequest = await RefundRequest.findOne({ order: order._id }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      refundRequest,
    });
  } catch (error) {
    console.error('[RefundController - getOrderRefundRequest Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve refund request details.',
    });
  }
};

/**
 * Customer: Get all Refund Requests created by the logged-in customer
 * GET /api/orders/my-refund-requests
 */
const getMyRefundRequests = async (req, res) => {
  try {
    const refundRequests = await RefundRequest.find({ customer: req.user._id })
      .populate('order', 'items totalAmount paymentStatus refundStatus createdAt')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: refundRequests.length,
      refundRequests,
    });
  } catch (error) {
    console.error('[RefundController - getMyRefundRequests Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve refund requests history.',
    });
  }
};

/**
 * Admin: Get all Refund Requests with filtering and search
 * GET /api/admin/refund-requests
 */
const getAllRefundRequestsAdmin = async (req, res) => {
  try {
    const { status, searchTerm } = req.query;

    const query = {};

    if (status && status !== 'all') {
      query.status = status.toLowerCase();
    }

    if (searchTerm && typeof searchTerm === 'string' && searchTerm.trim() !== '') {
      const term = searchTerm.trim();
      const isObjectId = mongoose.Types.ObjectId.isValid(term);

      const orConditions = [
        { customerEmail: { $regex: term, $options: 'i' } },
        { customerName: { $regex: term, $options: 'i' } },
        { reason: { $regex: term, $options: 'i' } },
      ];

      if (isObjectId) {
        orConditions.push({ _id: new mongoose.Types.ObjectId(term) });
        orConditions.push({ order: new mongoose.Types.ObjectId(term) });
      }

      query.$or = orConditions;
    }

    const refundRequests = await RefundRequest.find(query)
      .populate('order', 'items totalAmount currency paymentStatus refundStatus stripePaymentIntentId stripeCheckoutSessionId createdAt')
      .populate('customer', 'name email')
      .populate('processedBy', 'name email')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: refundRequests.length,
      refundRequests,
    });
  } catch (error) {
    console.error('[RefundController - getAllRefundRequestsAdmin Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve refund requests list.',
    });
  }
};

/**
 * Admin: Get Refund Request by ID
 * GET /api/admin/refund-requests/:id
 */
const getRefundRequestByIdAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Refund Request ID format.',
      });
    }

    const refundRequest = await RefundRequest.findById(id)
      .populate('order')
      .populate('customer', 'name email')
      .populate('processedBy', 'name email');

    if (!refundRequest) {
      return res.status(404).json({
        success: false,
        message: 'Refund request not found.',
      });
    }

    return res.status(200).json({
      success: true,
      refundRequest,
    });
  } catch (error) {
    console.error('[RefundController - getRefundRequestByIdAdmin Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve refund request details.',
    });
  }
};

/**
 * Admin: Approve & Execute Stripe Refund
 * POST /api/admin/refund-requests/:id/approve
 */
const approveRefundRequestAdmin = async (req, res) => {
  let refundRequest = null;
  let order = null;

  try {
    const { id } = req.params;
    const { adminNote } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Refund Request ID format.',
      });
    }

    // 1. Locate RefundRequest
    refundRequest = await RefundRequest.findById(id);
    if (!refundRequest) {
      return res.status(404).json({
        success: false,
        message: 'Refund request not found.',
      });
    }

    // 2. Check Idempotency / State Gate
    if (refundRequest.status === 'refunded') {
      return res.status(409).json({
        success: false,
        message: 'This refund request has already been approved and executed.',
        refundRequest,
      });
    }

    if (refundRequest.status !== 'pending' && refundRequest.status !== 'failed') {
      return res.status(409).json({
        success: false,
        message: `Cannot approve refund request currently in '${refundRequest.status}' status.`,
      });
    }

    // 3. Locate and Validate Associated Order
    order = await Order.findById(refundRequest.order);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Associated order not found.',
      });
    }

    if (order.paymentStatus !== 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Associated order is not marked as paid.',
      });
    }

    if (order.refundStatus === 'refunded') {
      return res.status(409).json({
        success: false,
        message: 'This order has already been marked as refunded in the system.',
      });
    }

    const stripe = getStripe();

    // 4. Resolve Stripe PaymentIntent ID
    let paymentIntentId = order.stripePaymentIntentId || refundRequest.stripePaymentIntentId;

    if (!paymentIntentId && order.stripeCheckoutSessionId) {
      try {
        const session = await stripe.checkout.sessions.retrieve(order.stripeCheckoutSessionId);
        if (session && session.payment_intent) {
          paymentIntentId = session.payment_intent;
          order.stripePaymentIntentId = paymentIntentId;
          await order.save();
        }
      } catch (sessErr) {
        console.warn(`[RefundController] Could not retrieve session ${order.stripeCheckoutSessionId}: ${sessErr.message}`);
      }
    }

    if (!paymentIntentId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot execute refund: Stripe PaymentIntent ID is missing for this order.',
      });
    }

    // 5. Mark RefundRequest as processing
    refundRequest.status = 'processing';
    if (adminNote) refundRequest.adminNote = adminNote.trim();
    refundRequest.processedBy = req.user._id;
    await refundRequest.save();

    order.refundStatus = 'processing';
    await order.save();

    console.log(`[Refund Controller] Initiating Stripe refund for PaymentIntent ${paymentIntentId} (Order #${order._id})...`);

    // 6. Call Official Stripe Refund API with Idempotency Key
    const idempotencyKey = `refund_${refundRequest._id.toString()}_${order._id.toString()}`;

    const refundParams = {
      reason: 'requested_by_customer',
      metadata: {
        orderId: order._id.toString(),
        refundRequestId: refundRequest._id.toString(),
        approvedByAdmin: req.user.email,
      },
    };

    if (paymentIntentId.startsWith('ch_')) {
      refundParams.charge = paymentIntentId;
    } else {
      refundParams.payment_intent = paymentIntentId;
    }

    const stripeRefund = await stripe.refunds.create(
      refundParams,
      { idempotencyKey }
    );

    console.log(`[Refund Controller] Stripe Refund Created: ${stripeRefund.id}, status: ${stripeRefund.status}, amount: ${stripeRefund.amount}`);

    // 7. Update RefundRequest & Order records upon successful Stripe execution
    const isSuccess = stripeRefund.status === 'succeeded' || stripeRefund.status === 'pending';

    refundRequest.status = isSuccess ? 'refunded' : stripeRefund.status;
    refundRequest.stripeRefundId = stripeRefund.id;
    refundRequest.stripeChargeId = stripeRefund.charge || null;
    refundRequest.approvedAmount = stripeRefund.amount ? stripeRefund.amount / 100 : order.totalAmount;
    refundRequest.processedAt = new Date();
    refundRequest.failureReason = null;
    await refundRequest.save();

    order.refundStatus = isSuccess ? 'refunded' : 'processing';
    order.refundedAmount = refundRequest.approvedAmount;
    order.stripeRefundId = stripeRefund.id;
    await order.save();

    // 8. Send "Refund Successful" email to customer
    try {
      await sendRefundSuccessEmail({ order, refundRequest });
    } catch (mailErr) {
      console.error('[Refund Controller Error] Failed to send refund success email:', mailErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Refund approved and executed successfully via Stripe.',
      refundRequest,
      order,
      stripeRefund,
    });
  } catch (error) {
    console.error('[RefundController - approveRefundRequestAdmin Error]:', error);

    // If Stripe API threw an error, update state cleanly
    if (refundRequest) {
      try {
        refundRequest.status = 'failed';
        refundRequest.failureReason = error.message;
        refundRequest.processedAt = new Date();
        await refundRequest.save();

        if (order) {
          order.refundStatus = 'failed';
          await order.save();

          try {
            await sendRefundFailedEmail({ order, refundRequest, failureReason: error.message });
          } catch (mErr) {
            console.error('[Refund Controller] Error sending refund failure email:', mErr.message);
          }
        }
      } catch (dbErr) {
        console.error('[Refund Controller Error] Failed to update failed refund state:', dbErr.message);
      }
    }

    const clientMsg = error.raw?.message || error.message || 'Stripe refund processing failed.';
    return res.status(500).json({
      success: false,
      message: `Refund execution failed: ${clientMsg}`,
    });
  }
};

/**
 * Admin: Reject Refund Request
 * POST /api/admin/refund-requests/:id/reject
 */
const rejectRefundRequestAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNote } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Refund Request ID format.',
      });
    }

    const refundRequest = await RefundRequest.findById(id);
    if (!refundRequest) {
      return res.status(404).json({
        success: false,
        message: 'Refund request not found.',
      });
    }

    if (refundRequest.status === 'refunded') {
      return res.status(409).json({
        success: false,
        message: 'Cannot reject a refund request that has already been refunded.',
      });
    }

    if (refundRequest.status === 'rejected') {
      return res.status(409).json({
        success: false,
        message: 'This refund request is already rejected.',
      });
    }

    const order = await Order.findById(refundRequest.order);

    // Update RefundRequest
    refundRequest.status = 'rejected';
    refundRequest.adminNote = adminNote ? adminNote.trim() : 'Does not meet refund policy criteria.';
    refundRequest.processedAt = new Date();
    refundRequest.processedBy = req.user._id;
    await refundRequest.save();

    // Update Order
    if (order) {
      order.refundStatus = 'rejected';
      await order.save();

      // Dispatch rejection email to customer
      try {
        await sendRefundRejectedEmail({ order, refundRequest, adminNote: refundRequest.adminNote });
      } catch (mailErr) {
        console.error('[Refund Controller Error] Failed to send refund rejected email:', mailErr.message);
      }
    }

    console.log(`[Refund Controller] Admin #${req.user._id} rejected RefundRequest #${refundRequest._id}`);

    return res.status(200).json({
      success: true,
      message: 'Refund request has been rejected.',
      refundRequest,
    });
  } catch (error) {
    console.error('[RefundController - rejectRefundRequestAdmin Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reject refund request.',
    });
  }
};

module.exports = {
  createRefundRequest,
  getOrderRefundRequest,
  getMyRefundRequests,
  getAllRefundRequestsAdmin,
  getRefundRequestByIdAdmin,
  approveRefundRequestAdmin,
  rejectRefundRequestAdmin,
};
