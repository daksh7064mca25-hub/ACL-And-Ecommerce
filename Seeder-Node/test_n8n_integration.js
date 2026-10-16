const http = require('http');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Order = require('./src/models/Order');
const Product = require('./src/models/Product');
const { sendOrderNotification, formatOrderPayload } = require('./src/services/n8nService');
const { handleStripeWebhook } = require('./src/controllers/webhookController');

/**
 * Helper to run an in-process mock HTTP server to simulate n8n webhook endpoint
 */
function createMockN8nServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({
        server,
        url: `http://127.0.0.1:${port}/webhook/test-order`,
        close: () => new Promise((res) => server.close(res)),
      });
    });
  });
}

async function runN8nIntegrationTests() {
  console.log('========================================================');
  console.log('  STARTING N8N WEBHOOK INTEGRATION TEST SUITE');
  console.log('========================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passedTests++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // -------------------------------------------------------------
  // Test 1: Payload Formatting with Existing Model Fields
  // -------------------------------------------------------------
  console.log('[Test 1] Verifying formatOrderPayload() uses only existing model fields...');
  const mockOrderDoc = {
    _id: new mongoose.Types.ObjectId('6ad1b3bfe6fbb0b4986e3d42'),
    customerEmail: 'customer@example.com',
    customerName: 'Daksh Sharma',
    totalAmount: 1499.5,
    currency: 'INR',
    orderStatus: 'confirmed',
    paymentStatus: 'paid',
    createdAt: new Date('2026-10-16T10:00:00.000Z'),
  };

  const payload = formatOrderPayload('checkout.session.completed', mockOrderDoc);

  assert(payload.event === 'checkout.session.completed', 'Payload event matches verified event name');
  assert(payload.orderId === '6ad1b3bfe6fbb0b4986e3d42', 'Payload orderId is properly stringified');
  assert(payload.customerName === 'Daksh Sharma', 'Payload customerName matches order.customerName');
  assert(payload.customerEmail === 'customer@example.com', 'Payload customerEmail matches order.customerEmail');
  assert(payload.totalAmount === 1499.5, 'Payload totalAmount matches order.totalAmount');
  assert(payload.currency === 'inr', 'Payload currency is normalized');
  assert(payload.orderStatus === 'confirmed', 'Payload orderStatus matches order.orderStatus');
  assert(payload.paymentStatus === 'paid', 'Payload paymentStatus matches order.paymentStatus');

  // -------------------------------------------------------------
  // Test 2: Graceful Skip when N8N_ORDER_WEBHOOK_URL is Unset
  // -------------------------------------------------------------
  console.log('\n[Test 2] Verifying safe skip when N8N_ORDER_WEBHOOK_URL is not set...');
  const originalEnvUrl = process.env.N8N_ORDER_WEBHOOK_URL;
  delete process.env.N8N_ORDER_WEBHOOK_URL;

  const skippedResult = await sendOrderNotification('checkout.session.completed', mockOrderDoc);
  assert(skippedResult.success === false, 'Skipped result has success: false');
  assert(skippedResult.skipped === true, 'Skipped result explicitly indicates skipped: true');

  // Restore env
  if (originalEnvUrl) process.env.N8N_ORDER_WEBHOOK_URL = originalEnvUrl;

  // -------------------------------------------------------------
  // Test 3: Header Auth and Payload Delivery to Mock n8n Webhook
  // -------------------------------------------------------------
  console.log('\n[Test 3] Verifying Header Auth (x-experto-webhook-secret) and successful POST delivery...');
  let receivedHeaders = null;
  let receivedBody = null;
  const testSecret = 'experto-test-n8n-secret-987654';

  const mockN8n = await createMockN8nServer(async (req, res) => {
    receivedHeaders = req.headers;
    let bodyData = '';
    req.on('data', (chunk) => {
      bodyData += chunk;
    });
    req.on('end', () => {
      receivedBody = JSON.parse(bodyData);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Workflow received successfully' }));
    });
  });

  try {
    const successResult = await sendOrderNotification(
      'checkout.session.completed',
      mockOrderDoc,
      {
        webhookUrl: mockN8n.url,
        webhookSecret: testSecret,
      }
    );

    assert(successResult.success === true, 'sendOrderNotification returns success: true on 200 OK');
    assert(successResult.status === 200, 'sendOrderNotification reports status: 200');
    assert(
      receivedHeaders['x-experto-webhook-secret'] === testSecret,
      'x-experto-webhook-secret header matches configured secret'
    );
    assert(receivedHeaders['content-type'] === 'application/json', 'Content-Type is application/json');
    assert(receivedBody.orderId === '6ad1b3bfe6fbb0b4986e3d42', 'Body delivered matches orderId');
    assert(receivedBody.event === 'checkout.session.completed', 'Body delivered matches event name');
  } finally {
    await mockN8n.close();
  }

  // -------------------------------------------------------------
  // Test 4: Timeout Handling (Non-blocking and Safe)
  // -------------------------------------------------------------
  console.log('\n[Test 4] Verifying timeout handling aborts safely without throwing...');
  const hangingMock = await createMockN8nServer((req, res) => {
    // Deliberately delay response longer than timeoutMs
    setTimeout(() => {
      res.writeHead(200);
      res.end('delayed');
    }, 500);
  });

  try {
    const timeoutResult = await sendOrderNotification(
      'checkout.session.completed',
      mockOrderDoc,
      {
        webhookUrl: hangingMock.url,
        webhookSecret: testSecret,
        timeoutMs: 100, // Short timeout
      }
    );

    assert(timeoutResult.success === false, 'Timeout returns success: false');
    assert(
      timeoutResult.error && timeoutResult.error.includes('timed out'),
      'Timeout error message indicates timeout'
    );
  } finally {
    await hangingMock.close();
  }

  // -------------------------------------------------------------
  // Test 5: HTTP Error Handling (Non-blocking, Non-throwing)
  // -------------------------------------------------------------
  console.log('\n[Test 5] Verifying 500 server error handling...');
  const errorMock = await createMockN8nServer((req, res) => {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal n8n workflow execution error' }));
  });

  try {
    const errResult = await sendOrderNotification(
      'checkout.session.completed',
      mockOrderDoc,
      {
        webhookUrl: errorMock.url,
        webhookSecret: testSecret,
      }
    );

    assert(errResult.success === false, 'Error response returns success: false');
    assert(errResult.status === 500, 'Reports status 500');
  } finally {
    await errorMock.close();
  }

  // -------------------------------------------------------------
  // Test 6: Database Idempotency & Webhook Integration
  // -------------------------------------------------------------
  console.log('\n[Test 6] Verifying Webhook Controller Idempotency in MongoDB...');
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/seeder_demo_db');
  }

  // Create test product with 20 stock
  const testProduct = await Product.create({
    title: `n8n Test Product ${Date.now()}`,
    price: 250,
    quantity: 20,
    images: ['/test.png'],
  });

  // Create pending order
  const testOrder = await Order.create({
    customerEmail: 'test.n8n@example.com',
    customerName: 'Test Buyer',
    items: [
      {
        product: testProduct._id,
        title: testProduct.title,
        priceAtPurchase: 250,
        quantity: 2,
        image: '/test.png',
      },
    ],
    subtotalAmount: 500,
    totalAmount: 500,
    currency: 'inr',
    paymentStatus: 'pending',
    orderStatus: 'pending',
    stripeCheckoutSessionId: `cs_test_n8n_${Date.now()}`,
    n8nNotificationSent: false,
  });

  assert(testOrder.n8nNotificationSent === false, 'New order has n8nNotificationSent: false');
  assert(testOrder.n8nNotificationSentAt === null, 'New order has n8nNotificationSentAt: null');

  // Start mock n8n server to count dispatches
  let dispatchCount = 0;
  const countingMock = await createMockN8nServer((req, res) => {
    dispatchCount++;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  });

  // Temporarily point process.env to countingMock
  process.env.N8N_ORDER_WEBHOOK_URL = countingMock.url;
  process.env.N8N_ORDER_WEBHOOK_SECRET = 'n8n-verified-secret';

  try {
    // Construct fake Stripe checkout.session.completed event
    const fakeStripeEvent = {
      id: `evt_test_${Date.now()}`,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: testOrder.stripeCheckoutSessionId,
          payment_intent: `pi_test_${Date.now()}`,
          payment_status: 'paid',
          metadata: { orderId: testOrder._id.toString() },
          customer_details: {
            name: 'Test Buyer',
            email: 'test.n8n@example.com',
          },
        },
      },
    };

    // Mock Express req and res
    const mockReq = {
      headers: { 'stripe-signature': 'mock_sig' },
      body: fakeStripeEvent,
      rawBody: JSON.stringify(fakeStripeEvent),
    };

    let responseStatusCode = null;
    let responseData = null;
    const mockRes = {
      status(code) {
        responseStatusCode = code;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      },
      send(data) {
        responseData = data;
        return this;
      },
    };

    // Temporarily clear STRIPE_WEBHOOK_SECRET so webhookController parses raw body directly
    const originalStripeSecret = process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_WEBHOOK_SECRET = '';

    try {
      // 1st delivery of Stripe webhook
      await handleStripeWebhook(mockReq, mockRes);

      assert(responseStatusCode === 200, 'Stripe webhook returns HTTP 200 on first delivery');

      // Verify Order is updated in DB
      const updatedOrder = await Order.findById(testOrder._id);
      assert(updatedOrder.paymentStatus === 'paid', 'Order paymentStatus updated to paid');
      assert(updatedOrder.orderStatus === 'confirmed', 'Order orderStatus updated to confirmed');
      assert(updatedOrder.n8nNotificationSent === true, 'Order n8nNotificationSent is updated to true');
      assert(updatedOrder.n8nNotificationSentAt !== null, 'Order n8nNotificationSentAt timestamp is recorded');
      assert(dispatchCount === 1, 'n8n mock server was called exactly once');

      // Check product inventory was decremented by 2
      const updatedProd = await Product.findById(testProduct._id);
      assert(updatedProd.quantity === 18, `Stock decremented from 20 to 18 (actual: ${updatedProd.quantity})`);

      // -------------------------------------------------------------
      // Test 7: Duplicate Stripe Delivery (Idempotency Guard)
      // -------------------------------------------------------------
      console.log('\n[Test 7] Verifying Stripe retry does not trigger duplicate n8n notification...');
      let retryStatusCode = null;
      let retryData = null;
      const retryRes = {
        status(code) {
          retryStatusCode = code;
          return this;
        },
        json(data) {
          retryData = data;
          return this;
        },
      };

      // 2nd delivery of the same Stripe webhook
      await handleStripeWebhook(mockReq, retryRes);

      assert(retryStatusCode === 200, 'Stripe webhook retry returns HTTP 200');
      assert(dispatchCount === 1, 'n8n notification was NOT resent on retry (idempotent)');

      // Inventory must NOT be decremented again
      const productAfterRetry = await Product.findById(testProduct._id);
      assert(
        productAfterRetry.quantity === 18,
        `Inventory remains 18 after webhook retry (actual: ${productAfterRetry.quantity})`
      );

      // -------------------------------------------------------------
      // Test 8: Failure Isolation (Failed n8n must not reverse payment or break order)
      // -------------------------------------------------------------
      console.log('\n[Test 8] Verifying n8n failure does NOT break order or payment status...');
      // Create a second pending order
      const failedMockOrder = await Order.create({
        customerEmail: 'failed.n8n@example.com',
        customerName: 'Failure Isolation Tester',
        items: [
          {
            product: testProduct._id,
            title: testProduct.title,
            priceAtPurchase: 250,
            quantity: 1,
            image: '/test.png',
          },
        ],
        subtotalAmount: 250,
        totalAmount: 250,
        currency: 'inr',
        paymentStatus: 'pending',
        orderStatus: 'pending',
        stripeCheckoutSessionId: `cs_test_n8n_fail_${Date.now()}`,
        n8nNotificationSent: false,
      });

      // Point webhook to a non-existent port that will fail connection
      process.env.N8N_ORDER_WEBHOOK_URL = 'http://127.0.0.1:1';

      const failStripeEvent = {
        id: `evt_test_fail_${Date.now()}`,
        type: 'checkout.session.completed',
        data: {
          object: {
            id: failedMockOrder.stripeCheckoutSessionId,
            payment_intent: `pi_test_fail_${Date.now()}`,
            payment_status: 'paid',
            metadata: { orderId: failedMockOrder._id.toString() },
            customer_details: {
              name: 'Failure Tester',
              email: 'failed.n8n@example.com',
            },
          },
        },
      };

      const failReq = {
        headers: { 'stripe-signature': 'mock_sig' },
        body: failStripeEvent,
        rawBody: JSON.stringify(failStripeEvent),
      };

      let failResCode = null;
      const failRes = {
        status(code) {
          failResCode = code;
          return this;
        },
        json(data) {
          return this;
        },
      };

      await handleStripeWebhook(failReq, failRes);

      assert(failResCode === 200, 'Stripe webhook returns 200 even if n8n endpoint fails');
      const savedFailOrder = await Order.findById(failedMockOrder._id);
      assert(savedFailOrder.paymentStatus === 'paid', 'Order payment is still marked as paid');
      assert(savedFailOrder.orderStatus === 'confirmed', 'Order is still confirmed');
      assert(savedFailOrder.n8nNotificationSent === false, 'n8nNotificationSent remains false on failure');

      const prodAfterFail = await Product.findById(testProduct._id);
      assert(
        prodAfterFail.quantity === 17,
        `Inventory was still decremented from 18 to 17 (actual: ${prodAfterFail.quantity})`
      );
    } finally {
      process.env.STRIPE_WEBHOOK_SECRET = originalStripeSecret;
    }
  } finally {
    await countingMock.close();
    // Clean up test data
    await Order.deleteMany({ customerEmail: { $in: ['test.n8n@example.com', 'failed.n8n@example.com'] } });
    await Product.findByIdAndDelete(testProduct._id);
    await mongoose.connection.close();
  }

  console.log('\n========================================================');
  console.log(`  ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
  console.log('========================================================\n');
}

runN8nIntegrationTests().catch((err) => {
  console.error('\nTest suite failed with error:', err);
  process.exit(1);
});
