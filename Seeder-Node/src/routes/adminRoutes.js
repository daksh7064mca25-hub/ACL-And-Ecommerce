const express = require('express');
const router = express.Router();
const { authenticateToken, requirePermission, requireAdmin } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
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
const {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} = require('../controllers/productController');

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

// Products Module APIs
// View All Products (ACL: products:read)
router.get('/products', authenticateToken, requirePermission('products:read'), getAllProducts);

// View Single Product (ACL: products:read)
router.get('/products/:id', authenticateToken, requirePermission('products:read'), getProductById);

// Create Product with Images (ACL: products:create)
router.post('/products', authenticateToken, requirePermission('products:create'), upload.array('images', 10), createProduct);

// Update Product & Images (ACL: products:update)
router.put('/products/:id', authenticateToken, requirePermission('products:update'), upload.array('images', 10), updateProduct);

const { getAllOrdersAdmin } = require('../controllers/orderController');

// Delete Product (ACL: products:delete)
router.delete('/products/:id', authenticateToken, requirePermission('products:delete'), deleteProduct);

// Orders Module API for Admin (ACL: dashboard:read or admin)
router.get('/orders', authenticateToken, requirePermission('dashboard:read'), getAllOrdersAdmin);

module.exports = router;

