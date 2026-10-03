const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Product title is required'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Product price is required'],
      min: [0, 'Price must not be negative'],
    },
    quantity: {
      type: Number,
      required: [true, 'Product quantity is required'],
      min: [0, 'Quantity must not be negative'],
      default: 0,
    },
    images: [
      {
        type: String,
        trim: true,
      },
    ],
    // GeoJSON Point location for geospatial queries ($near, $geoNear, $geoWithin)
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude] per GeoJSON standard
        required: false,
      },
      formattedAddress: {
        type: String,
        trim: true,
        default: '',
      },
      city: {
        type: String,
        trim: true,
        default: '',
      },
      state: {
        type: String,
        trim: true,
        default: '',
      },
      country: {
        type: String,
        trim: true,
        default: 'India',
      },
      postalCode: {
        type: String,
        trim: true,
        default: '',
      },
    },
  },
  {
    timestamps: true,
  }
);

// Create 2dsphere geospatial index on location for spherical geo queries
productSchema.index({ location: '2dsphere' }, { sparse: true });

const Product = mongoose.model('Product', productSchema);

module.exports = Product;

