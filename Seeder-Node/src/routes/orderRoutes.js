const express = require('express');
const router = express.Router();
const { optionalAuth, authenticateToken } = require('../middleware/authMiddleware');
const {
  createCheckoutSession,
  getOrderById,
  getOrderBySessionId,
  getMyOrders,
} = require('../controllers/orderController');

// Create Stripe Checkout Session (Supports Guest or Logged-in Customer)
// POST /api/orders/checkout
router.post('/checkout', optionalAuth, createCheckoutSession);

// Get Customer Order History (Protected)
// GET /api/orders/my-orders
router.get('/my-orders', authenticateToken, getMyOrders);

// Get Order by Stripe Session ID (for post-checkout confirmation)
// GET /api/orders/session/:sessionId
router.get('/session/:sessionId', getOrderBySessionId);

// Get Order Details by Order ID
// GET /api/orders/:id
router.get('/:id', getOrderById);

module.exports = router;
