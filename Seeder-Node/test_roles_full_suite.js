const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const jwt = require('jsonwebtoken');

const BASE_URL = 'http://localhost:5000';

async function runSuite() {
  console.log('===============================================================');
  console.log('  COMPREHENSIVE VERIFICATION SUITE: ROLES MODULE & ACL');
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  -> PASSED: ${message}`);
      passed++;
    } else {
      console.error(`  -> FAILED: ${message}`);
    }
  }

  // Helper for requests
  async function api(path, options = {}) {
    const res = await fetch(`${BASE_URL}${path}`, options);
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  }

  // 1. Admin Login
  console.log('TEST 1: Admin Login (admin@example.com)...');
  const loginRes = await api('/api/auth/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'Admin@123' }),
  });
  const adminToken = loginRes.body?.data?.token;
  assert(loginRes.status === 200 && adminToken, 'Admin logged in and received JWT token.');

  // 2. Fetch Users to get Customer Account
  console.log('\nTEST 2: Fetch customer records for ACL testing...');
  const usersRes = await api('/api/admin/users', {
    method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const customers = usersRes.body?.users || [];
  const targetCustomer = customers[0];
  const jwtSecret = process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_in_production_2026';
  const customerToken = targetCustomer ? jwt.sign({ id: targetCustomer._id, role: 'Customer' }, jwtSecret, { expiresIn: '1h' }) : null;
  assert(Boolean(customerToken), `Customer account (${targetCustomer?.email}) loaded and JWT signed.`);

  // 3. GET /api/admin/permissions (roles:read)
  console.log('\nTEST 3: GET /api/admin/permissions (roles:read)...');
  const permsRes = await api('/api/admin/permissions', {
    method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const permissions = permsRes.body?.permissions || [];
  assert(
    permsRes.status === 200 && permissions.length >= 11,
    `Returned ${permissions.length} available permissions including roles:* and promotions:*.`
  );

  // 4. GET /api/admin/roles (roles:read)
  console.log('\nTEST 4: GET /api/admin/roles (roles:read)...');
  const rolesRes = await api('/api/admin/roles', {
    method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const initialRoles = rolesRes.body?.roles || [];
  const systemRoles = initialRoles.filter((r) => r.isSystemRole);
  assert(
    rolesRes.status === 200 && systemRoles.length === 4,
    `Returned ${initialRoles.length} roles, including 4 core system roles (Admin, Customer, Rider, Staff).`
  );

  // 5. POST /api/admin/roles (create custom role)
  console.log('\nTEST 5: Create custom role "Auditor" with selected permissions...');
  const samplePermIds = permissions
    .filter((p) => ['dashboard:read', 'users:read', 'roles:read'].includes(p.name))
    .map((p) => p._id);

  const roleName = `Auditor_${Date.now()}`;
  const createRes = await api('/api/admin/roles', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: roleName,
      display: 'Compliance Auditor',
      permissions: samplePermIds,
    }),
  });

  const createdRole = createRes.body?.role;
  assert(
    createRes.status === 201 &&
      createdRole &&
      createdRole.name === roleName &&
      createdRole.permissions.length === samplePermIds.length,
    `Role '${roleName}' created with ${samplePermIds.length} permissions.`
  );

  // 6. Validation on create role (duplicate name, missing name, invalid permission ID)
  console.log('\nTEST 6: Validation tests for POST /api/admin/roles...');
  const duplicateRes = await api('/api/admin/roles', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: roleName,
      display: 'Duplicate Auditor',
      permissions: [],
    }),
  });
  assert(duplicateRes.status === 400, 'Duplicate role name rejected with 400.');

  const missingNameRes = await api('/api/admin/roles', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: '  ',
      display: 'Empty name',
      permissions: [],
    }),
  });
  assert(missingNameRes.status === 400, 'Empty role name rejected with 400.');

  const invalidPermRes = await api('/api/admin/roles', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: `Role_BadPerm_${Date.now()}`,
      display: 'Bad Perm Role',
      permissions: ['6aab7941606ed8ca2c1aea99'], // Non-existent ObjectId
    }),
  });
  assert(invalidPermRes.status === 400, 'Non-existent permission ID rejected with 400.');

  // 7. PUT /api/admin/roles/:id (update role & change permissions)
  console.log('\nTEST 7: Edit custom role (PUT /api/admin/roles/:id)...');
  const allPermIds = permissions.map((p) => p._id);
  const updateRes = await api(`/api/admin/roles/${createdRole._id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      display: 'Lead Compliance Auditor',
      permissions: allPermIds,
    }),
  });
  const updatedRole = updateRes.body?.role;
  assert(
    updateRes.status === 200 &&
      updatedRole &&
      updatedRole.display === 'Lead Compliance Auditor' &&
      updatedRole.permissions.length === allPermIds.length,
    `Role '${roleName}' updated with display label and ${allPermIds.length} permissions.`
  );

  // 8. Safe Deletion Test: Prevent deleting system role (Admin, Customer, etc.)
  console.log('\nTEST 8: Safe Deletion: Attempt to delete System Role (Admin / Customer)...');
  const adminRole = initialRoles.find((r) => r.name === 'Admin');
  const delAdminRes = await api(`/api/admin/roles/${adminRole._id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(delAdminRes.status === 400, `Blocked deletion of system role 'Admin' with 400: "${delAdminRes.body?.message}"`);

  // 9. Safe Deletion Test: Prevent deleting role assigned to an active user
  console.log('\nTEST 9: Safe Deletion: Attempt to delete role assigned to active users...');
  const customerRole = initialRoles.find((r) => r.name === 'Customer');
  const delCustRoleRes = await api(`/api/admin/roles/${customerRole._id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(delCustRoleRes.status === 400, `Blocked deletion of in-use role 'Customer' with 400: "${delCustRoleRes.body?.message}"`);

  // 10. DELETE /api/admin/roles/:id (Delete unused custom role)
  console.log('\nTEST 10: Delete unused custom role...');
  const delCustomRes = await api(`/api/admin/roles/${createdRole._id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(delCustomRes.status === 200, `Deleted custom role '${roleName}' successfully.`);

  // 11. ACL Authorization: Customer token attempting roles management (403)
  console.log('\nTEST 11: ACL Authorization: Customer token attempting roles endpoints...');
  const custRolesRes = await api('/api/admin/roles', {
    method: 'GET',
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  assert(custRolesRes.status === 403, `Customer blocked from GET /api/admin/roles with 403 Forbidden: "${custRolesRes.body?.message}"`);

  const custCreateRes = await api('/api/admin/roles', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({ name: 'HackerRole', permissions: [] }),
  });
  assert(custCreateRes.status === 403, `Customer blocked from POST /api/admin/roles with 403 Forbidden: "${custCreateRes.body?.message}"`);

  // 12. Unauthenticated request (401)
  console.log('\nTEST 12: Unauthenticated request to /api/admin/roles...');
  const unauthRes = await api('/api/admin/roles', { method: 'GET' });
  assert(unauthRes.status === 401, 'Unauthenticated request rejected with 401 Unauthorized.');

  // 13. Regression Check: Existing Users, Promotions, and Permissions APIs
  console.log('\nTEST 13: Regression Check: Existing Users & Permissions APIs...');
  const checkUsersRes = await api('/api/admin/users', {
    method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(checkUsersRes.status === 200 && Array.isArray(checkUsersRes.body?.users), 'Users module (GET /api/admin/users) operational.');

  const myPermsRes = await api('/api/admin/me/permissions', {
    method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(
    myPermsRes.status === 200 && myPermsRes.body?.permissions?.includes('roles:read'),
    `Permissions API (GET /api/admin/me/permissions) returns updated permissions (${myPermsRes.body?.permissions?.length} perms).`
  );

  console.log('\n===============================================================');
  console.log(`  TEST RESULTS: ${passed} / ${total} TESTS PASSED!`);
  console.log('===============================================================\n');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Fatal error during test suite execution:', err);
  process.exit(1);
});
