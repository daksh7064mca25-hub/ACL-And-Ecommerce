const mongoose = require('mongoose');
const Order = require('../models/Order');
const { emitDeliveryStatus, emitOrderStatusUpdated } = require('../services/socketService');

/**
 * Valid delivery status transitions map
 */
const VALID_TRANSITIONS = {
  unassigned: ['assigned'],
  assigned: ['accepted', 'cancelled'],
  accepted: ['picked_up', 'cancelled'],
  picked_up: ['on_the_way', 'cancelled'],
  on_the_way: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

/**
 * Get all deliveries assigned to the authenticated rider
 * GET /api/rider/deliveries
 */
const getAssignedDeliveries = async (req, res) => {
  try {
    const riderId = req.user._id;
    const { status } = req.query;

    const query = { assignedRider: riderId };
    if (status) {
      query.deliveryStatus = status;
    }

    const deliveries = await Order.find(query)
      .populate('customer', 'name email')
      .sort({ updatedAt: -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: deliveries.length,
      deliveries,
    });
  } catch (error) {
    console.error('[RiderController - getAssignedDeliveries Error]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve rider deliveries',
    });
  }
};

/**
 * Get the currently active delivery for the authenticated rider
 * GET /api/rider/deliveries/active
 */
const getActiveDelivery = async (req, res) => {
  try {
    const riderId = req.user._id;

    const activeDelivery = await Order.findOne({
      assignedRider: riderId,
      deliveryStatus: { $in: ['assigned', 'accepted', 'picked_up', 'on_the_way'] },
    })
      .populate('customer', 'name email')
      .sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      delivery: activeDelivery || null,
    });
  } catch (error) {
    console.error('[RiderController - getActiveDelivery Error]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve active delivery',
    });
  }
};

/**
 * Get single delivery details for the authenticated rider
 * GET /api/rider/deliveries/:id
 */
const getDeliveryById = async (req, res) => {
  try {
    const { id } = req.params;
    const riderId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid delivery/order ID format',
      });
    }

    const delivery = await Order.findOne({
      _id: id,
      assignedRider: riderId,
    }).populate('customer', 'name email');

    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: 'Delivery not found or not assigned to you',
      });
    }

    return res.status(200).json({
      success: true,
      delivery,
    });
  } catch (error) {
    console.error('[RiderController - getDeliveryById Error]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve delivery details',
    });
  }
};

/**
 * Update delivery status with state machine enforcement
 * PUT /api/rider/deliveries/:id/status
 * Body: { status: 'accepted' | 'picked_up' | 'on_the_way' | 'delivered' | 'cancelled' }
 */
const updateDeliveryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const riderId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid delivery/order ID format',
      });
    }

    if (!status || typeof status !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'New delivery status is required',
      });
    }

    const targetStatus = status.toLowerCase().trim();
    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Security check: Must be the assigned rider (or admin)
    if (!order.assignedRider || order.assignedRider.toString() !== riderId.toString()) {
      if (req.user.role?.name !== 'Admin') {
        return res.status(403).json({
          success: false,
          message: 'Access forbidden. You are not the assigned rider for this delivery.',
        });
      }
    }

    const currentStatus = order.deliveryStatus || 'unassigned';

    // Safe handling for repeated completion requests
    if (currentStatus === 'delivered' && targetStatus === 'delivered') {
      return res.status(200).json({
        success: true,
        message: 'Delivery is already completed',
        delivery: order,
      });
    }

    const allowedTransitions = VALID_TRANSITIONS[currentStatus] || [];

    if (!allowedTransitions.includes(targetStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from '${currentStatus}' to '${targetStatus}'. Allowed: [${allowedTransitions.join(', ')}]`,
      });
    }

    // Apply state change and update appropriate timestamps
    order.deliveryStatus = targetStatus;
    const now = new Date();

    if (targetStatus === 'accepted') {
      order.acceptedAt = now;
    } else if (targetStatus === 'picked_up') {
      order.pickedUpAt = now;
    } else if (targetStatus === 'on_the_way') {
      order.deliveryStartedAt = now;
    } else if (targetStatus === 'delivered') {
      order.deliveredAt = now;
      order.orderStatus = 'completed';
    }

    await order.save();

    console.log(`[RiderController] Order #${order._id} deliveryStatus updated: ${currentStatus} -> ${targetStatus}`);

    // Emit real-time delivery status and order status events
    try {
      emitDeliveryStatus(order);
      if (targetStatus === 'delivered') {
        emitOrderStatusUpdated(order);
      }
    } catch (sockErr) {
      console.error('[RiderController] Socket emit error on delivery status update:', sockErr.message);
    }

    return res.status(200).json({
      success: true,
      message: `Delivery status updated to '${targetStatus}'`,
      delivery: order,
    });
  } catch (error) {
    console.error('[RiderController - updateDeliveryStatus Error]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to update delivery status',
    });
  }
};

module.exports = {
  getAssignedDeliveries,
  getActiveDelivery,
  getDeliveryById,
  updateDeliveryStatus,
};
