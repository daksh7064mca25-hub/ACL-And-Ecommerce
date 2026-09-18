const express = require('express');
const router = express.Router();
const { authenticateToken, requirePermission, requireAdmin } = require('../middleware/authMiddleware');
const {
  getCustomers,
  sendPromotion,
  getMyPermissions,
  getAllRoles,
  getAllPermissions,
  createRole,
  updateRole,
  deleteRole,
} = require('../controllers/adminController');

// Test protected Admin route (ACL: dashboard:read)
router.get('/test', authenticateToken, requirePermission('dashboard:read'), (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to the Admin test route. Authorization successful!',
    data: {
      admin: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role.name,
      },
    },
  });
});

// Users Module: Get all registered Customer accounts (ACL: users:read)
router.get('/users', authenticateToken, requirePermission('users:read'), getCustomers);

// Promotions Module: Dispatch promotional email to selected Customers (ACL: promotions:send)
router.post('/promotions', authenticateToken, requirePermission('promotions:send'), sendPromotion);

// ACL Permissions API: Get logged-in user's role and assigned permissions
router.get('/me/permissions', authenticateToken, getMyPermissions);

// Roles & Permissions Module APIs
// View Roles (ACL: roles:read)
router.get('/roles', authenticateToken, requirePermission('roles:read'), getAllRoles);

// View Available Permissions (ACL: roles:read)
router.get('/permissions', authenticateToken, requirePermission('roles:read'), getAllPermissions);

// Create New Role (ACL: roles:create)
router.post('/roles', authenticateToken, requirePermission('roles:create'), createRole);

// Update Role & Permissions (ACL: roles:update)
router.put('/roles/:id', authenticateToken, requirePermission('roles:update'), updateRole);

// Delete Custom Role (ACL: roles:delete)
router.delete('/roles/:id', authenticateToken, requirePermission('roles:delete'), deleteRole);

module.exports = router;
