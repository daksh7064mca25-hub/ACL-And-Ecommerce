const mongoose = require('mongoose');

const deliveryZoneSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Delivery zone name is required'],
      trim: true,
      unique: true,
    },
    code: {
      type: String,
      required: [true, 'Zone code is required'],
      trim: true,
      uppercase: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    // GeoJSON Polygon representation for spatial queries ($geoIntersects, $geoWithin)
    boundary: {
      type: {
        type: String,
        enum: ['Polygon'],
        default: 'Polygon',
        required: true,
      },
      coordinates: {
        type: [[[Number]]], // Array of rings, each containing [longitude, latitude] pairs. First and last points MUST match.
        required: [true, 'Polygon boundary coordinates are required'],
        validate: {
          validator: function (coords) {
            if (!Array.isArray(coords) || coords.length === 0) return false;
            const exteriorRing = coords[0];
            if (!Array.isArray(exteriorRing) || exteriorRing.length < 4) return false;
            // First and last point must be identical to form a closed ring
            const first = exteriorRing[0];
            const last = exteriorRing[exteriorRing.length - 1];
            return (
              Array.isArray(first) &&
              Array.isArray(last) &&
              first[0] === last[0] &&
              first[1] === last[1]
            );
          },
          message:
            'Boundary must be a valid closed GeoJSON Polygon with at least 4 coordinate pairs (first and last coordinate must be identical)',
        },
      },
    },
    deliveryFee: {
      type: Number,
      required: [true, 'Delivery fee is required'],
      min: [0, 'Delivery fee cannot be negative'],
      default: 0,
    },
    minOrderAmount: {
      type: Number,
      required: [true, 'Minimum order amount is required'],
      min: [0, 'Minimum order amount cannot be negative'],
      default: 0,
    },
    estimatedDeliveryTime: {
      type: String,
      trim: true,
      default: '30-45 mins',
    },
    priority: {
      type: Number,
      default: 1,
      min: 1,
      max: 100,
      help: 'Higher priority zone takes precedence in overlapping areas',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    coverageType: {
      type: String,
      enum: ['all_products', 'specific_products', 'categories'],
      default: 'all_products',
    },
    assignedProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
    assignedCategories: [
      {
        type: String,
        trim: true,
      },
    ],
    color: {
      type: String,
      default: '#4f46e5',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Create 2dsphere index for high-performance geospatial $geoIntersects queries
deliveryZoneSchema.index({ boundary: '2dsphere' });

const DeliveryZone = mongoose.model('DeliveryZone', deliveryZoneSchema);

module.exports = DeliveryZone;
