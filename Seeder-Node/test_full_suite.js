const jwt = require('jsonwebtoken');
require('dotenv').config();

async function runCompleteTestSuite() {
  console.log('===============================================================');
  console.log('  COMPREHENSIVE VERIFICATION SUITE: ACL AUTHORIZATION & CORE');
  console.log('===============================================================\n');

  const BASE_URL = 'http://localhost:5000';
  let passedTests = 0;
  let totalTests = 10;

  // TEST 1: Admin Login
  console.log('TEST 1: Admin Login (admin@example.com)...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'Admin@123' }),
  });
  const loginData = await loginRes.json();
  const adminToken = loginData.data?.token;
  if (loginRes.status === 200 && adminToken) {
    console.log('  -> PASSED: Admin received JWT token.');
    passedTests++;
  } else {
    console.error('  -> FAILED: Admin login failed:', loginData);
  }

  // TEST 2: Admin calls GET /api/admin/users (requires users:read)
  console.log('\nTEST 2: Admin calls GET /api/admin/users (users:read)...');
  const usersRes = await fetch(`${BASE_URL}/api/admin/users`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const usersData = await usersRes.json();
  if (usersRes.status === 200 && Array.isArray(usersData.users)) {
    console.log(`  -> PASSED: Returned ${usersData.users.length} customer records.`);
    passedTests++;
  } else {
    console.error('  -> FAILED: Users fetch failed:', usersData);
  }

  // TEST 3: Admin calls POST /api/admin/promotions (requires promotions:send)
  console.log('\nTEST 3: Admin calls POST /api/admin/promotions (promotions:send)...');
  const promoRes = await fetch(`${BASE_URL}/api/admin/promotions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      subject: 'Special ACL Test Campaign',
      html: '<h1>Exclusive ACL Promotion</h1>',
      customerIds: [usersData.users[0]?._id],
    }),
  });
  const promoData = await promoRes.json();
  if (promoRes.status === 200 && promoData.success) {
    console.log(`  -> PASSED: Promotion dispatched to ${promoData.sentCount} customer(s).`);
    passedTests++;
  } else {
    console.error('  -> FAILED: Promo dispatch failed:', promoData);
  }

  // Create a customer token to test unauthorized ACL requests
  const customerUser = usersData.users[0];
  const jwtSecret = process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_in_production_2026';
  const customerToken = jwt.sign({ id: customerUser._id, role: 'Customer' }, jwtSecret, { expiresIn: '1h' });

  // TEST 4: User without users:read calls GET /api/admin/users -> 403
  console.log('\nTEST 4: Customer calls GET /api/admin/users (lacks users:read)...');
  const custUsersRes = await fetch(`${BASE_URL}/api/admin/users`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  const custUsersData = await custUsersRes.json();
  if (custUsersRes.status === 403 && custUsersData.message.includes('permission')) {
    console.log(`  -> PASSED: 403 Forbidden returned ("${custUsersData.message}").`);
    passedTests++;
  } else {
    console.error(`  -> FAILED: Expected 403, got ${custUsersRes.status}:`, custUsersData);
  }

  // TEST 5: User without promotions:send calls POST /api/admin/promotions -> 403
  console.log('\nTEST 5: Customer calls POST /api/admin/promotions (lacks promotions:send)...');
  const custPromoRes = await fetch(`${BASE_URL}/api/admin/promotions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
    body: JSON.stringify({ html: '<h1>Unauthorized</h1>', customerIds: [customerUser._id] }),
  });
  const custPromoData = await custPromoRes.json();
  if (custPromoRes.status === 403 && custPromoData.message.includes('permission')) {
    console.log(`  -> PASSED: 403 Forbidden returned ("${custPromoData.message}").`);
    passedTests++;
  } else {
    console.error(`  -> FAILED: Expected 403, got ${custPromoRes.status}:`, custPromoData);
  }

  // TEST 6: Unauthenticated request (no JWT) -> 401
  console.log('\nTEST 6: Request without token (GET /api/admin/users)...');
  const noTokenRes = await fetch(`${BASE_URL}/api/admin/users`);
  const noTokenData = await noTokenRes.json();
  if (noTokenRes.status === 401) {
    console.log(`  -> PASSED: 401 Unauthorized returned ("${noTokenData.message}").`);
    passedTests++;
  } else {
    console.error(`  -> FAILED: Expected 401, got ${noTokenRes.status}:`, noTokenData);
  }

  // TEST 7: Permissions API (GET /api/admin/me/permissions)
  console.log('\nTEST 7: GET /api/admin/me/permissions for Admin...');
  const mePermRes = await fetch(`${BASE_URL}/api/admin/me/permissions`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const mePermData = await mePermRes.json();
  if (mePermRes.status === 200 && mePermData.permissions?.length >= 11) {
    console.log(`  -> PASSED: Returned ${mePermData.permissions?.length} permissions for ${mePermData.role?.name}:`, mePermData.permissions);
    passedTests++;
  } else {
    console.error(`  -> FAILED: Expected at least 11 permissions, got:`, mePermData);
  }

  // TEST 8: Customer Signup
  console.log('\nTEST 8: Customer Signup Flow (POST /api/auth/signup)...');
  const randomEmail = `test.customer.${Date.now()}@example.com`;
  const signupRes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Automated Test Customer',
      email: randomEmail,
      password: 'SecurePass@123',
    }),
  });
  const signupData = await signupRes.json();
  if (signupRes.status === 201 && signupData.success) {
    console.log(`  -> PASSED: Created account for ${randomEmail}.`);
    passedTests++;
  } else {
    console.error(`  -> FAILED: Customer signup failed:`, signupData);
  }

  // TEST 9: Email Verification
  console.log('\nTEST 9: Email Verification Endpoint...');
  const User = require('./src/models/User');
  const { connectDB, disconnectDB } = require('./src/config/db');
  await connectDB();
  const createdUser = await User.findOne({ email: randomEmail });
  let verificationToken = createdUser?.emailVerificationToken;
  await disconnectDB();

  if (verificationToken) {
    const verifyRes = await fetch(`${BASE_URL}/api/auth/verify-email?token=${verificationToken}`);
    const verifyData = await verifyRes.json();
    if (verifyRes.status === 200 && verifyData.success) {
      console.log(`  -> PASSED: Email successfully verified.`);
      passedTests++;
    } else {
      console.error(`  -> FAILED: Verification failed:`, verifyData);
    }
  } else {
    console.error('  -> FAILED: Verification token not found in DB.');
  }

  // TEST 10: Wrong Password Admin Login
  console.log('\nTEST 10: Wrong Password Protection...');
  const wrongPassRes = await fetch(`${BASE_URL}/api/auth/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'WrongPassword999' }),
  });
  const wrongPassData = await wrongPassRes.json();
  if (wrongPassRes.status === 401 && !wrongPassData.success) {
    console.log(`  -> PASSED: 401 Invalid credentials returned.`);
    passedTests++;
  } else {
    console.error('  -> FAILED:', wrongPassData);
  }

  console.log('\n===============================================================');
  console.log(`  TEST RESULTS: ${passedTests} / ${totalTests} TESTS PASSED!`);
  console.log('===============================================================');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runCompleteTestSuite().catch((err) => {
  console.error(err);
  process.exit(1);
});
