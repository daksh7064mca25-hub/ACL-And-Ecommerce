const express = require('express');
const router = express.Router();
const { optionalAuth, authenticateToken } = require('../middleware/authMiddleware');
const {
  createCheckoutSession,
  getOrderById,
  getOrderBySessionId,
  getMyOrders,
} = require('../controllers/orderController');
const {
  createRefundRequest,
  getOrderRefundRequest,
  getMyRefundRequests,
} = require('../controllers/refundController');

// Create Stripe Checkout Session (Supports Guest or Logged-in Customer)
// POST /api/orders/checkout
router.post('/checkout', optionalAuth, createCheckoutSession);

// Get Customer Order History (Protected)
// GET /api/orders/my-orders
router.get('/my-orders', authenticateToken, getMyOrders);

// Get All Refund Requests for Logged-in Customer (Protected)
// GET /api/orders/my-refund-requests
router.get('/my-refund-requests', authenticateToken, getMyRefundRequests);

// Get Order by Stripe Session ID (for post-checkout confirmation)
// GET /api/orders/session/:sessionId
router.get('/session/:sessionId', getOrderBySessionId);

// Get Refund Request for a specific Order (Protected)
// GET /api/orders/:orderId/refund-request
router.get('/:orderId/refund-request', authenticateToken, getOrderRefundRequest);

// Create Refund Request for an Order (Protected)
// POST /api/orders/:orderId/refund-request
router.post('/:orderId/refund-request', authenticateToken, createRefundRequest);

// Get Order Details by Order ID
// GET /api/orders/:id
router.get('/:id', getOrderById);

module.exports = router;

