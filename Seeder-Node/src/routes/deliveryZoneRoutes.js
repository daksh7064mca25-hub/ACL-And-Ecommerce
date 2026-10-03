const express = require('express');
const router = express.Router();
const {
  getDeliveryZones,
  getDeliveryZoneById,
  createDeliveryZone,
  updateDeliveryZone,
  deleteDeliveryZone,
  checkServiceability,
} = require('../controllers/deliveryZoneController');
const { authenticateToken, requirePermission } = require('../middleware/authMiddleware');

// Public endpoints for customers & serviceability verification
router.get('/check-serviceability', checkServiceability);
router.post('/check-serviceability', checkServiceability);
router.get('/', getDeliveryZones);
router.get('/:id', getDeliveryZoneById);

// Admin-managed CRUD endpoints with ACL permission enforcement
router.post('/', authenticateToken, requirePermission('delivery_zones:create'), createDeliveryZone);
router.put('/:id', authenticateToken, requirePermission('delivery_zones:update'), updateDeliveryZone);
router.delete('/:id', authenticateToken, requirePermission('delivery_zones:delete'), deleteDeliveryZone);

module.exports = router;
