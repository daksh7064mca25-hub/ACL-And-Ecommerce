const mongoose = require('mongoose');
const DeliveryZone = require('../models/DeliveryZone');
const Product = require('../models/Product');

/**
 * Validate and sanitize GeoJSON polygon coordinates ring.
 * Ensures the polygon has at least 3 distinct vertices and is properly closed (first point === last point).
 */
function normalizePolygonCoordinates(coordinates) {
  if (!Array.isArray(coordinates)) {
    throw new Error('Coordinates must be an array of rings.');
  }

  // Handle single ring passed directly or nested [[[lng, lat], ...]]
  let ring = coordinates;
  if (Array.isArray(coordinates[0]) && Array.isArray(coordinates[0][0])) {
    ring = coordinates[0];
  }

  if (ring.length < 3) {
    throw new Error('A polygon boundary must contain at least 3 coordinate points.');
  }

  // Validate each point is [lng, lat]
  const cleanedRing = ring.map((pt, idx) => {
    if (!Array.isArray(pt) || pt.length < 2) {
      throw new Error(`Invalid coordinate point at index ${idx}. Must be [longitude, latitude].`);
    }
    const lng = Number(pt[0]);
    const lat = Number(pt[1]);
    if (isNaN(lng) || lng < -180 || lng > 180) {
      throw new Error(`Invalid longitude ${pt[0]} at index ${idx}. Longitude must be between -180 and 180.`);
    }
    if (isNaN(lat) || lat < -90 || lat > 90) {
      throw new Error(`Invalid latitude ${pt[1]} at index ${idx}. Latitude must be between -90 and 90.`);
    }
    return [Number(lng.toFixed(6)), Number(lat.toFixed(6))];
  });

  // Ensure ring is closed (first point identical to last point)
  const first = cleanedRing[0];
  const last = cleanedRing[cleanedRing.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    cleanedRing.push([first[0], first[1]]);
  }

  if (cleanedRing.length < 4) {
    throw new Error('Polygon ring must have at least 4 coordinates (3 points + closed endpoint).');
  }

  return [cleanedRing];
}

/**
 * List all delivery zones with optional active filter
 * GET /api/delivery-zones
 */
const getDeliveryZones = async (req, res) => {
  try {
    const { activeOnly, search } = req.query;
    const filter = {};

    if (activeOnly === 'true') {
      filter.isActive = true;
    }

    if (search && search.trim()) {
      filter.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { code: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const zones = await DeliveryZone.find(filter)
      .populate('assignedProducts', 'title price images quantity')
      .sort({ priority: -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: zones.length,
      deliveryZones: zones,
      zones: zones,
    });
  } catch (error) {
    console.error('[DeliveryZone Error] Failed to get delivery zones:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve delivery zones',
      error: error.message,
    });
  }
};

/**
 * Get single delivery zone by ID
 * GET /api/delivery-zones/:id
 */
const getDeliveryZoneById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid delivery zone ID format',
      });
    }

    const zone = await DeliveryZone.findById(id).populate(
      'assignedProducts',
      'title price images quantity'
    );

    if (!zone) {
      return res.status(404).json({
        success: false,
        message: 'Delivery zone not found',
      });
    }

    return res.status(200).json({
      success: true,
      deliveryZone: zone,
    });
  } catch (error) {
    console.error('[DeliveryZone Error] Failed to get delivery zone:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve delivery zone details',
      error: error.message,
    });
  }
};

/**
 * Create a new delivery zone with polygon boundary
 * POST /api/delivery-zones
 */
const createDeliveryZone = async (req, res) => {
  try {
    const {
      name,
      code,
      description,
      boundary,
      deliveryFee,
      minOrderAmount,
      estimatedDeliveryTime,
      priority,
      isActive,
      coverageType,
      assignedProducts,
      assignedCategories,
      color,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Zone name is required.' });
    }
    if (!code || !code.trim()) {
      return res.status(400).json({ success: false, message: 'Zone code is required.' });
    }
    if (!boundary || !boundary.coordinates) {
      return res.status(400).json({
        success: false,
        message: 'Polygon boundary coordinates are required.',
      });
    }

    // Check unique name and code
    const existingName = await DeliveryZone.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
    });
    if (existingName) {
      return res.status(400).json({
        success: false,
        message: `A delivery zone named "${name}" already exists.`,
      });
    }

    const existingCode = await DeliveryZone.findOne({
      code: code.trim().toUpperCase(),
    });
    if (existingCode) {
      return res.status(400).json({
        success: false,
        message: `Zone code "${code.toUpperCase()}" is already assigned.`,
      });
    }

    // Normalize polygon coordinates
    const normalizedCoordinates = normalizePolygonCoordinates(boundary.coordinates);

    // Validate assigned products if specific_products coverage
    let validProducts = [];
    if (coverageType === 'specific_products' && Array.isArray(assignedProducts)) {
      validProducts = assignedProducts.filter((pid) => mongoose.Types.ObjectId.isValid(pid));
    }

    const newZone = await DeliveryZone.create({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description: description ? description.trim() : '',
      boundary: {
        type: 'Polygon',
        coordinates: normalizedCoordinates,
      },
      deliveryFee: deliveryFee !== undefined ? Math.max(0, Number(deliveryFee)) : 0,
      minOrderAmount: minOrderAmount !== undefined ? Math.max(0, Number(minOrderAmount)) : 0,
      estimatedDeliveryTime: estimatedDeliveryTime ? estimatedDeliveryTime.trim() : '30-45 mins',
      priority: priority !== undefined ? Number(priority) : 1,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      coverageType: coverageType || 'all_products',
      assignedProducts: validProducts,
      assignedCategories: Array.isArray(assignedCategories) ? assignedCategories : [],
      color: color || '#4f46e5',
    });

    const populatedZone = await DeliveryZone.findById(newZone._id).populate(
      'assignedProducts',
      'title price images quantity'
    );

    return res.status(201).json({
      success: true,
      message: 'Delivery zone created successfully',
      deliveryZone: populatedZone,
    });
  } catch (error) {
    console.error('[DeliveryZone Error] Failed to create delivery zone:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to create delivery zone',
    });
  }
};

/**
 * Update existing delivery zone
 * PUT /api/delivery-zones/:id
 */
const updateDeliveryZone = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid delivery zone ID format.' });
    }

    const zone = await DeliveryZone.findById(id);
    if (!zone) {
      return res.status(404).json({ success: false, message: 'Delivery zone not found.' });
    }

    const {
      name,
      code,
      description,
      boundary,
      deliveryFee,
      minOrderAmount,
      estimatedDeliveryTime,
      priority,
      isActive,
      coverageType,
      assignedProducts,
      assignedCategories,
      color,
    } = req.body;

    if (name && name.trim()) {
      const duplicateName = await DeliveryZone.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      });
      if (duplicateName) {
        return res.status(400).json({
          success: false,
          message: `Another delivery zone is already named "${name}".`,
        });
      }
      zone.name = name.trim();
    }

    if (code && code.trim()) {
      const duplicateCode = await DeliveryZone.findOne({
        _id: { $ne: id },
        code: code.trim().toUpperCase(),
      });
      if (duplicateCode) {
        return res.status(400).json({
          success: false,
          message: `Zone code "${code.toUpperCase()}" is already in use.`,
        });
      }
      zone.code = code.trim().toUpperCase();
    }

    if (description !== undefined) zone.description = description.trim();

    if (boundary && boundary.coordinates) {
      zone.boundary = {
        type: 'Polygon',
        coordinates: normalizePolygonCoordinates(boundary.coordinates),
      };
    }

    if (deliveryFee !== undefined) zone.deliveryFee = Math.max(0, Number(deliveryFee));
    if (minOrderAmount !== undefined) zone.minOrderAmount = Math.max(0, Number(minOrderAmount));
    if (estimatedDeliveryTime !== undefined) zone.estimatedDeliveryTime = estimatedDeliveryTime.trim();
    if (priority !== undefined) zone.priority = Number(priority);
    if (isActive !== undefined) zone.isActive = Boolean(isActive);
    if (coverageType !== undefined) zone.coverageType = coverageType;

    if (assignedProducts !== undefined && Array.isArray(assignedProducts)) {
      zone.assignedProducts = assignedProducts.filter((pid) =>
        mongoose.Types.ObjectId.isValid(pid)
      );
    }

    if (assignedCategories !== undefined && Array.isArray(assignedCategories)) {
      zone.assignedCategories = assignedCategories;
    }

    if (color !== undefined) zone.color = color;

    await zone.save();

    const updated = await DeliveryZone.findById(zone._id).populate(
      'assignedProducts',
      'title price images quantity'
    );

    return res.status(200).json({
      success: true,
      message: 'Delivery zone updated successfully',
      deliveryZone: updated,
    });
  } catch (error) {
    console.error('[DeliveryZone Error] Failed to update delivery zone:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to update delivery zone',
    });
  }
};

/**
 * Delete delivery zone
 * DELETE /api/delivery-zones/:id
 */
const deleteDeliveryZone = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid delivery zone ID format.' });
    }

    const deleted = await DeliveryZone.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Delivery zone not found.' });
    }

    return res.status(200).json({
      success: true,
      message: `Delivery zone "${deleted.name}" (${deleted.code}) deleted successfully.`,
    });
  } catch (error) {
    console.error('[DeliveryZone Error] Failed to delete delivery zone:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete delivery zone',
      error: error.message,
    });
  }
};

/**
 * Check delivery serviceability for a customer coordinate [lat, lng]
 * Evaluates whether location intersects any active delivery zone ($geoIntersects)
 * and verifies cart product eligibility and minimum order amount.
 *
 * POST /api/delivery-zones/check-serviceability
 * Query / Body: { lat, lng, items, cartTotal }
 */
const checkServiceability = async (req, res) => {
  try {
    const lat = Number(
      req.body?.latitude ?? req.body?.lat ?? req.query?.latitude ?? req.query?.lat
    );
    const lng = Number(
      req.body?.longitude ?? req.body?.lng ?? req.query?.longitude ?? req.query?.lng
    );
    const items = req.body?.items || [];
    const cartTotal = Number(req.body?.cartTotal || 0);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      return res.status(400).json({
        success: false,
        isServiceable: false,
        serviceable: false,
        message: 'Invalid latitude parameter. Must be between -90 and 90.',
      });
    }

    if (isNaN(lng) || lng < -180 || lng > 180) {
      return res.status(400).json({
        success: false,
        isServiceable: false,
        serviceable: false,
        message: 'Invalid longitude parameter. Must be between -180 and 180.',
      });
    }

    // Geospatial Query: Find all active delivery zones containing the Point [lng, lat]
    const matchingZones = await DeliveryZone.find({
      isActive: true,
      boundary: {
        $geoIntersects: {
          $geometry: {
            type: 'Point',
            coordinates: [lng, lat], // GeoJSON standard: [longitude, latitude]
          },
        },
      },
    })
      .populate('assignedProducts', 'title price images quantity')
      .sort({ priority: -1, deliveryFee: 1 });

    if (!matchingZones || matchingZones.length === 0) {
      return res.status(200).json({
        success: true,
        isServiceable: false,
        serviceable: false,
        coordinates: { latitude: lat, longitude: lng },
        deliveryZone: null,
        zone: null,
        deliveryFee: 0,
        estimatedDeliveryTime: null,
        minOrderAmount: 0,
        meetsMinOrder: true,
        minOrderSatisfied: true,
        minOrderShortfall: 0,
        shortfallAmount: 0,
        unavailableItems: [],
        message: 'Your selected location is outside our deliverable service area.',
      });
    }

    // Select the highest priority zone (or lowest fee if equal priority)
    const bestZone = matchingZones[0];

    // Check product item availability within this zone
    const unavailableItems = [];
    if (bestZone.coverageType === 'specific_products' && Array.isArray(items) && items.length > 0) {
      const allowedProductIds = new Set(
        bestZone.assignedProducts.map((p) => p._id.toString())
      );

      for (const item of items) {
        const pId = (item.productId || item._id || item.product)?.toString();
        if (pId && !allowedProductIds.has(pId)) {
          unavailableItems.push({
            productId: pId,
            title: item.title || 'Selected Product',
            reason: `Not deliverable to ${bestZone.name}`,
          });
        }
      }
    }

    const minOrderSatisfied = cartTotal >= bestZone.minOrderAmount;
    const shortfallAmount = minOrderSatisfied ? 0 : bestZone.minOrderAmount - cartTotal;

    const zoneSummary = {
      _id: bestZone._id,
      name: bestZone.name,
      code: bestZone.code,
      description: bestZone.description,
      deliveryFee: bestZone.deliveryFee,
      minOrderAmount: bestZone.minOrderAmount,
      estimatedDeliveryTime: bestZone.estimatedDeliveryTime,
      priority: bestZone.priority,
      coverageType: bestZone.coverageType,
      color: bestZone.color,
    };

    return res.status(200).json({
      success: true,
      isServiceable: true,
      serviceable: true,
      coordinates: { latitude: lat, longitude: lng },
      deliveryZone: zoneSummary,
      zone: zoneSummary,
      deliveryFee: bestZone.deliveryFee,
      estimatedDeliveryTime: bestZone.estimatedDeliveryTime,
      minOrderAmount: bestZone.minOrderAmount,
      meetsMinOrder: minOrderSatisfied,
      minOrderSatisfied,
      minOrderShortfall: shortfallAmount,
      shortfallAmount,
      unavailableItems,
      allMatchingZonesCount: matchingZones.length,
      message:
        unavailableItems.length > 0
          ? `Some products in your cart cannot be delivered to ${bestZone.name}.`
          : !minOrderSatisfied
          ? `Minimum order amount of ₹${bestZone.minOrderAmount} required for ${bestZone.name}. Add ₹${shortfallAmount.toFixed(2)} more to proceed.`
          : `Deliverable via ${bestZone.name} (Estimated: ${bestZone.estimatedDeliveryTime}, Delivery Fee: ₹${bestZone.deliveryFee})`,
    });
  } catch (error) {
    console.error('[DeliveryZone Error] Serviceability check failed:', error);
    return res.status(500).json({
      success: false,
      serviceable: false,
      message: 'Error verifying delivery serviceability',
      error: error.message,
    });
  }
};

module.exports = {
  getDeliveryZones,
  getDeliveryZoneById,
  createDeliveryZone,
  updateDeliveryZone,
  deleteDeliveryZone,
  checkServiceability,
};
