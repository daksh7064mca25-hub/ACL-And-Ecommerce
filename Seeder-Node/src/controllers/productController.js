const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const Product = require('../models/Product');
const DeliveryZone = require('../models/DeliveryZone');

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
 * Get all products with optional search, sorting, stock, and location-based delivery filtering
 * GET /api/admin/products or GET /api/products
 */
const getAllProducts = async (req, res) => {
  try {
    const { search, sort, inStock, lat, lng, onlyServiceable } = req.query;
    const filter = {};

    if (search && typeof search === 'string' && search.trim()) {
      filter.title = { $regex: search.trim(), $options: 'i' };
    }

    if (inStock === 'true' || inStock === true) {
      filter.quantity = { $gt: 0 };
    }

    let serviceability = null;
    let allowedProductIds = null;

    if (lat && lng) {
      const latitude = Number(lat);
      const longitude = Number(lng);

      if (!isNaN(latitude) && !isNaN(longitude)) {
        const matchingZones = await DeliveryZone.find({
          isActive: true,
          boundary: {
            $geoIntersects: {
              $geometry: {
                type: 'Point',
                coordinates: [longitude, latitude],
              },
            },
          },
        }).sort({ priority: -1, deliveryFee: 1 });

        if (matchingZones.length > 0) {
          const bestZone = matchingZones[0];
          serviceability = {
            serviceable: true,
            zone: {
              _id: bestZone._id,
              name: bestZone.name,
              code: bestZone.code,
              deliveryFee: bestZone.deliveryFee,
              minOrderAmount: bestZone.minOrderAmount,
              estimatedDeliveryTime: bestZone.estimatedDeliveryTime,
              coverageType: bestZone.coverageType,
            },
          };

          if (bestZone.coverageType === 'specific_products') {
            allowedProductIds = new Set(
              (bestZone.assignedProducts || []).map((id) => id.toString())
            );
            if (onlyServiceable === 'true') {
              filter._id = { $in: bestZone.assignedProducts || [] };
            }
          }
        } else {
          serviceability = {
            serviceable: false,
            message: 'Your selected location is outside our deliverable service area.',
          };
          if (onlyServiceable === 'true') {
            return res.status(200).json({
              success: true,
              count: 0,
              products: [],
              serviceability,
            });
          }
        }
      }
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

    const rawProducts = await Product.find(filter).sort(sortOption).lean();

    const products = rawProducts.map((p) => {
      let isDeliverable = true;
      if (serviceability && !serviceability.serviceable) {
        isDeliverable = false;
      } else if (allowedProductIds && !allowedProductIds.has(p._id.toString())) {
        isDeliverable = false;
      }
      return {
        ...p,
        isDeliverable,
      };
    });

    return res.status(200).json({
      success: true,
      count: products.length,
      serviceability,
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

    // 5. Parse Location (if provided via form-data or JSON)
    let productLocation = undefined;
    let locationInput = req.body.location;

    if (locationInput) {
      if (typeof locationInput === 'string') {
        try {
          locationInput = JSON.parse(locationInput);
        } catch {
          locationInput = null;
        }
      }
    }

    const latVal = req.body.latitude !== undefined ? req.body.latitude : locationInput?.latitude ?? (locationInput?.coordinates ? locationInput.coordinates[1] : undefined);
    const lngVal = req.body.longitude !== undefined ? req.body.longitude : locationInput?.longitude ?? (locationInput?.coordinates ? locationInput.coordinates[0] : undefined);

    if (latVal !== undefined && lngVal !== undefined && latVal !== '' && lngVal !== '' && !isNaN(Number(latVal)) && !isNaN(Number(lngVal))) {
      const latitude = Number(latVal);
      const longitude = Number(lngVal);

      if (latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180) {
        productLocation = {
          type: 'Point',
          coordinates: [longitude, latitude], // GeoJSON order: [longitude, latitude]
          formattedAddress: req.body.formattedAddress || locationInput?.formattedAddress || '',
          city: req.body.city || locationInput?.city || '',
          state: req.body.state || locationInput?.state || '',
          country: req.body.country || locationInput?.country || 'India',
          postalCode: req.body.postalCode || locationInput?.postalCode || '',
        };
      }
    }

    // 6. Create Product Document
    const productPayload = {
      title: title.trim(),
      price: numPrice,
      quantity: numQuantity,
      images: imagePaths,
    };

    if (productLocation) {
      productPayload.location = productLocation;
    }

    const newProduct = await Product.create(productPayload);

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

    // 7. Handle Location Update
    let locationInput = req.body.location;
    if (locationInput && typeof locationInput === 'string') {
      try {
        locationInput = JSON.parse(locationInput);
      } catch {
        locationInput = null;
      }
    }

    const latVal = req.body.latitude !== undefined ? req.body.latitude : locationInput?.latitude ?? (locationInput?.coordinates ? locationInput.coordinates[1] : undefined);
    const lngVal = req.body.longitude !== undefined ? req.body.longitude : locationInput?.longitude ?? (locationInput?.coordinates ? locationInput.coordinates[0] : undefined);

    if (latVal !== undefined && lngVal !== undefined && latVal !== '' && lngVal !== '' && !isNaN(Number(latVal)) && !isNaN(Number(lngVal))) {
      const latitude = Number(latVal);
      const longitude = Number(lngVal);

      if (latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180) {
        product.location = {
          type: 'Point',
          coordinates: [longitude, latitude],
          formattedAddress: req.body.formattedAddress || locationInput?.formattedAddress || product.location?.formattedAddress || '',
          city: req.body.city || locationInput?.city || product.location?.city || '',
          state: req.body.state || locationInput?.state || product.location?.state || '',
          country: req.body.country || locationInput?.country || product.location?.country || 'India',
          postalCode: req.body.postalCode || locationInput?.postalCode || product.location?.postalCode || '',
        };
      }
    }

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
 * Get nearby products using MongoDB geospatial $geoNear aggregation
 * GET /api/products/nearby
 */
const getNearbyProducts = async (req, res) => {
  try {
    const { lat, lng, radius = 25, search, inStock, limit = 50 } = req.query;

    // 1. Validate required origin coordinates
    if (lat === undefined || lng === undefined || lat === '' || lng === '') {
      return res.status(400).json({
        success: false,
        message: 'Latitude (lat) and Longitude (lng) query parameters are required for nearby product search.',
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const radiusKm = parseFloat(radius);

    if (isNaN(latitude) || latitude < -90 || latitude > 90) {
      return res.status(400).json({
        success: false,
        message: 'Invalid latitude value. Must be a number between -90 and 90.',
      });
    }

    if (isNaN(longitude) || longitude < -180 || longitude > 180) {
      return res.status(400).json({
        success: false,
        message: 'Invalid longitude value. Must be a number between -180 and 180.',
      });
    }

    if (isNaN(radiusKm) || radiusKm <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid radius value. Must be a positive number in kilometers.',
      });
    }

    // 2. Build additional match filters (search, inStock)
    const maxDistanceMeters = radiusKm * 1000;
    const matchQuery = {};

    if (search && typeof search === 'string' && search.trim()) {
      matchQuery.title = { $regex: search.trim(), $options: 'i' };
    }

    if (inStock === 'true' || inStock === true) {
      matchQuery.quantity = { $gt: 0 };
    }

    // 3. Execute $geoNear geospatial aggregation pipeline
    const pipeline = [
      {
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [longitude, latitude], // GeoJSON [longitude, latitude]
          },
          distanceField: 'distanceInMeters',
          maxDistance: maxDistanceMeters,
          spherical: true,
          query: matchQuery,
        },
      },
      {
        $addFields: {
          distanceInKm: { $round: [{ $divide: ['$distanceInMeters', 1000] }, 2] },
        },
      },
      {
        $sort: { distanceInMeters: 1 },
      },
      {
        $limit: parseInt(limit, 10) || 50,
      },
    ];

    const products = await Product.aggregate(pipeline);

    return res.status(200).json({
      success: true,
      count: products.length,
      origin: {
        latitude,
        longitude,
      },
      radiusKm,
      products,
    });
  } catch (error) {
    console.error('[ProductController - getNearbyProducts Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to search nearby products. Please verify your query parameters.',
      error: error.message,
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
  getNearbyProducts,
  createProduct,
  updateProduct,
  deleteProduct,
};

