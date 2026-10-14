const mongoose = require('mongoose');
const Order = require('../models/Order');

/**
 * Register Socket.IO connection event listeners and secure room management.
 * 
 * Secure Rooms:
 * - Admin: 'admin'
 * - Customer: 'customer:{userId}'
 * - Rider: 'rider:{riderId}'
 * - Specific Order: 'order:{orderId}'
 */
const registerSocketHandlers = (io, socket) => {
  const user = socket.user;

  // 1. Automatic room assignment based on authenticated user credentials
  if (user) {
    // Every authenticated user joins their personal customer room
    const customerRoom = `customer:${user.id}`;
    socket.join(customerRoom);
    console.log(`[Socket] User ${user.email} (${user.id}) joined room: ${customerRoom}`);

    // If user has Admin role, join the admin broadcast room
    if (user.role === 'Admin') {
      socket.join('admin');
      console.log(`[Socket] Admin user ${user.email} joined room: admin`);
    }

    // If user has Rider role, join their personal rider room
    if (user.role === 'Rider') {
      const riderRoom = `rider:${user.id}`;
      socket.join(riderRoom);
      console.log(`[Socket] Rider ${user.email} (${user.id}) joined room: ${riderRoom}`);
    }
  }

  // 2. Event: Join an individual Order room with strict ownership verification
  socket.on('join:order', async (data, callback) => {
    try {
      const orderId = typeof data === 'string' ? data : data?.orderId;

      if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
        const errorMsg = 'Invalid order ID format';
        if (typeof callback === 'function') callback({ success: false, message: errorMsg });
        socket.emit('order:error', { orderId, message: errorMsg });
        return;
      }

      if (!user) {
        const errorMsg = 'Authentication required to join order room';
        if (typeof callback === 'function') callback({ success: false, message: errorMsg });
        socket.emit('order:error', { orderId, message: errorMsg });
        return;
      }

      // Check order ownership in database
      const order = await Order.findById(orderId).select('customer customerEmail assignedRider');
      if (!order) {
        const errorMsg = 'Order not found';
        if (typeof callback === 'function') callback({ success: false, message: errorMsg });
        socket.emit('order:error', { orderId, message: errorMsg });
        return;
      }

      const isCustomerOwner =
        (order.customer && order.customer.toString() === user.id) ||
        (order.customerEmail && order.customerEmail.toLowerCase() === user.email.toLowerCase());
      const isAssignedRider = order.assignedRider && order.assignedRider.toString() === user.id;
      const isAdmin = user.role === 'Admin';

      if (!isCustomerOwner && !isAssignedRider && !isAdmin) {
        console.warn(`[Socket Security] Unauthorized order room access attempt by ${user.email} for Order ${orderId}`);
        const errorMsg = 'Access denied: You are not authorized to view this order';
        if (typeof callback === 'function') callback({ success: false, message: errorMsg });
        socket.emit('order:error', { orderId, message: errorMsg });
        return;
      }

      const orderRoom = `order:${orderId}`;
      socket.join(orderRoom);
      console.log(`[Socket] User ${user.email} joined room: ${orderRoom}`);

      if (typeof callback === 'function') {
        callback({ success: true, orderId, room: orderRoom });
      }
      socket.emit('order:joined', { success: true, orderId });
    } catch (err) {
      console.error(`[Socket Error] Error in join:order handler:`, err.message);
      if (typeof callback === 'function') {
        callback({ success: false, message: 'Server error joining order room' });
      }
    }
  });

  // 3. Event: Leave an individual Order room
  socket.on('leave:order', (data, callback) => {
    try {
      const orderId = typeof data === 'string' ? data : data?.orderId;
      if (orderId) {
        const orderRoom = `order:${orderId}`;
        socket.leave(orderRoom);
        console.log(`[Socket] Socket ${socket.id} left room: ${orderRoom}`);
        if (typeof callback === 'function') callback({ success: true, orderId });
      }
    } catch (err) {
      console.error(`[Socket Error] Error in leave:order handler:`, err.message);
    }
  });

  // 4. Event: Rider GPS Location Update
  // delivery:location:update
  socket.on('delivery:location:update', async (data, callback) => {
    try {
      if (!user) {
        const msg = 'Authentication required to transmit location updates';
        if (typeof callback === 'function') callback({ success: false, message: msg });
        socket.emit('delivery:error', { message: msg });
        return;
      }

      // Security check: Only Rider role (or Admin for testing) may send location updates
      if (user.role !== 'Rider' && user.role !== 'Admin') {
        const msg = 'Unauthorized: Only assigned riders can transmit delivery location';
        console.warn(`[Socket Security] Non-rider ${user.email} attempted to emit location updates.`);
        if (typeof callback === 'function') callback({ success: false, message: msg });
        socket.emit('delivery:error', { message: msg });
        return;
      }

      const { orderId, latitude, longitude, accuracy, heading, speed, timestamp } = data || {};

      if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
        const msg = 'Invalid order ID format';
        if (typeof callback === 'function') callback({ success: false, message: msg });
        socket.emit('delivery:error', { orderId, message: msg });
        return;
      }

      // Coordinate range validation: lat [-90, 90], lng [-180, 180]
      const lat = Number(latitude);
      const lng = Number(longitude);

      if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lng) || lng < -180 || lng > 180) {
        const msg = 'Invalid geographic coordinates range (lat: -90..90, lng: -180..180)';
        if (typeof callback === 'function') callback({ success: false, message: msg });
        socket.emit('delivery:error', { orderId, message: msg });
        return;
      }

      // Look up Order in MongoDB
      const order = await Order.findById(orderId);
      if (!order) {
        const msg = 'Order not found';
        if (typeof callback === 'function') callback({ success: false, message: msg });
        socket.emit('delivery:error', { orderId, message: msg });
        return;
      }

      // Verify assigned rider ownership
      const isAssignedRider = order.assignedRider && order.assignedRider.toString() === user.id;
      const isAdmin = user.role === 'Admin';

      if (!isAssignedRider && !isAdmin) {
        const msg = 'Access denied: You are not the assigned rider for this order';
        console.warn(`[Socket Security] Rider ${user.email} attempted to update unassigned Order ${orderId}`);
        if (typeof callback === 'function') callback({ success: false, message: msg });
        socket.emit('delivery:error', { orderId, message: msg });
        return;
      }

      // Verify delivery is currently active and reject completed deliveries
      if (order.deliveryStatus === 'delivered') {
        const msg = 'Delivery is already completed. Location updates are rejected.';
        if (typeof callback === 'function') callback({ success: false, message: msg });
        socket.emit('delivery:error', { orderId, message: msg });
        return;
      }

      const activeStatuses = ['accepted', 'picked_up', 'on_the_way'];
      if (!activeStatuses.includes(order.deliveryStatus)) {
        const msg = `Delivery is not currently in an active state (Status: ${order.deliveryStatus})`;
        if (typeof callback === 'function') callback({ success: false, message: msg });
        socket.emit('delivery:error', { orderId, message: msg });
        return;
      }

      // Update Order Location in MongoDB
      order.riderLocation = {
        type: 'Point',
        coordinates: [Number(lng.toFixed(6)), Number(lat.toFixed(6))], // GeoJSON standard [lng, lat]
        accuracy: accuracy ? Number(accuracy) : null,
        heading: heading !== undefined && heading !== null ? Number(heading) : null,
        speed: speed !== undefined && speed !== null ? Number(speed) : null,
      };
      order.lastLocationUpdate = new Date(timestamp || Date.now());
      await order.save();

      // Emit live location ONLY to authorized order room & admin
      const locationPayload = {
        orderId: order._id.toString(),
        latitude: lat,
        longitude: lng,
        accuracy: accuracy || null,
        heading: heading !== undefined ? heading : null,
        speed: speed !== undefined ? speed : null,
        timestamp: timestamp || Date.now(),
      };

      io.to(`order:${orderId}`).emit('delivery:location', locationPayload);
      io.to('admin').emit('delivery:location', locationPayload);

      console.log(`[Socket GPS] Location update emitted for Order ${orderId} (Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)})`);

      if (typeof callback === 'function') {
        callback({ success: true, orderId, location: locationPayload });
      }
    } catch (err) {
      console.error(`[Socket Error] Error in delivery:location:update:`, err.message);
      if (typeof callback === 'function') {
        callback({ success: false, message: 'Server error processing location update' });
      }
    }
  });

  // 5. Disconnect Handler
  socket.on('disconnect', (reason) => {
    const userIdentifier = user ? `${user.email} (${user.id})` : `Guest (${socket.id})`;
    console.log(`[Socket] Socket disconnected: ${userIdentifier} (Reason: ${reason})`);
  });
};

module.exports = {
  registerSocketHandlers,
};
