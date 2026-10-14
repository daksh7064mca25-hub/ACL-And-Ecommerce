const { getIO } = require('../socket');

/**
 * Socket.IO Real-Time Dispatch Service
 * Provides helper methods for broadcasting safe, authoritative business events
 * across secure customer and admin rooms.
 */

/**
 * Helper: Safely serialize product object without leaking internals
 */
const sanitizeProduct = (product) => {
  if (!product) return null;
  const p = typeof product.toObject === 'function' ? product.toObject() : product;
  return {
    _id: p._id?.toString() || p._id,
    title: p.title,
    price: p.price,
    quantity: p.quantity,
    images: p.images || [],
    location: p.location,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
};

/**
 * 1. Product Created Event
 * Broadcasts safe product info to all clients.
 * @param {Object} product - Mongoose Product document or plain object
 */
const emitProductCreated = (product) => {
  const io = getIO();
  if (!io) return;

  const safeProduct = sanitizeProduct(product);
  io.emit('product:created', safeProduct);
  console.log(`[Socket Event] Emitted 'product:created' for product ${safeProduct._id} ("${safeProduct.title}")`);
};

/**
 * 2. Product Updated Event
 * Broadcasts updated product info to all clients and triggers stockUpdated.
 * @param {Object} product - Mongoose Product document or plain object
 */
const emitProductUpdated = (product) => {
  const io = getIO();
  if (!io) return;

  const safeProduct = sanitizeProduct(product);
  io.emit('product:updated', safeProduct);
  io.emit('product:stockUpdated', {
    productId: safeProduct._id,
    stock: safeProduct.quantity,
  });
  console.log(`[Socket Event] Emitted 'product:updated' and 'product:stockUpdated' for product ${safeProduct._id}`);
};

/**
 * 3. Product Stock Changed Event
 * Broadcasts updated stock level for a product.
 * @param {string|mongoose.Types.ObjectId} productId
 * @param {number} stock - New stock quantity
 */
const emitStockUpdated = (productId, stock) => {
  const io = getIO();
  if (!io) return;

  const payload = {
    productId: productId?.toString(),
    stock: Number(stock),
  };

  io.emit('product:stockUpdated', payload);
  console.log(`[Socket Event] Emitted 'product:stockUpdated' for product ${payload.productId} (Stock: ${payload.stock})`);
};

/**
 * 4. Order Created Event
 * Emits order creation summary only to the 'admin' room and sends an admin notification.
 * @param {Object} order - Order document
 */
const emitOrderCreated = (order) => {
  const io = getIO();
  if (!io || !order) return;

  const orderId = order._id?.toString() || order._id;
  const payload = {
    orderId,
    customerName: order.customerName || '',
    customerEmail: order.customerEmail || '',
    totalAmount: order.totalAmount,
    subtotalAmount: order.subtotalAmount,
    deliveryFee: order.deliveryFee,
    currency: order.currency || 'inr',
    itemsCount: order.items?.length || 0,
    paymentStatus: order.paymentStatus || 'pending',
    orderStatus: order.orderStatus || 'pending',
    createdAt: order.createdAt || new Date(),
  };

  io.to('admin').emit('order:created', payload);
  console.log(`[Socket Event] Emitted 'order:created' to room 'admin' for Order ${orderId}`);

  // Dispatch Admin Notification
  emitAdminNotification({
    type: 'order',
    title: 'New Order Received',
    message: `Order #${orderId} (₹${order.totalAmount}) placed by ${order.customerName || order.customerEmail}`,
    relatedId: orderId,
  });
};

/**
 * 5. Order Status Updated Event
 * Sends order status update to the customer's private room, the specific order room, and admins.
 * @param {Object} order - Order document
 */
const emitOrderStatusUpdated = (order) => {
  const io = getIO();
  if (!io || !order) return;

  const orderId = order._id?.toString() || order._id;
  const customerId = order.customer?._id?.toString() || order.customer?.toString();

  const payload = {
    orderId,
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    deliveryStatus: order.deliveryStatus,
    deliveredAt: order.deliveredAt || null,
    refundStatus: order.refundStatus || 'none',
    totalAmount: order.totalAmount,
    updatedAt: order.updatedAt || new Date(),
  };

  // Emit to customer private room if customer ID exists
  if (customerId) {
    io.to(`customer:${customerId}`).emit('order:statusUpdated', payload);
    console.log(`[Socket Event] Emitted 'order:statusUpdated' to customer:${customerId} for Order ${orderId}`);
  }

  // Emit to specific order room
  io.to(`order:${orderId}`).emit('order:statusUpdated', payload);

  // Emit to admin room
  io.to('admin').emit('order:statusUpdated', payload);
};

/**
 * 6. Payment Success Event
 * Emitted when Stripe webhook confirms payment.
 * @param {Object} order - Order document
 */
const emitPaymentSuccess = (order) => {
  const io = getIO();
  if (!io || !order) return;

  const orderId = order._id?.toString() || order._id;
  const customerId = order.customer?._id?.toString() || order.customer?.toString();

  const payload = {
    orderId,
    paymentStatus: 'paid',
    orderStatus: order.orderStatus || 'confirmed',
    totalAmount: order.totalAmount,
    customerEmail: order.customerEmail,
  };

  if (customerId) {
    io.to(`customer:${customerId}`).emit('payment:success', payload);
    console.log(`[Socket Event] Emitted 'payment:success' to customer:${customerId} for Order ${orderId}`);
  }

  io.to(`order:${orderId}`).emit('payment:success', payload);
  io.to('admin').emit('payment:success', payload);

  // Dispatch Admin Notification
  emitAdminNotification({
    type: 'payment',
    title: 'Payment Successful',
    message: `Payment of ₹${order.totalAmount} confirmed for Order #${orderId}`,
    relatedId: orderId,
  });
};

/**
 * 7. Payment Failed Event
 * Emitted when Stripe payment fails.
 * @param {Object} order - Order document
 * @param {string} [failureReason] - Safe description of payment failure
 */
const emitPaymentFailed = (order, failureReason) => {
  const io = getIO();
  if (!io || !order) return;

  const orderId = order._id?.toString() || order._id;
  const customerId = order.customer?._id?.toString() || order.customer?.toString();

  const payload = {
    orderId,
    paymentStatus: 'failed',
    failureReason: failureReason || 'Payment failed or was declined',
  };

  if (customerId) {
    io.to(`customer:${customerId}`).emit('payment:failed', payload);
    console.log(`[Socket Event] Emitted 'payment:failed' to customer:${customerId} for Order ${orderId}`);
  }

  io.to(`order:${orderId}`).emit('payment:failed', payload);
  io.to('admin').emit('payment:failed', payload);

  // Dispatch Admin Notification
  emitAdminNotification({
    type: 'payment',
    title: 'Payment Failed',
    message: `Payment failed for Order #${orderId}: ${payload.failureReason}`,
    relatedId: orderId,
  });
};

/**
 * 8. Refund Requested Event
 * Emitted to admin room when a customer submits a refund request.
 * @param {Object} refundRequest - RefundRequest document
 * @param {Object} order - Associated Order document
 */
const emitRefundRequested = (refundRequest, order) => {
  const io = getIO();
  if (!io || !refundRequest) return;

  const refundRequestId = refundRequest._id?.toString() || refundRequest._id;
  const orderId = (order?._id || refundRequest.order)?.toString();

  const payload = {
    refundRequestId,
    orderId,
    customerEmail: refundRequest.customerEmail || order?.customerEmail || '',
    customerName: refundRequest.customerName || order?.customerName || '',
    requestedAmount: refundRequest.requestedAmount,
    reason: refundRequest.reason,
    description: refundRequest.description || '',
    status: refundRequest.status || 'pending',
    createdAt: refundRequest.createdAt || new Date(),
  };

  io.to('admin').emit('refund:requested', payload);
  console.log(`[Socket Event] Emitted 'refund:requested' to admin for RefundRequest ${refundRequestId}`);

  // Dispatch Admin Notification
  emitAdminNotification({
    type: 'refund',
    title: 'New Refund Request',
    message: `Refund request (₹${refundRequest.requestedAmount}) submitted for Order #${orderId} (${refundRequest.reason})`,
    relatedId: refundRequestId,
  });
};

/**
 * 9. Refund Status Updated Event
 * Emitted when admin or Stripe webhook updates refund status.
 * @param {Object} refundRequest - RefundRequest document
 * @param {Object} order - Order document
 */
const emitRefundStatusUpdated = (refundRequest, order) => {
  const io = getIO();
  if (!io || !refundRequest) return;

  const refundRequestId = refundRequest._id?.toString() || refundRequest._id;
  const orderId = (order?._id || refundRequest.order)?.toString();
  const customerId = (refundRequest.customer?._id || refundRequest.customer || order?.customer)?._id?.toString() ||
                     (refundRequest.customer?._id || refundRequest.customer || order?.customer)?.toString();

  const payload = {
    refundRequestId,
    orderId,
    status: refundRequest.status,
    refundStatus: order?.refundStatus || refundRequest.status,
    approvedAmount: refundRequest.approvedAmount || refundRequest.requestedAmount,
    adminNote: refundRequest.adminNote || '',
    failureReason: refundRequest.failureReason || null,
    processedAt: refundRequest.processedAt || new Date(),
  };

  if (customerId) {
    io.to(`customer:${customerId}`).emit('refund:statusUpdated', payload);
    console.log(`[Socket Event] Emitted 'refund:statusUpdated' to customer:${customerId} for RefundRequest ${refundRequestId}`);
  }

  if (orderId) {
    io.to(`order:${orderId}`).emit('refund:statusUpdated', payload);
  }

  io.to('admin').emit('refund:statusUpdated', payload);
};

/**
 * 10. Lightweight Admin Real-Time Notification
 * Emits a structured notification event to the admin room.
 * @param {Object} params
 * @param {string} params.type - 'order' | 'refund' | 'payment' | 'product' | 'system'
 * @param {string} params.title - Short title header
 * @param {string} params.message - Descriptive notification body
 * @param {string} [params.relatedId] - Associated entity ID (order ID, refund ID, etc.)
 */
const emitAdminNotification = ({ type, title, message, relatedId }) => {
  const io = getIO();
  if (!io) return;

  const notification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    type: type || 'system',
    title: title || 'System Update',
    message: message || '',
    createdAt: new Date(),
    relatedId: relatedId ? relatedId.toString() : null,
  };

  io.to('admin').emit('notification:new', notification);
  console.log(`[Socket Event] Emitted 'notification:new' to admin: "${notification.title}"`);
};

/**
 * 11. Delivery Assigned Event
 * Emitted when an Admin assigns a rider to an order.
 * Broadcasts to rider:{riderId}, customer:{customerId}, order:{orderId}, and admin room.
 * @param {Object} order - Order document
 * @param {Object} rider - User document with Rider role
 */
const emitDeliveryAssigned = (order, rider) => {
  const io = getIO();
  if (!io || !order) return;

  const orderId = order._id?.toString() || order._id;
  const riderId = (rider?._id || order.assignedRider)?._id?.toString() || (rider?._id || order.assignedRider)?.toString();
  const customerId = (order.customer?._id || order.customer)?.toString();
  const riderName = rider?.name || order.assignedRiderName || 'Assigned Rider';
  const riderPhone = rider?.phone || order.assignedRiderPhone || '';

  const payload = {
    orderId,
    riderId,
    riderName,
    riderPhone,
    deliveryStatus: order.deliveryStatus || 'assigned',
    assignedAt: order.assignedAt || new Date(),
  };

  // Emit to rider room
  if (riderId) {
    io.to(`rider:${riderId}`).emit('delivery:assigned', payload);
    console.log(`[Socket Event] Emitted 'delivery:assigned' to rider:${riderId} for Order ${orderId}`);
  }

  // Emit to customer room
  if (customerId) {
    io.to(`customer:${customerId}`).emit('delivery:assigned', payload);
    console.log(`[Socket Event] Emitted 'delivery:assigned' to customer:${customerId} for Order ${orderId}`);
  }

  // Emit to order room and admin room
  io.to(`order:${orderId}`).emit('delivery:assigned', payload);
  io.to('admin').emit('delivery:assigned', payload);

  // Dispatch Admin & Customer notifications
  emitAdminNotification({
    type: 'order',
    title: 'Rider Assigned',
    message: `Rider ${riderName} assigned to Order #${orderId}`,
    relatedId: orderId,
  });
};

/**
 * 12. Delivery Status Updated Event
 * Emitted when delivery state changes (assigned, accepted, picked_up, on_the_way, delivered, cancelled).
 * Broadcasts to customer:{customerId}, order:{orderId}, rider:{riderId}, and admin.
 * @param {Object} order - Order document
 */
const emitDeliveryStatus = (order) => {
  const io = getIO();
  if (!io || !order) return;

  const orderId = order._id?.toString() || order._id;
  const customerId = (order.customer?._id || order.customer)?.toString();
  const riderId = (order.assignedRider?._id || order.assignedRider)?.toString();
  const status = order.deliveryStatus;

  const payload = {
    orderId,
    status,
    deliveryStatus: status,
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    deliveredAt: order.deliveredAt || null,
    riderId: riderId || null,
    riderName: order.assignedRiderName || '',
    updatedAt: order.updatedAt || new Date(),
  };

  if (customerId) {
    io.to(`customer:${customerId}`).emit('delivery:status', payload);
    console.log(`[Socket Event] Emitted 'delivery:status' to customer:${customerId} (Status: ${status})`);
  }

  if (riderId) {
    io.to(`rider:${riderId}`).emit('delivery:status', payload);
  }

  io.to(`order:${orderId}`).emit('delivery:status', payload);
  io.to('admin').emit('delivery:status', payload);

  // Human-readable status notification text
  const statusMessages = {
    assigned: 'Rider has been assigned to your order.',
    accepted: 'Rider has accepted your delivery request.',
    picked_up: 'Your order has been picked up.',
    on_the_way: 'Your rider is on the way.',
    delivered: 'Your order has been delivered.',
    cancelled: 'Delivery was cancelled.',
  };

  const message = statusMessages[status] || `Delivery status changed to ${status}`;

  emitAdminNotification({
    type: 'order',
    title: `Delivery: ${status.replace(/_/g, ' ').toUpperCase()}`,
    message: `Order #${orderId}: ${message}`,
    relatedId: orderId,
  });
};

/**
 * 13. Emit Live Rider Location Event
 * Dispatches live GPS updates to authorized order room and admin.
 * @param {string} orderId
 * @param {Object} locationData - { latitude, longitude, accuracy, heading, speed, timestamp }
 */
const emitRiderLocation = (orderId, locationData) => {
  const io = getIO();
  if (!io || !orderId || !locationData) return;

  const payload = {
    orderId: orderId.toString(),
    latitude: Number(locationData.latitude),
    longitude: Number(locationData.longitude),
    accuracy: locationData.accuracy ? Number(locationData.accuracy) : null,
    heading: locationData.heading !== undefined ? Number(locationData.heading) : null,
    speed: locationData.speed !== undefined ? Number(locationData.speed) : null,
    timestamp: locationData.timestamp || Date.now(),
  };

  io.to(`order:${orderId}`).emit('delivery:location', payload);
  io.to('admin').emit('delivery:location', payload);
};

module.exports = {
  sanitizeProduct,
  emitProductCreated,
  emitProductUpdated,
  emitStockUpdated,
  emitOrderCreated,
  emitOrderStatusUpdated,
  emitPaymentSuccess,
  emitPaymentFailed,
  emitRefundRequested,
  emitRefundStatusUpdated,
  emitAdminNotification,
  emitDeliveryAssigned,
  emitDeliveryStatus,
  emitRiderLocation,
};
