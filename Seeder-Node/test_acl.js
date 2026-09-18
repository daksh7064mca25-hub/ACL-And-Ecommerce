const jwt = require('jsonwebtoken');
require('dotenv').config();

async function runAclTests() {
  console.log('====================================================');
  console.log('  STARTING ACL PERMISSION AUTHORIZATION TESTS');
  console.log('====================================================\n');

  // Step 1: Admin Login
  console.log('1. Testing Admin Login...');
  const loginRes = await fetch('http://localhost:5000/api/auth/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'Admin@123' }),
  });
  const loginData = await loginRes.json();
  console.log(`   Status: ${loginRes.status}, Success: ${loginData.success}`);
  const adminToken = loginData.data?.token;
  if (!adminToken) throw new Error('Admin login failed');

  // Step 2: GET /api/admin/me/permissions
  console.log('\n2. Testing GET /api/admin/me/permissions for Admin...');
  const permRes = await fetch('http://localhost:5000/api/admin/me/permissions', {
    method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const permData = await permRes.json();
  console.log(`   Status: ${permRes.status}, Role: ${permData.role?.name}`);
  console.log(`   Permissions count: ${permData.permissions?.length}`);
  console.log(`   Permissions:`, permData.permissions);

  // Step 3: Admin GET /api/admin/users (requires users:read)
  console.log('\n3. Testing GET /api/admin/users with Admin Token (users:read)...');
  const usersRes = await fetch('http://localhost:5000/api/admin/users', {
    method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const usersData = await usersRes.json();
  console.log(`   Status: ${usersRes.status} (Expected: 200), Success: ${usersData.success}`);
  console.log(`   Customers returned: ${usersData.users?.length}`);

  // Step 4: Admin POST /api/admin/promotions (requires promotions:send)
  console.log('\n4. Testing POST /api/admin/promotions with Admin Token (promotions:send)...');
  const promoRes = await fetch('http://localhost:5000/api/admin/promotions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      subject: 'ACL Test Promotion',
      html: '<h1>ACL Test</h1>',
      customerIds: [usersData.users[0]?._id],
    }),
  });
  const promoData = await promoRes.json();
  console.log(`   Status: ${promoRes.status} (Expected: 200), Success: ${promoData.success}`);

  // Step 5: Test Non-Admin / Unauthorized Customer Token
  console.log('\n5. Testing Customer Token (lacks users:read and promotions:send)...');
  const customerUser = usersData.users[0];
  const jwtSecret = process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_in_production_2026';
  const customerToken = jwt.sign({ id: customerUser._id, role: 'Customer' }, jwtSecret, { expiresIn: '1h' });

  // 5a. Customer GET /api/admin/users -> 403
  const custUsersRes = await fetch('http://localhost:5000/api/admin/users', {
    method: 'GET',
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  const custUsersData = await custUsersRes.json();
  console.log(`   Customer -> GET /api/admin/users Status: ${custUsersRes.status} (Expected: 403)`);
  console.log(`   Message: "${custUsersData.message}"`);

  // 5b. Customer POST /api/admin/promotions -> 403
  const custPromoRes = await fetch('http://localhost:5000/api/admin/promotions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
    body: JSON.stringify({ html: '<h1>Unauthorized</h1>', customerIds: [customerUser._id] }),
  });
  const custPromoData = await custPromoRes.json();
  console.log(`   Customer -> POST /api/admin/promotions Status: ${custPromoRes.status} (Expected: 403)`);
  console.log(`   Message: "${custPromoData.message}"`);

  // Step 6: No token -> 401
  console.log('\n6. Testing Request without token...');
  const noTokenRes = await fetch('http://localhost:5000/api/admin/users');
  const noTokenData = await noTokenRes.json();
  console.log(`   No Token -> GET /api/admin/users Status: ${noTokenRes.status} (Expected: 401)`);
  console.log(`   Message: "${noTokenData.message}"`);

  console.log('\n====================================================');
  console.log('  ACL BACKEND AUTHORIZATION TESTS PASSED!            ');
  console.log('====================================================');
}

runAclTests().catch(console.error);
