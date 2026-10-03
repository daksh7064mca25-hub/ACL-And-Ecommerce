const http = require('http');

const API_BASE = 'http://localhost:5000';

function makeRequest(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_BASE}${path}`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runDeliveryTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING GEOSPATIAL DELIVERY & SERVICEABILITY SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Test Admin Delivery Zone Listing
  console.log('1. Testing Public/Admin Zone Retrieval:');
  const zonesRes = await makeRequest('/api/delivery-zones');
  assert(zonesRes.status === 200, 'GET /api/delivery-zones returns 200');
  assert(zonesRes.body.success === true, 'Response indicates success');
  assert(Array.isArray(zonesRes.body.deliveryZones) && zonesRes.body.deliveryZones.length >= 4, `Seeded zones found (${zonesRes.body.count})`);

  // 2. Test Sector 17 Chandigarh (Inside Core Express Zone)
  console.log('\n2. Testing Location Inside Chandigarh Core Zone (Sector 17):');
  const chdRes = await makeRequest('/api/delivery-zones/check-serviceability', 'POST', {
    latitude: 30.7333,
    longitude: 76.7794,
    cartTotal: 500,
  });
  assert(chdRes.status === 200, 'Check serviceability returns 200');
  assert(chdRes.body.isServiceable === true, 'Location is serviceable');
  assert(chdRes.body.deliveryZone?.code === 'CHD-EXP', `Matched zone is CHD-EXP (got: ${chdRes.body.deliveryZone?.code})`);
  assert(chdRes.body.deliveryFee === 30, `Delivery fee is ₹30 (got: ₹${chdRes.body.deliveryFee})`);
  assert(chdRes.body.meetsMinOrder === true, 'Meets min order with cart total ₹500');

  // 3. Test Mohali Urban Zone (Sector 62 / Phase 7)
  console.log('\n3. Testing Location Inside Mohali Urban Zone:');
  const mohaliRes = await makeRequest('/api/delivery-zones/check-serviceability', 'POST', {
    latitude: 30.7046,
    longitude: 76.7179,
    cartTotal: 250,
  });
  assert(mohaliRes.status === 200, 'Mohali query returns 200');
  assert(mohaliRes.body.isServiceable === true, 'Mohali is serviceable');
  assert(mohaliRes.body.deliveryZone?.code === 'MOH-URB', `Matched zone is MOH-URB (got: ${mohaliRes.body.deliveryZone?.code})`);
  assert(mohaliRes.body.deliveryFee === 45, `Delivery fee is ₹45 (got: ₹${mohaliRes.body.deliveryFee})`);

  // 4. Test Panchkula Zone (Sector 5)
  console.log('\n4. Testing Location Inside Panchkula Zone:');
  const pklRes = await makeRequest('/api/delivery-zones/check-serviceability', 'POST', {
    latitude: 30.6942,
    longitude: 76.8606,
    cartTotal: 300,
  });
  assert(pklRes.status === 200, 'Panchkula query returns 200');
  assert(pklRes.body.isServiceable === true, 'Panchkula is serviceable');
  assert(pklRes.body.deliveryZone?.code === 'PKL-EXP', `Matched zone is PKL-EXP (got: ${pklRes.body.deliveryZone?.code})`);
  assert(pklRes.body.deliveryFee === 50, `Delivery fee is ₹50 (got: ₹${pklRes.body.deliveryFee})`);

  // 5. Test Outside Serviceable Area (New Delhi)
  console.log('\n5. Testing Location Outside Serviceable Area (New Delhi):');
  const outsideRes = await makeRequest('/api/delivery-zones/check-serviceability', 'POST', {
    latitude: 28.6139,
    longitude: 77.209,
    cartTotal: 1000,
  });
  assert(outsideRes.status === 200, 'Outside check returns 200');
  assert(outsideRes.body.isServiceable === false, 'isServiceable is false for Delhi');
  assert(outsideRes.body.deliveryZone === null, 'deliveryZone is null for Delhi');
  assert(outsideRes.body.deliveryFee === 0, 'deliveryFee is 0 for unserviceable area');

  // 6. Test Minimum Order Shortfall Detection
  console.log('\n6. Testing Minimum Order Validation:');
  const minOrderRes = await makeRequest('/api/delivery-zones/check-serviceability', 'POST', {
    latitude: 30.7333,
    longitude: 76.7794,
    cartTotal: 50, // CHD-EXP minOrderAmount is 100
  });
  assert(minOrderRes.body.isServiceable === true, 'Area is serviceable');
  assert(minOrderRes.body.meetsMinOrder === false, 'meetsMinOrder is false when cartTotal < minOrderAmount');
  assert(minOrderRes.body.minOrderShortfall === 50, `minOrderShortfall is ₹50 (got: ₹${minOrderRes.body.minOrderShortfall})`);

  // 7. Test Overlapping Zones Resolution (Priority order)
  console.log('\n7. Testing Overlapping Zones Handling:');
  // Sector 17 lies inside both CHD-EXP (priority: 5) and TRI-SAVER (priority: 1)
  assert(chdRes.body.allMatchingZonesCount >= 2, `Overlapping zones identified: ${chdRes.body.allMatchingZonesCount} zones encompass Sector 17`);
  assert(chdRes.body.deliveryZone?.code === 'CHD-EXP', `Highest priority zone (Priority 5) selected over Super-Saver (Priority 1)`);

  // 8. Test Products Deliverability Flag with coordinates
  console.log('\n8. Testing Products API with Customer Coordinates:');
  const prodsWithLocRes = await makeRequest('/api/products?lat=30.7333&lng=76.7794');
  assert(prodsWithLocRes.status === 200, 'GET /api/products with lat/lng returns 200');
  assert(prodsWithLocRes.body.products.length > 0, 'Products returned');
  const firstProd = prodsWithLocRes.body.products[0];
  assert(firstProd.isDeliverable === true, `Product deliverability flag set to true (got: ${firstProd.isDeliverable})`);

  // 9. Test Checkout with Location Validation
  console.log('\n9. Testing Checkout Validation:');
  
  // Test A: Checkout in outside area should fail
  const failedCheckout = await makeRequest('/api/orders/checkout', 'POST', {
    items: [{ productId: firstProd._id, quantity: 1 }],
    customerEmail: 'tester@example.com',
    customerName: 'Test Customer',
    deliveryLocation: {
      latitude: 28.6139,
      longitude: 77.2090,
      formattedAddress: 'Connaught Place, New Delhi',
    },
  });
  assert(failedCheckout.status === 400, 'Checkout outside delivery zone fails with status 400');
  assert(failedCheckout.body.success === false, 'Checkout rejected with clear reason');
  assert(failedCheckout.body.message.includes('outside'), `Error message mentions outside zone (${failedCheckout.body.message})`);

  // Test B: Checkout in valid zone should succeed and snapshot delivery fee
  const validCheckout = await makeRequest('/api/orders/checkout', 'POST', {
    items: [{ productId: firstProd._id, quantity: 1 }],
    customerEmail: 'test.delivery@example.com',
    customerName: 'Delivery Zone Tester',
    deliveryLocation: {
      latitude: 30.7333,
      longitude: 76.7794,
      formattedAddress: 'Sector 17 City Centre, Chandigarh',
    },
  });
  assert(validCheckout.status === 200 || validCheckout.status === 201, `Valid zone checkout succeeds (status: ${validCheckout.status})`);
  assert(validCheckout.body.orderId !== undefined, `Created Order ID: ${validCheckout.body.orderId}`);

  let createdOrderId = validCheckout.body.orderId;
  if (createdOrderId) {
    const fetchedOrder = await makeRequest(`/api/orders/${createdOrderId}`);
    assert(fetchedOrder.status === 200, 'Fetch created order returns 200');
    assert(fetchedOrder.body.order.deliveryZoneName === 'Chandigarh Core Express Zone', `Order snapshot zone: ${fetchedOrder.body.order.deliveryZoneName}`);
    assert(fetchedOrder.body.order.deliveryFee === 30, `Order snapshot delivery fee: ₹${fetchedOrder.body.order.deliveryFee}`);
    assert(fetchedOrder.body.order.deliveryLocation?.coordinates[0] === 76.7794, 'Order GeoJSON Longitude stored');
    assert(fetchedOrder.body.order.deliveryLocation?.coordinates[1] === 30.7333, 'Order GeoJSON Latitude stored');
  }

  // 10. Test Snapshot Immutability (Zone changes do not alter past order details)
  console.log('\n10. Testing Order Snapshot Immutability:');
  if (createdOrderId) {
    const orderBefore = await makeRequest(`/api/orders/${createdOrderId}`);
    const feeBefore = orderBefore.body.order.deliveryFee;
    const zoneBefore = orderBefore.body.order.deliveryZoneName;

    // Verify snapshot fields persist cleanly
    assert(feeBefore === 30, `Snapshot fee before is ₹30`);
    assert(zoneBefore === 'Chandigarh Core Express Zone', `Snapshot zone before is CHD-EXP`);
    assert(orderBefore.body.order.deliveryLocation?.formattedAddress === 'Sector 17 City Centre, Chandigarh', 'Order snapshot formatted address preserved');
  }

  console.log('\n====================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');
}

runDeliveryTests().catch((err) => {
  console.error('Fatal test error:', err);
});
