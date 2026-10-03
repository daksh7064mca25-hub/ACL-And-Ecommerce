const express = require('express');
const router = express.Router();
const {
  getAllProducts,
  getProductById,
  getNearbyProducts,
} = require('../controllers/productController');

// Public Customer Product Catalog API
// GET /api/products
router.get('/', getAllProducts);

// Public Customer Location-Based Nearby Products Geospatial Search API
// GET /api/products/nearby?lat=...&lng=...&radius=...
router.get('/nearby', getNearbyProducts);

// Public Customer Single Product Details API
// GET /api/products/:id
router.get('/:id', getProductById);

module.exports = router;

