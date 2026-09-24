const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const Product = require('../models/Product');

/**
 * Helper: Safely delete an image file from the uploads directory
 */
const unlinkFileSafely = (imagePath) => {
  if (!imagePath || typeof imagePath !== 'string') return;
  try {
    const normalized = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
    const fullPath = path.join(__dirname, '../../', normalized);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (err) {
    console.error(`[ProductController] Failed to unlink file ${imagePath}:`, err.message);
  }
};

/**
 * Helper: Clean up newly uploaded files if request validation fails
 */
const cleanupUploadedFiles = (files) => {
  if (!files || !Array.isArray(files)) return;
  files.forEach((file) => {
    try {
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    } catch (err) {
      console.error(`[ProductController] Failed to clean up temp file ${file.path}:`, err.message);
    }
  });
};

/**
 * Get all products with optional search, sorting, and stock filtering
 * GET /api/admin/products or GET /api/products
 */
const getAllProducts = async (req, res) => {
  try {
    const { search, sort, inStock } = req.query;
    const filter = {};

    if (search && typeof search === 'string' && search.trim()) {
      filter.title = { $regex: search.trim(), $options: 'i' };
    }

    if (inStock === 'true' || inStock === true) {
      filter.quantity = { $gt: 0 };
    }

    let sortOption = { createdAt: -1 };
    if (sort === 'price-asc') {
      sortOption = { price: 1 };
    } else if (sort === 'price-desc') {
      sortOption = { price: -1 };
    } else if (sort === 'newest') {
      sortOption = { createdAt: -1 };
    } else if (sort === 'title-asc') {
      sortOption = { title: 1 };
    }

    const products = await Product.find(filter).sort(sortOption);

    return res.status(200).json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    console.error('[ProductController - getAllProducts Error]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve products. Please try again later.',
    });
  }
};

/**
 * Get single product by ID
 * GET /api/admin/products/:id
 */
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format',
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    return res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    console.error('[ProductController - getProductById Error]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve product details',
    });
  }
};

/**
 * Create a new product with multiple images
 * POST /api/admin/products
 */
const createProduct = async (req, res) => {
  try {
    const { title, price, quantity } = req.body;

    // 1. Validate Title
    if (!title || typeof title !== 'string' || !title.trim()) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({
        success: false,
        message: 'Product title is required and cannot be empty',
      });
    }

    // 2. Validate Price
    if (price === undefined || price === null || price === '' || isNaN(Number(price))) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({
        success: false,
        message: 'Valid numeric product price is required',
      });
    }

    const numPrice = Number(price);
    if (numPrice < 0) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({
        success: false,
        message: 'Product price must not be negative',
      });
    }

    // 3. Validate Quantity
    if (quantity === undefined || quantity === null || quantity === '' || isNaN(Number(quantity))) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({
        success: false,
        message: 'Valid numeric product quantity is required',
      });
    }

    const numQuantity = Number(quantity);
    if (numQuantity < 0 || !Number.isInteger(numQuantity)) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({
        success: false,
        message: 'Product quantity must be a non-negative integer',
      });
    }

    // 4. Extract uploaded image paths
    const imagePaths = req.files && Array.isArray(req.files)
      ? req.files.map((file) => `/uploads/products/${file.filename}`)
      : [];

    // 5. Create Product Document
    const newProduct = await Product.create({
      title: title.trim(),
      price: numPrice,
      quantity: numQuantity,
      images: imagePaths,
    });

    return res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product: newProduct,
    });
  } catch (error) {
    cleanupUploadedFiles(req.files);
    console.error('[ProductController - createProduct Error]:', error.message);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while creating product',
    });
  }
};

/**
 * Update an existing product and its images
 * PUT /api/admin/products/:id
 */
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, price, quantity, existingImages } = req.body;

    // 1. Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format',
      });
    }

    // 2. Find existing product
    const product = await Product.findById(id);
    if (!product) {
      cleanupUploadedFiles(req.files);
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // 3. Validate Title (if provided)
    if (title !== undefined) {
      if (!title || typeof title !== 'string' || !title.trim()) {
        cleanupUploadedFiles(req.files);
        return res.status(400).json({
          success: false,
          message: 'Product title cannot be empty',
        });
      }
      product.title = title.trim();
    }

    // 4. Validate Price (if provided)
    if (price !== undefined) {
      if (price === '' || isNaN(Number(price))) {
        cleanupUploadedFiles(req.files);
        return res.status(400).json({
          success: false,
          message: 'Product price must be a valid number',
        });
      }
      const numPrice = Number(price);
      if (numPrice < 0) {
        cleanupUploadedFiles(req.files);
        return res.status(400).json({
          success: false,
          message: 'Product price must not be negative',
        });
      }
      product.price = numPrice;
    }

    // 5. Validate Quantity (if provided)
    if (quantity !== undefined) {
      if (quantity === '' || isNaN(Number(quantity))) {
        cleanupUploadedFiles(req.files);
        return res.status(400).json({
          success: false,
          message: 'Product quantity must be a valid number',
        });
      }
      const numQuantity = Number(quantity);
      if (numQuantity < 0 || !Number.isInteger(numQuantity)) {
        cleanupUploadedFiles(req.files);
        return res.status(400).json({
          success: false,
          message: 'Product quantity must be a non-negative integer',
        });
      }
      product.quantity = numQuantity;
    }

    // 6. Handle Image Updates
    const newImagePaths = req.files && Array.isArray(req.files)
      ? req.files.map((file) => `/uploads/products/${file.filename}`)
      : [];

    let retainedImages = product.images;
    if (existingImages !== undefined) {
      if (Array.isArray(existingImages)) {
        retainedImages = existingImages.filter((img) => typeof img === 'string' && product.images.includes(img));
      } else if (typeof existingImages === 'string') {
        try {
          const parsed = JSON.parse(existingImages);
          if (Array.isArray(parsed)) {
            retainedImages = parsed.filter((img) => typeof img === 'string' && product.images.includes(img));
          } else if (product.images.includes(existingImages)) {
            retainedImages = [existingImages];
          } else {
            retainedImages = [];
          }
        } catch {
          retainedImages = product.images.includes(existingImages) ? [existingImages] : [];
        }
      }

      // Safely unlink removed images from disk
      const removedImages = product.images.filter((img) => !retainedImages.includes(img));
      removedImages.forEach(unlinkFileSafely);
    }

    // Combine retained images with newly uploaded ones
    product.images = [...retainedImages, ...newImagePaths];

    await product.save();

    return res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      product,
    });
  } catch (error) {
    cleanupUploadedFiles(req.files);
    console.error('[ProductController - updateProduct Error]:', error.message);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while updating product',
    });
  }
};

/**
 * Delete a product and its associated image files
 * DELETE /api/admin/products/:id
 */
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format',
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Unlink all associated images from disk
    if (product.images && Array.isArray(product.images)) {
      product.images.forEach(unlinkFileSafely);
    }

    await Product.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: `Product '${product.title}' deleted successfully`,
    });
  } catch (error) {
    console.error('[ProductController - deleteProduct Error]:', error.message);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while deleting product',
    });
  }
};

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};
