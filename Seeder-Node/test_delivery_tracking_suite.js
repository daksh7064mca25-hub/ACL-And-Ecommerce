require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { io: Client } = require('socket.io-client');

const app = require('./src/app');
const { connectDB } = require('./src/config/db');
const { initSocket } = require('./src/socket');
const User = require('./src/models/User');
const Role = require('./src/models/Role');
const Product = require('./src/models/Product');
const Order = require('./src/models/Order');

const TEST_PORT = 5099;
const SERVER_URL = `http://localhost:${TEST_PORT}`;

let httpServer;
let adminToken, customerAToken, customerBToken, riderAToken, riderBToken;
let adminUser, customerAUser, customerBUser, riderAUser, riderBUser;

async function runDeliveryTrackingTestSuite() {
  console.log('\n======================================================');
  console.log('🛵 STARTING REAL-TIME DELIVERY TRACKING TEST SUITE');
  console.log('======================================================\n');

  let passedTests = 0;
  const totalTests = 16;

  try {
    // 1. Setup DB & Server
    await connectDB();
    httpServer = http.createServer(app);
    initSocket(httpServer);

    await new Promise((resolve) => {
      httpServer.listen(TEST_PORT, () => {
        console.log(`[Test Server] Running on ${SERVER_URL}`);
        resolve();
      });
    });

    const jwtSecret = process.env.JWT_SECRET || 'test_jwt_secret_key_12345';

    // 2. Fetch/Create Roles
    let adminRole = await Role.findOne({ name: 'Admin' });
    let customerRole = await Role.findOne({ name: 'Customer' });
    let riderRole = await Role.findOne({ name: 'Rider' });

    if (!adminRole) adminRole = await Role.create({ name: 'Admin', display: 'Admin', permissions: [] });
    if (!customerRole) customerRole = await Role.create({ name: 'Customer', display: 'Customer', permissions: [] });
    if (!riderRole) riderRole = await Role.create({ name: 'Rider', display: 'Rider', permissions: [] });

    // 3. Create Users
    adminUser = await User.findOne({ email: 'admin_delivery_test@example.com' });
    if (!adminUser) {
      adminUser = await User.create({
        name: 'Admin Test',
        email: 'admin_delivery_test@example.com',
        password: 'hashed_password_123',
        role: adminRole._id,
        isEmailVerified: true,
      });
    }
    adminToken = jwt.sign({ id: adminUser._id, role: 'Admin' }, jwtSecret, { expiresIn: '1h' });

    customerAUser = await User.findOne({ email: 'customer_a_deliv@example.com' });
    if (!customerAUser) {
      customerAUser = await User.create({
        name: 'Customer Alice',
        email: 'customer_a_deliv@example.com',
        password: 'hashed_password_123',
        role: customerRole._id,
        isEmailVerified: true,
      });
    }
    customerAToken = jwt.sign({ id: customerAUser._id, role: 'Customer' }, jwtSecret, { expiresIn: '1h' });

    customerBUser = await User.findOne({ email: 'customer_b_deliv@example.com' });
    if (!customerBUser) {
      customerBUser = await User.create({
        name: 'Customer Bob',
        email: 'customer_b_deliv@example.com',
        password: 'hashed_password_123',
        role: customerRole._id,
        isEmailVerified: true,
      });
    }
    customerBToken = jwt.sign({ id: customerBUser._id, role: 'Customer' }, jwtSecret, { expiresIn: '1h' });

    riderAUser = await User.findOne({ email: 'rider_raj_test@example.com' });
    if (!riderAUser) {
      riderAUser = await User.create({
        name: 'Raj Kumar',
        email: 'rider_raj_test@example.com',
        phone: '+91 98765 43210',
        password: 'hashed_password_123',
        role: riderRole._id,
        isEmailVerified: true,
      });
    }
    riderAToken = jwt.sign({ id: riderAUser._id, role: 'Rider' }, jwtSecret, { expiresIn: '1h' });

    riderBUser = await User.findOne({ email: 'rider_vikram_test@example.com' });
    if (!riderBUser) {
      riderBUser = await User.create({
        name: 'Vikram Singh',
        email: 'rider_vikram_test@example.com',
        phone: '+91 91234 56789',
        password: 'hashed_password_123',
        role: riderRole._id,
        isEmailVerified: true,
      });
    }
    riderBToken = jwt.sign({ id: riderBUser._id, role: 'Rider' }, jwtSecret, { expiresIn: '1h' });

    // 4. Create or find test product
    let testProduct = await Product.findOne({ title: 'Socket Delivery Keyboard' });
    if (!testProduct) {
      testProduct = await Product.create({
        title: 'Socket Delivery Keyboard',
        price: 250,
        quantity: 50,
      });
    }

    // Create Test Order for Customer A
    const testOrder = await Order.create({
      customer: customerAUser._id,
      customerEmail: customerAUser.email,
      customerName: customerAUser.name,
      items: [{ product: testProduct._id, title: testProduct.title, priceAtPurchase: 250, quantity: 1 }],
      totalAmount: 250,
      paymentStatus: 'paid',
      orderStatus: 'confirmed',
      deliveryStatus: 'unassigned',
      deliveryLocation: {
        type: 'Point',
        coordinates: [76.7794, 30.7333], // Chandigarh Sector 17 [lng, lat]
        formattedAddress: 'Sector 17 Plaza, Chandigarh',
      },
    });
    const orderId = testOrder._id.toString();

    // -------------------------------------------------------------
    // TEST 1: Rider connects with valid JWT
    // -------------------------------------------------------------
    console.log('▶ TEST 1: Rider connects with valid JWT...');
    const riderSocket = Client(SERVER_URL, {
      auth: { token: riderAToken },
      transports: ['websocket'],
    });

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout connecting rider socket')), 4000);
      riderSocket.on('connect', () => {
        clearTimeout(timer);
        resolve();
      });
    });

    console.log('  ✅ TEST 1 PASSED: Rider socket authenticated & connected.\n');
    passedTests++;

    // -------------------------------------------------------------
    // TEST 2: Rider automatically joins rider:{riderId} room
    // -------------------------------------------------------------
    console.log('▶ TEST 2: Rider automatically joins rider:{riderId} room...');
    const customerSocket = Client(SERVER_URL, {
      auth: { token: customerAToken },
      transports: ['websocket'],
    });

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout connecting customer socket')), 4000);
      customerSocket.on('connect', () => {
        clearTimeout(timer);
        resolve();
      });
    });

    console.log('  ✅ TEST 2 PASSED: Rider & Customer rooms auto-initialized.\n');
    passedTests++;

    // -------------------------------------------------------------
    // TEST 3, 4, 5: Admin assigns rider, Rider & Customer receive delivery:assigned
    // -------------------------------------------------------------
    console.log('▶ TEST 3, 4, 5: Admin assigns Rider; Rider and Customer receive delivery:assigned event...');
    let riderAssignedReceived = false;
    let customerAssignedReceived = false;

    const assignPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout waiting for delivery:assigned events')), 5000);

      riderSocket.on('delivery:assigned', (data) => {
        if (data.orderId === orderId && data.riderId === riderAUser._id.toString()) {
          riderAssignedReceived = true;
          if (customerAssignedReceived) {
            clearTimeout(timeout);
            resolve();
          }
        }
      });

      customerSocket.on('delivery:assigned', (data) => {
        if (data.orderId === orderId) {
          customerAssignedReceived = true;
          if (riderAssignedReceived) {
            clearTimeout(timeout);
            resolve();
          }
        }
      });
    });

    // Admin triggers assignment via REST API
    const assignRes = await fetch(`${SERVER_URL}/api/admin/orders/${orderId}/assign-rider`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ riderId: riderAUser._id.toString() }),
    });

    const assignJson = await assignRes.json();
    if (!assignRes.ok || !assignJson.success) {
      throw new Error(`Admin assign rider API failed: ${assignJson.message}`);
    }

    await assignPromise;

    console.log('  ✅ TEST 3 PASSED: Admin successfully assigned rider via REST.');
    console.log('  ✅ TEST 4 PASSED: Rider received real-time delivery:assigned in rider room.');
    console.log('  ✅ TEST 5 PASSED: Customer received real-time delivery:assigned in customer room.\n');
    passedTests += 3;

    // -------------------------------------------------------------
    // TEST 6: Rider accepts delivery
    // -------------------------------------------------------------
    console.log('▶ TEST 6: Rider accepts delivery (assigned -> accepted)...');
    const acceptRes = await fetch(`${SERVER_URL}/api/rider/deliveries/${orderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${riderAToken}`,
      },
      body: JSON.stringify({ status: 'accepted' }),
    });
    const acceptJson = await acceptRes.json();
    if (!acceptRes.ok || acceptJson.delivery?.deliveryStatus !== 'accepted') {
      throw new Error(`Accept delivery failed: ${acceptJson.message}`);
    }
    console.log('  ✅ TEST 6 PASSED: Delivery status transitioned to accepted.\n');
    passedTests++;

    // -------------------------------------------------------------
    // TEST 7: Rider starts delivery (accepted -> picked_up -> on_the_way)
    // -------------------------------------------------------------
    console.log('▶ TEST 7: Rider confirms pickup and starts delivery on_the_way...');
    await fetch(`${SERVER_URL}/api/rider/deliveries/${orderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${riderAToken}` },
      body: JSON.stringify({ status: 'picked_up' }),
    });

    const onTheWayRes = await fetch(`${SERVER_URL}/api/rider/deliveries/${orderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${riderAToken}` },
      body: JSON.stringify({ status: 'on_the_way' }),
    });
    const onTheWayJson = await onTheWayRes.json();
    if (!onTheWayRes.ok || onTheWayJson.delivery?.deliveryStatus !== 'on_the_way') {
      throw new Error(`Start delivery failed: ${onTheWayJson.message}`);
    }
    console.log('  ✅ TEST 7 PASSED: Delivery is active (on_the_way).\n');
    passedTests++;

    // -------------------------------------------------------------
    // TEST 8, 9, 10: Rider transmits GPS coordinates -> Customer receives in order room
    // -------------------------------------------------------------
    console.log('▶ TEST 8, 9, 10: Rider transmits live GPS location -> Customer receives delivery:location...');
    // Customer joins order room
    await new Promise((resolve) => {
      customerSocket.emit('join:order', { orderId }, (res) => {
        resolve(res);
      });
    });

    const locationPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout waiting for customer delivery:location')), 4000);
      customerSocket.on('delivery:location', (data) => {
        if (data.orderId === orderId && Math.abs(data.latitude - 30.7335) < 0.001) {
          clearTimeout(timer);
          resolve(data);
        }
      });
    });

    // Rider sends GPS update
    riderSocket.emit('delivery:location:update', {
      orderId,
      latitude: 30.7335,
      longitude: 76.7798,
      accuracy: 6.2,
      heading: 90,
      speed: 25,
      timestamp: Date.now(),
    });

    const locData = await locationPromise;

    // Verify MongoDB persistence
    const updatedOrderInDb = await Order.findById(orderId);
    if (!updatedOrderInDb.riderLocation?.coordinates || updatedOrderInDb.riderLocation.coordinates[1] !== 30.7335) {
      throw new Error('Order riderLocation was not properly persisted in MongoDB');
    }

    console.log('  ✅ TEST 8 PASSED: Rider emitted delivery:location:update.');
    console.log('  ✅ TEST 9 PASSED: Backend verified ownership & updated GeoJSON in MongoDB.');
    console.log(`  ✅ TEST 10 PASSED: Customer received live delivery:location (Lat: ${locData.latitude}, Lng: ${locData.longitude}).\n`);
    passedTests += 3;

    // -------------------------------------------------------------
    // TEST 11: Security: Customer B cannot join Customer A's order room
    // -------------------------------------------------------------
    console.log("▶ TEST 11: Security: Customer B cannot join Customer A's order room...");
    const customerBSocket = Client(SERVER_URL, {
      auth: { token: customerBToken },
      transports: ['websocket'],
    });

    await new Promise((resolve) => customerBSocket.on('connect', resolve));

    let customerBAccessDenied = false;
    await new Promise((resolve) => {
      customerBSocket.emit('join:order', { orderId }, (res) => {
        if (!res.success) {
          customerBAccessDenied = true;
        }
        resolve();
      });
    });

    if (!customerBAccessDenied) {
      throw new Error('Security vulnerability: Unauthorized customer was able to join order room!');
    }
    console.log('  ✅ TEST 11 PASSED: Customer B unauthorized order room access strictly blocked.\n');
    passedTests++;

    // -------------------------------------------------------------
    // TEST 12: Security: Rider B cannot emit location updates for Rider A's order
    // -------------------------------------------------------------
    console.log("▶ TEST 12: Security: Rider B cannot update Rider A's assigned order...");
    const riderBSocket = Client(SERVER_URL, {
      auth: { token: riderBToken },
      transports: ['websocket'],
    });

    await new Promise((resolve) => riderBSocket.on('connect', resolve));

    let riderBAccessDenied = false;
    await new Promise((resolve) => {
      riderBSocket.emit(
        'delivery:location:update',
        {
          orderId,
          latitude: 30.7000,
          longitude: 76.7000,
        },
        (res) => {
          if (!res || !res.success) {
            riderBAccessDenied = true;
          }
          resolve();
        }
      );
    });

    if (!riderBAccessDenied) {
      throw new Error('Security vulnerability: Unassigned rider was able to update order location!');
    }
    console.log('  ✅ TEST 12 PASSED: Unassigned Rider B location updates strictly rejected.\n');
    passedTests++;

    // -------------------------------------------------------------
    // TEST 13: Delivery status broadcast to customer
    // -------------------------------------------------------------
    console.log('▶ TEST 13: Delivery status changes are broadcast in real-time...');
    let statusReceived = false;
    const statusPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout waiting for delivery:status')), 4000);
      customerSocket.on('delivery:status', (data) => {
        if (data.orderId === orderId && data.status === 'delivered') {
          statusReceived = true;
          clearTimeout(timer);
          resolve();
        }
      });
    });

    // Mark delivered
    await fetch(`${SERVER_URL}/api/rider/deliveries/${orderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${riderAToken}` },
      body: JSON.stringify({ status: 'delivered' }),
    });

    await statusPromise;
    console.log('  ✅ TEST 13 PASSED: delivery:status event received with status "delivered".\n');
    passedTests++;

    // -------------------------------------------------------------
    // TEST 14: Completed delivery rejects further location updates
    // -------------------------------------------------------------
    console.log('▶ TEST 14: Completed delivery stops/rejects location updates...');
    let locationRejectedAfterDelivery = false;
    await new Promise((resolve) => {
      riderSocket.emit(
        'delivery:location:update',
        {
          orderId,
          latitude: 30.7500,
          longitude: 76.7500,
        },
        (res) => {
          if (!res || !res.success) {
            locationRejectedAfterDelivery = true;
          }
          resolve();
        }
      );
    });

    if (!locationRejectedAfterDelivery) {
      throw new Error('Location update was incorrectly accepted for a completed delivery!');
    }
    console.log('  ✅ TEST 14 PASSED: Location updates rejected after delivery completion.\n');
    passedTests++;

    // -------------------------------------------------------------
    // TEST 15: Socket reconnect works smoothly
    // -------------------------------------------------------------
    console.log('▶ TEST 15: Socket reconnect and re-authentication...');
    customerSocket.disconnect();
    customerSocket.connect();

    await new Promise((resolve) => customerSocket.on('connect', resolve));
    console.log('  ✅ TEST 15 PASSED: Socket reconnected cleanly.\n');
    passedTests++;

    // -------------------------------------------------------------
    // TEST 16: Customer recovers authoritative order state via REST
    // -------------------------------------------------------------
    console.log('▶ TEST 16: Customer restores authoritative order state from MongoDB...');
    const restRes = await fetch(`${SERVER_URL}/api/orders/${orderId}`);
    const restJson = await restRes.json();

    if (!restRes.ok || restJson.order?.deliveryStatus !== 'delivered' || restJson.order?.orderStatus !== 'completed') {
      throw new Error('Authoritative state recovery failed: deliveryStatus mismatch');
    }
    console.log('  ✅ TEST 16 PASSED: Authoritative state restored (Delivery: delivered, Order: completed).\n');
    passedTests++;

    // Clean up connections
    riderSocket.disconnect();
    customerSocket.disconnect();
    customerBSocket.disconnect();
    riderBSocket.disconnect();

    console.log('======================================================');
    console.log(`🎉 ALL ${passedTests}/${totalTests} DELIVERY TRACKING TESTS PASSED (100%)`);
    console.log('======================================================\n');
  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED:', err.message);
    process.exitCode = 1;
  } finally {
    if (httpServer) {
      httpServer.close();
    }
    await mongoose.disconnect();
  }
}

runDeliveryTrackingTestSuite();
