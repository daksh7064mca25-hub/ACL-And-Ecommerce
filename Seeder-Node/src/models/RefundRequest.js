const mongoose = require('mongoose');

const refundRequestSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order reference is required'],
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Customer reference is required'],
      index: true,
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
    reason: {
      type: String,
      required: [true, 'Refund reason is required'],
      trim: true,
      enum: [
        'Product is incorrect',
        'Wrong product received',
        'Product damaged',
        'Product not as described',
        'Product missing',
        'Other',
      ],
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'processing', 'refunded', 'failed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    requestedAmount: {
      type: Number,
      required: [true, 'Requested refund amount is required'],
      min: [0, 'Requested amount must not be negative'],
    },
    approvedAmount: {
      type: Number,
      default: 0,
      min: [0, 'Approved amount must not be negative'],
    },
    currency: {
      type: String,
      default: 'inr',
      lowercase: true,
      trim: true,
    },
    stripeRefundId: {
      type: String,
      default: null,
      index: true,
    },
    stripePaymentIntentId: {
      type: String,
      default: null,
    },
    stripeChargeId: {
      type: String,
      default: null,
    },
    adminNote: {
      type: String,
      trim: true,
      default: '',
      maxlength: [1000, 'Admin note cannot exceed 1000 characters'],
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    failureReason: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const RefundRequest = mongoose.model('RefundRequest', refundRequestSchema);

module.exports = RefundRequest;
