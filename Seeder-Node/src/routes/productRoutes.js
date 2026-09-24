const express = require('express');
const router = express.Router();
const { getAllProducts, getProductById } = require('../controllers/productController');

// Public Customer Product Catalog API
// GET /api/products
router.get('/', getAllProducts);

// Public Customer Single Product Details API
// GET /api/products/:id
router.get('/:id', getProductById);

module.exports = router;
