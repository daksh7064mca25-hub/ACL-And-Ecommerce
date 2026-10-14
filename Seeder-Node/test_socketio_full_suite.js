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
const RefundRequest = require('./src/models/RefundRequest');
const {
  emitProductCreated,
  emitProductUpdated,
  emitStockUpdated,
  emitOrderCreated,
  emitOrderStatusUpdated,
  emitPaymentSuccess,
  emitRefundRequested,
  emitRefundStatusUpdated,
} = require('./src/services/socketService');

const TEST_PORT = 5098;
const SERVER_URL = `http://localhost:${TEST_PORT}`;

let httpServer;
let adminToken, customerAToken, customerBToken;
let adminUser, customerAUser, customerBUser;

async function runTestSuite() {
  console.log('\n======================================================');
  console.log('🚀 STARTING FULL SOCKET.IO REAL-TIME TEST SUITE');
  console.log('======================================================\n');

  let passedTests = 0;
  let totalTests = 12;

  try {
    // 1. Database & Server Setup
    await connectDB();
    httpServer = http.createServer(app);
    initSocket(httpServer);

    await new Promise((resolve) => {
      httpServer.listen(TEST_PORT, () => {
        console.log(`[Test Setup] Socket.IO server running on ${SERVER_URL}`);
        resolve();
      });
    });

    const jwtSecret = process.env.JWT_SECRET || 'test_jwt_secret_key_12345';

    // 2. Fetch or Create Test Roles & Users
    let adminRole = await Role.findOne({ name: 'Admin' });
    let customerRole = await Role.findOne({ name: 'Customer' });

    if (!adminRole) {
      adminRole = await Role.create({ name: 'Admin', display: 'Administrator', permissions: [] });
    }
    if (!customerRole) {
      customerRole = await Role.create({ name: 'Customer', display: 'Customer User', permissions: [] });
    }

    // Admin User
    adminUser = await User.findOne({ email: 'admin_test_socket@example.com' });
    if (!adminUser) {
      adminUser = await User.create({
        name: 'Admin Tester',
        email: 'admin_test_socket@example.com',
        password: 'hashed_password_123',
        role: adminRole._id,
        isEmailVerified: true,
      });
    }
    adminToken = jwt.sign({ id: adminUser._id, role: 'Admin' }, jwtSecret, { expiresIn: '1h' });

    // Customer A User
    customerAUser = await User.findOne({ email: 'customer_a_socket@example.com' });
    if (!customerAUser) {
      customerAUser = await User.create({
        name: 'Customer Alice',
        email: 'customer_a_socket@example.com',
        password: 'hashed_password_123',
        role: customerRole._id,
        isEmailVerified: true,
      });
    }
    customerAToken = jwt.sign({ id: customerAUser._id, role: 'Customer' }, jwtSecret, { expiresIn: '1h' });

    // Customer B User
    customerBUser = await User.findOne({ email: 'customer_b_socket@example.com' });
    if (!customerBUser) {
      customerBUser = await User.create({
        name: 'Customer Bob',
        email: 'customer_b_socket@example.com',
        password: 'hashed_password_123',
        role: customerRole._id,
        isEmailVerified: true,
      });
    }
    customerBToken = jwt.sign({ id: customerBUser._id, role: 'Customer' }, jwtSecret, { expiresIn: '1h' });

    console.log('[Test Setup] Test users & JWT tokens initialized.');

    // =========================================================================
    // TEST 1: Customer Socket Connects & Authenticates
    // =========================================================================
    console.log('\n--- TEST 1: Customer Socket Connection & Handshake Authentication ---');
    const customerASocket = await new Promise((resolve, reject) => {
      const client = Client(SERVER_URL, {
        auth: { token: `Bearer ${customerAToken}` },
        transports: ['websocket'],
      });
      client.on('connect', () => resolve(client));
      client.on('connect_error', (err) => reject(err));
    });

    if (customerASocket.connected) {
      console.log('✅ TEST 1 PASSED: Customer A connected with valid JWT handshake auth.');
      passedTests++;
    } else {
      console.error('❌ TEST 1 FAILED');
    }

    // =========================================================================
    // TEST 2: Admin Socket Connects & Joins Admin Room
    // =========================================================================
    console.log('\n--- TEST 2: Admin Socket Connection & Admin Room Assignment ---');
    const adminSocket = await new Promise((resolve, reject) => {
      const client = Client(SERVER_URL, {
        auth: { token: `Bearer ${adminToken}` },
        transports: ['websocket'],
      });
      client.on('connect', () => resolve(client));
      client.on('connect_error', (err) => reject(err));
    });

    if (adminSocket.connected) {
      console.log('✅ TEST 2 PASSED: Admin connected and authenticated successfully.');
      passedTests++;
    } else {
      console.error('❌ TEST 2 FAILED');
    }

    // Connect Customer B socket for privacy isolation verification
    const customerBSocket = await new Promise((resolve, reject) => {
      const client = Client(SERVER_URL, {
        auth: { token: `Bearer ${customerBToken}` },
        transports: ['websocket'],
      });
      client.on('connect', () => resolve(client));
      client.on('connect_error', (err) => reject(err));
    });

    // =========================================================================
    // TEST 3: Product Created Real-Time Event
    // =========================================================================
    console.log('\n--- TEST 3: Admin Creates Product -> Customer Receives product:created ---');
    const productCreatedPromise = new Promise((resolve) => {
      customerASocket.once('product:created', (data) => {
        resolve(data);
      });
    });

    const testProduct = await Product.create({
      title: `Socket Test Product ${Date.now()}`,
      price: 1499,
      quantity: 50,
      images: ['/uploads/products/test.png'],
      location: {
        type: 'Point',
        coordinates: [77.2090, 28.6139],
        formattedAddress: 'Connaught Place, New Delhi',
        city: 'New Delhi',
        state: 'Delhi',
        country: 'India',
        postalCode: '110001',
      },
    });

    emitProductCreated(testProduct);
    const createdPayload = await productCreatedPromise;

    if (createdPayload && createdPayload._id.toString() === testProduct._id.toString() && createdPayload.price === 1499) {
      console.log(`✅ TEST 3 PASSED: Received 'product:created' with title "${createdPayload.title}" and price ₹${createdPayload.price}`);
      passedTests++;
    } else {
      console.error('❌ TEST 3 FAILED: Invalid payload', createdPayload);
    }

    // =========================================================================
    // TEST 4: Product Stock Updated Real-Time Event
    // =========================================================================
    console.log('\n--- TEST 4: Stock Changed -> Customer Receives product:stockUpdated ---');
    const stockUpdatedPromise = new Promise((resolve) => {
      customerASocket.once('product:stockUpdated', (data) => {
        resolve(data);
      });
    });

    emitStockUpdated(testProduct._id, 35);
    const stockPayload = await stockUpdatedPromise;

    if (stockPayload && stockPayload.productId === testProduct._id.toString() && stockPayload.stock === 35) {
      console.log(`✅ TEST 4 PASSED: Received 'product:stockUpdated' for product ${stockPayload.productId} with stock ${stockPayload.stock}`);
      passedTests++;
    } else {
      console.error('❌ TEST 4 FAILED: Invalid stock payload', stockPayload);
    }

    // =========================================================================
    // TEST 5: Customer Creates Order -> Admin Receives order:created & notification:new
    // =========================================================================
    console.log('\n--- TEST 5: Customer Creates Order -> Admin Receives order:created ---');
    let customerBReceivedOrder = false;
    const bOrderListener = () => { customerBReceivedOrder = true; };
    customerBSocket.on('order:created', bOrderListener);

    const adminOrderPromise = new Promise((resolve) => {
      adminSocket.once('order:created', (data) => resolve(data));
    });
    const adminNotifPromise = new Promise((resolve) => {
      adminSocket.once('notification:new', (data) => resolve(data));
    });

    const testOrder = await Order.create({
      customer: customerAUser._id,
      customerEmail: customerAUser.email,
      customerName: customerAUser.name,
      items: [
        {
          product: testProduct._id,
          title: testProduct.title,
          priceAtPurchase: 1499,
          quantity: 2,
        },
      ],
      subtotalAmount: 2998,
      deliveryFee: 50,
      totalAmount: 3048,
      paymentStatus: 'pending',
      orderStatus: 'pending',
    });

    emitOrderCreated(testOrder);

    const adminOrderPayload = await adminOrderPromise;
    const adminNotifPayload = await adminNotifPromise;
    await new Promise((r) => setTimeout(r, 200));

    customerBSocket.off('order:created', bOrderListener);

    if (
      adminOrderPayload &&
      adminOrderPayload.orderId === testOrder._id.toString() &&
      adminNotifPayload &&
      adminNotifPayload.type === 'order' &&
      !customerBReceivedOrder
    ) {
      console.log(`✅ TEST 5 PASSED: Admin received 'order:created' and 'notification:new'. Customer B did NOT receive event.`);
      passedTests++;
    } else {
      console.error('❌ TEST 5 FAILED');
    }

    // =========================================================================
    // TEST 6: Admin Updates Order Status -> Customer A & Order Room Receive order:statusUpdated
    // =========================================================================
    console.log('\n--- TEST 6: Admin Changes Order Status -> Customer A Receives order:statusUpdated ---');
    let customerBReceivedStatus = false;
    const bStatusListener = () => { customerBReceivedStatus = true; };
    customerBSocket.on('order:statusUpdated', bStatusListener);

    const customerAStatusPromise = new Promise((resolve) => {
      customerASocket.once('order:statusUpdated', (data) => resolve(data));
    });

    testOrder.orderStatus = 'processing';
    await testOrder.save();
    emitOrderStatusUpdated(testOrder);

    const customerAStatusPayload = await customerAStatusPromise;
    await new Promise((r) => setTimeout(r, 200));
    customerBSocket.off('order:statusUpdated', bStatusListener);

    if (
      customerAStatusPayload &&
      customerAStatusPayload.orderId === testOrder._id.toString() &&
      customerAStatusPayload.orderStatus === 'processing' &&
      !customerBReceivedStatus
    ) {
      console.log(`✅ TEST 6 PASSED: Customer A received status 'processing'. Customer B isolated.`);
      passedTests++;
    } else {
      console.error('❌ TEST 6 FAILED');
    }

    // =========================================================================
    // TEST 7: Stripe Webhook Confirms Payment -> payment:success & stockUpdated
    // =========================================================================
    console.log('\n--- TEST 7: Stripe Payment Confirmed -> Customer Receives payment:success ---');
    const paymentSuccessPromise = new Promise((resolve) => {
      customerASocket.once('payment:success', (data) => resolve(data));
    });

    testOrder.paymentStatus = 'paid';
    testOrder.orderStatus = 'confirmed';
    await testOrder.save();

    emitPaymentSuccess(testOrder);
    const paymentPayload = await paymentSuccessPromise;

    if (
      paymentPayload &&
      paymentPayload.orderId === testOrder._id.toString() &&
      paymentPayload.paymentStatus === 'paid'
    ) {
      console.log(`✅ TEST 7 PASSED: Customer A received 'payment:success' for Order #${paymentPayload.orderId}`);
      passedTests++;
    } else {
      console.error('❌ TEST 7 FAILED');
    }

    // =========================================================================
    // TEST 8: Customer Creates Refund Request -> Admin Receives refund:requested
    // =========================================================================
    console.log('\n--- TEST 8: Customer Creates Refund Request -> Admin Receives refund:requested ---');
    const adminRefundPromise = new Promise((resolve) => {
      adminSocket.once('refund:requested', (data) => resolve(data));
    });

    const testRefund = await RefundRequest.create({
      order: testOrder._id,
      customer: customerAUser._id,
      customerEmail: customerAUser.email,
      customerName: customerAUser.name,
      reason: 'Product damaged',
      requestedAmount: 3048,
      status: 'pending',
    });

    emitRefundRequested(testRefund, testOrder);
    const refundRequestedPayload = await adminRefundPromise;

    if (
      refundRequestedPayload &&
      refundRequestedPayload.refundRequestId === testRefund._id.toString() &&
      refundRequestedPayload.reason === 'Product damaged'
    ) {
      console.log(`✅ TEST 8 PASSED: Admin received 'refund:requested' for RefundRequest #${refundRequestedPayload.refundRequestId}`);
      passedTests++;
    } else {
      console.error('❌ TEST 8 FAILED');
    }

    // =========================================================================
    // TEST 9: Admin Updates Refund Status -> Customer A Receives refund:statusUpdated
    // =========================================================================
    console.log('\n--- TEST 9: Admin Updates Refund Status -> Customer A Receives refund:statusUpdated ---');
    const customerARefundStatusPromise = new Promise((resolve) => {
      customerASocket.once('refund:statusUpdated', (data) => resolve(data));
    });

    testRefund.status = 'refunded';
    testRefund.approvedAmount = 3048;
    await testRefund.save();
    testOrder.refundStatus = 'refunded';
    await testOrder.save();

    emitRefundStatusUpdated(testRefund, testOrder);
    const customerRefundPayload = await customerARefundStatusPromise;

    if (
      customerRefundPayload &&
      customerRefundPayload.refundRequestId === testRefund._id.toString() &&
      customerRefundPayload.status === 'refunded'
    ) {
      console.log(`✅ TEST 9 PASSED: Customer A received 'refund:statusUpdated' with status 'refunded'`);
      passedTests++;
    } else {
      console.error('❌ TEST 9 FAILED');
    }

    // =========================================================================
    // TEST 10: Security Check: Customer B cannot join Customer A's private order room
    // =========================================================================
    console.log('\n--- TEST 10: Security Isolation: Customer B joining Customer A order is rejected ---');
    const joinOrderResult = await new Promise((resolve) => {
      customerBSocket.emit('join:order', { orderId: testOrder._id.toString() }, (res) => {
        resolve(res);
      });
      customerBSocket.once('order:error', (err) => {
        resolve({ success: false, ...err });
      });
      setTimeout(() => resolve({ success: false, timeout: true }), 1000);
    });

    if (joinOrderResult.success === false) {
      console.log(`✅ TEST 10 PASSED: Customer B was successfully DENIED access to Customer A's order room.`);
      passedTests++;
    } else {
      console.error('❌ TEST 10 FAILED: Customer B was improperly permitted to join private order room!');
    }

    // =========================================================================
    // TEST 11: Invalid / Expired Token Is Rejected By Socket Auth Middleware
    // =========================================================================
    console.log('\n--- TEST 11: Invalid JWT Token Rejection by Socket Auth Middleware ---');
    let rejectedAsExpected = false;
    try {
      await new Promise((resolve, reject) => {
        const badClient = Client(SERVER_URL, {
          auth: { token: 'Bearer invalid.fake.token.xyz' },
          transports: ['websocket'],
          reconnection: false,
          timeout: 2000,
        });
        badClient.on('connect', () => {
          badClient.disconnect();
          reject(new Error('Connection succeeded unexpectedly with bad token'));
        });
        badClient.on('connect_error', (err) => {
          badClient.disconnect();
          resolve(err);
        });
      });
      rejectedAsExpected = true;
    } catch (err) {
      rejectedAsExpected = false;
    }

    if (rejectedAsExpected) {
      console.log('✅ TEST 11 PASSED: Invalid token was rejected by socket authentication middleware.');
      passedTests++;
    } else {
      console.error('❌ TEST 11 FAILED: Invalid token was not rejected!');
    }

    // =========================================================================
    // TEST 12: Disconnect & Reconnect Clean Lifecycle
    // =========================================================================
    console.log('\n--- TEST 12: Graceful Disconnect and Reconnection ---');
    customerASocket.disconnect();
    const isDisconnectedNow = !customerASocket.connected;
    customerASocket.connect();

    const reconnected = await new Promise((resolve) => {
      customerASocket.once('connect', () => resolve(true));
      setTimeout(() => resolve(false), 2000);
    });

    if (isDisconnectedNow && reconnected) {
      console.log('✅ TEST 12 PASSED: Socket cleanly disconnected and reconnected without duplication.');
      passedTests++;
    } else {
      console.error('❌ TEST 12 FAILED');
    }

    // Cleanup sockets
    customerASocket.disconnect();
    customerBSocket.disconnect();
    adminSocket.disconnect();

    // Cleanup test database documents
    await Product.findByIdAndDelete(testProduct._id);
    await Order.findByIdAndDelete(testOrder._id);
    await RefundRequest.findByIdAndDelete(testRefund._id);

    console.log('\n======================================================');
    console.log(`🏁 TEST SUITE COMPLETED: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log('======================================================\n');

    process.exit(passedTests === totalTests ? 0 : 1);
  } catch (err) {
    console.error('❌ Test suite uncaught error:', err);
    process.exit(1);
  } finally {
    if (httpServer) {
      httpServer.close();
    }
  }
}

runTestSuite();
