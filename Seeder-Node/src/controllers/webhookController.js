const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const RefundRequest = require('../models/RefundRequest');
const { getStripe } = require('../config/stripe');
const {
  sendPaymentSuccessEmail,
  sendPaymentFailedEmail,
  sendRefundSuccessEmail,
  sendRefundFailedEmail,
} = require('../services/emailService');

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
        if (orderId && mongoose.Types.ObjectId.isValid(orderId)) {
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

          // If payment was marked paid previously but email failed or was pending, retry email safely
          if (!order.paymentSuccessEmailSent) {
            try {
              const emailResult = await sendPaymentSuccessEmail(order);
              if (emailResult.success) {
                order.paymentSuccessEmailSent = true;
                await order.save();
                console.log(`[Stripe Webhook] Payment Success email dispatched to ${order.customerEmail}`);
              } else {
                console.warn(`[Stripe Webhook Warning] Payment Success email could not be sent: ${emailResult.error}`);
              }
            } catch (mailErr) {
              console.error(`[Stripe Webhook Error] Failed to send payment success email:`, mailErr.message);
            }
          }

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
        } else if (session.customer_email) {
          order.customerEmail = session.customer_email.toLowerCase().trim();
        }
        if (session.customer_details?.name) {
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

        // Send Payment Success Email (Idempotent & Safe against SMTP failure)
        if (!order.paymentSuccessEmailSent) {
          try {
            const emailResult = await sendPaymentSuccessEmail(order);
            if (emailResult.success) {
              order.paymentSuccessEmailSent = true;
              await order.save();
              console.log(`[Stripe Webhook] Payment Success email dispatched to ${order.customerEmail}`);
            } else {
              console.warn(`[Stripe Webhook Warning] Payment Success email could not be sent: ${emailResult.error}`);
            }
          } catch (mailErr) {
            console.error(`[Stripe Webhook Error] Failed to dispatch payment success email:`, mailErr.message);
          }
        }

        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        console.warn(`[Stripe Webhook] Payment failed for PaymentIntent: ${paymentIntent.id}`);

        const orderId = paymentIntent.metadata?.orderId;
        let order = null;
        if (orderId && mongoose.Types.ObjectId.isValid(orderId)) {
          order = await Order.findById(orderId);
        }
        if (!order) {
          order = await Order.findOne({
            $or: [
              { stripePaymentIntentId: paymentIntent.id },
              { stripeCheckoutSessionId: paymentIntent.metadata?.sessionId },
              { stripeCheckoutSessionId: paymentIntent.metadata?.checkout_session_id },
            ],
          });
        }

        if (order) {
          if (order.paymentStatus === 'paid') {
            console.warn(`[Stripe Webhook] Received payment_intent.payment_failed for already paid Order ${order._id}. Skipping status update.`);
            break;
          }

          order.paymentStatus = 'failed';
          if (!order.stripePaymentIntentId && paymentIntent.id) {
            order.stripePaymentIntentId = paymentIntent.id;
          }
          await order.save();
          console.log(`[Stripe Webhook] Order ${order._id} marked as FAILED.`);

          // Extract safe failure reason
          const failureReason =
            paymentIntent.last_payment_error?.message ||
            paymentIntent.cancellation_reason ||
            'Your card was declined or the payment session expired.';

          // Send Payment Failed Email (Idempotent & Safe)
          if (!order.paymentFailedEmailSent) {
            try {
              const emailResult = await sendPaymentFailedEmail(order, failureReason);
              if (emailResult.success) {
                order.paymentFailedEmailSent = true;
                await order.save();
                console.log(`[Stripe Webhook] Payment Failed email dispatched to ${order.customerEmail}`);
              } else {
                console.warn(`[Stripe Webhook Warning] Payment Failed email could not be sent: ${emailResult.error}`);
              }
            } catch (mailErr) {
              console.error(`[Stripe Webhook Error] Failed to dispatch payment failed email:`, mailErr.message);
            }
          } else {
            console.log(`[Stripe Webhook] Payment failed email already sent for Order ${order._id}. Skipping duplicate.`);
          }
        } else {
          console.warn(`[Stripe Webhook] No matching order found for failed PaymentIntent ${paymentIntent.id}`);
        }
        break;
      }

      case 'checkout.session.async_payment_failed': {
        const session = event.data.object;
        console.warn(`[Stripe Webhook] Async payment failed for Session: ${session.id}`);

        const orderId = session.metadata?.orderId || session.client_reference_id;
        let order = null;
        if (orderId && mongoose.Types.ObjectId.isValid(orderId)) {
          order = await Order.findById(orderId);
        }
        if (!order) {
          order = await Order.findOne({ stripeCheckoutSessionId: session.id });
        }

        if (order && order.paymentStatus !== 'paid') {
          order.paymentStatus = 'failed';
          await order.save();
          console.log(`[Stripe Webhook] Order ${order._id} marked as FAILED via async_payment_failed.`);

          if (!order.paymentFailedEmailSent) {
            try {
              const emailResult = await sendPaymentFailedEmail(
                order,
                'The asynchronous payment method failed or expired.'
              );
              if (emailResult.success) {
                order.paymentFailedEmailSent = true;
                await order.save();
                console.log(`[Stripe Webhook] Payment Failed email dispatched to ${order.customerEmail}`);
              } else {
                console.warn(`[Stripe Webhook Warning] Payment Failed email could not be sent: ${emailResult.error}`);
              }
            } catch (mailErr) {
              console.error(`[Stripe Webhook Error] Failed to dispatch payment failed email:`, mailErr.message);
            }
          }
        }
        break;
      }

      case 'refund.created':
      case 'refund.updated': {
        const refund = event.data.object;
        console.log(`[Stripe Webhook] Handling ${event.type} for Refund ID: ${refund.id}, status: ${refund.status}`);

        const orderId = refund.metadata?.orderId;
        const refundRequestId = refund.metadata?.refundRequestId;

        let refundRequest = null;
        if (refundRequestId && mongoose.Types.ObjectId.isValid(refundRequestId)) {
          refundRequest = await RefundRequest.findById(refundRequestId);
        }
        if (!refundRequest) {
          refundRequest = await RefundRequest.findOne({
            $or: [
              { stripeRefundId: refund.id },
              ...(refund.payment_intent ? [{ stripePaymentIntentId: refund.payment_intent }] : []),
            ],
          });
        }

        let order = null;
        if (orderId && mongoose.Types.ObjectId.isValid(orderId)) {
          order = await Order.findById(orderId);
        } else if (refundRequest?.order) {
          order = await Order.findById(refundRequest.order);
        } else if (refund.payment_intent) {
          order = await Order.findOne({ stripePaymentIntentId: refund.payment_intent });
        }

        if (refund.status === 'succeeded') {
          const refundedAmount = refund.amount ? refund.amount / 100 : (refundRequest?.requestedAmount || 0);

          if (refundRequest && refundRequest.status !== 'refunded') {
            refundRequest.status = 'refunded';
            refundRequest.stripeRefundId = refund.id;
            refundRequest.stripePaymentIntentId = refund.payment_intent || refundRequest.stripePaymentIntentId;
            refundRequest.stripeChargeId = refund.charge || refundRequest.stripeChargeId;
            refundRequest.approvedAmount = refundedAmount;
            refundRequest.processedAt = new Date();
            await refundRequest.save();
            console.log(`[Stripe Webhook] RefundRequest ${refundRequest._id} marked as REFUNDED.`);
          }

          if (order && order.refundStatus !== 'refunded') {
            order.refundStatus = 'refunded';
            order.refundedAmount = refundedAmount;
            order.stripeRefundId = refund.id;
            if (refundRequest) order.refundRequestId = refundRequest._id;
            await order.save();
            console.log(`[Stripe Webhook] Order ${order._id} marked as REFUNDED.`);
          }
        } else if (refund.status === 'failed' || refund.status === 'canceled') {
          if (refundRequest && refundRequest.status !== 'failed') {
            refundRequest.status = 'failed';
            refundRequest.failureReason = refund.failure_reason || 'Refund failed via Stripe.';
            await refundRequest.save();
            console.log(`[Stripe Webhook] RefundRequest ${refundRequest._id} marked as FAILED.`);
          }
          if (order && order.refundStatus !== 'failed') {
            order.refundStatus = 'failed';
            await order.save();
          }
        }
        break;
      }

      case 'refund.failed': {
        const refund = event.data.object;
        console.warn(`[Stripe Webhook] Refund failed for Refund ID: ${refund.id}`);

        const refundRequestId = refund.metadata?.refundRequestId;
        let refundRequest = null;
        if (refundRequestId && mongoose.Types.ObjectId.isValid(refundRequestId)) {
          refundRequest = await RefundRequest.findById(refundRequestId);
        } else {
          refundRequest = await RefundRequest.findOne({ stripeRefundId: refund.id });
        }

        if (refundRequest) {
          refundRequest.status = 'failed';
          refundRequest.failureReason = refund.failure_reason || 'Refund processing failed in Stripe.';
          await refundRequest.save();
        }

        const orderId = refund.metadata?.orderId || refundRequest?.order;
        if (orderId) {
          await Order.findByIdAndUpdate(orderId, { refundStatus: 'failed' });
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object;
        console.log(`[Stripe Webhook] Handling charge.refunded for Charge ID: ${charge.id}, PaymentIntent: ${charge.payment_intent}`);

        const order = await Order.findOne({
          $or: [
            { stripePaymentIntentId: charge.payment_intent },
            { stripeCheckoutSessionId: charge.metadata?.sessionId },
          ],
        });

        if (order) {
          const refundedAmount = charge.amount_refunded ? charge.amount_refunded / 100 : order.totalAmount;
          order.refundStatus = charge.refunded ? 'refunded' : 'partial';
          order.refundedAmount = refundedAmount;
          await order.save();
          console.log(`[Stripe Webhook] Order ${order._id} refund status updated to ${order.refundStatus}`);
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
