const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product reference is required'],
    },
    title: {
      type: String,
      required: [true, 'Product title at purchase is required'],
      trim: true,
    },
    priceAtPurchase: {
      type: Number,
      required: [true, 'Price at purchase is required'],
      min: [0, 'Price must not be negative'],
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
    },
    image: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    customerEmail: {
      type: String,
      required: [true, 'Customer email is required'],
      lowercase: true,
      trim: true,
    },
    customerName: {
      type: String,
      trim: true,
      default: '',
    },
    items: {
      type: [orderItemSchema],
      required: [true, 'Order items are required'],
      validate: [
        (items) => Array.isArray(items) && items.length > 0,
        'Order must contain at least one item',
      ],
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0, 'Total amount must not be negative'],
    },
    currency: {
      type: String,
      default: 'usd',
      lowercase: true,
      trim: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
    },
    orderStatus: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'processing', 'completed'],
      default: 'pending',
    },
    stripeCheckoutSessionId: {
      type: String,
      index: true,
      default: null,
    },
    stripePaymentIntentId: {
      type: String,
      default: null,
    },
    shippingAddress: {
      line1: { type: String, default: '' },
      line2: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      postal_code: { type: String, default: '' },
      country: { type: String, default: '' },
    },
  },
  {
    timestamps: true,
  }
);

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
