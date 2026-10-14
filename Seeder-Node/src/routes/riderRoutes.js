const express = require('express');
const router = express.Router();
const { authenticateToken, requireRider } = require('../middleware/authMiddleware');
const {
  getAssignedDeliveries,
  getActiveDelivery,
  getDeliveryById,
  updateDeliveryStatus,
} = require('../controllers/riderController');

// All rider routes require JWT authentication and Rider role (or Admin)
router.use(authenticateToken, requireRider);

// Get active delivery for the rider
// GET /api/rider/deliveries/active
router.get('/deliveries/active', getActiveDelivery);

// Get all deliveries assigned to rider
// GET /api/rider/deliveries
router.get('/deliveries', getAssignedDeliveries);

// Get single delivery details
// GET /api/rider/deliveries/:id
router.get('/deliveries/:id', getDeliveryById);

// Update delivery status (accept, pickup, start on the way, deliver, cancel)
// PUT /api/rider/deliveries/:id/status
router.put('/deliveries/:id/status', updateDeliveryStatus);

module.exports = router;
