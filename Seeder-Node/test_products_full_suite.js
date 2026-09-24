const fs = require('fs');
const path = require('path');

async function runTests() {
  console.log('--- Starting Products Module End-to-End Test Suite ---');
  const BASE_URL = 'http://localhost:5000';

  // 1. First ensure seeder is up to date by running initSetup if needed, or logging in
  console.log('\n[1] Logging in as Admin...');
  const adminLoginRes = await fetch(`${BASE_URL}/api/auth/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'Admin@123' })
  });

  const adminLoginData = await adminLoginRes.json();
  const adminToken = adminLoginData.data?.token || adminLoginData.token;
  if (!adminLoginRes.ok || !adminToken) {
    console.error('Admin login failed:', adminLoginData);
    process.exit(1);
  }
  console.log('✓ Admin login successful. Token acquired.');

  // Check admin permissions
  console.log('\n[2] Checking Admin permissions...');
  const permRes = await fetch(`${BASE_URL}/api/admin/me/permissions`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const permData = await permRes.json();
  const permNames = (permData.permissions || []).map(p => typeof p === 'string' ? p : p.name);
  console.log(`Total permissions: ${permNames.length}`);
  const expectedPerms = ['products:read', 'products:create', 'products:update', 'products:delete'];
  for (const ep of expectedPerms) {
    if (permNames.includes(ep)) {
      console.log(`✓ Found permission: ${ep}`);
    } else {
      console.error(`✗ Missing permission: ${ep}`);
      process.exit(1);
    }
  }

  // 3. Create dummy image files for upload testing
  const tempDir = path.join(__dirname, 'temp_test_images');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  const img1Path = path.join(tempDir, 'sample1.png');
  const img2Path = path.join(tempDir, 'sample2.jpg');
  // Simple 1x1 transparent PNG / dummy buffer
  const dummyBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
    0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
  ]);
  fs.writeFileSync(img1Path, dummyBuffer);
  fs.writeFileSync(img2Path, dummyBuffer);

  // 4. Test Product Creation with Images
  console.log('\n[3] Creating product with multiple images via POST /api/admin/products...');
  const formData = new FormData();
  formData.append('title', 'Mechanical Gaming Keyboard');
  formData.append('price', '129.99');
  formData.append('quantity', '45');
  const file1Blob = new Blob([dummyBuffer], { type: 'image/png' });
  const file2Blob = new Blob([dummyBuffer], { type: 'image/jpeg' });
  formData.append('images', file1Blob, 'sample1.png');
  formData.append('images', file2Blob, 'sample2.jpg');

  const createRes = await fetch(`${BASE_URL}/api/admin/products`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`
    },
    body: formData
  });

  const createData = await createRes.json();
  console.log('Create product status:', createRes.status);
  console.log('Create product response:', JSON.stringify(createData, null, 2));

  if (!createRes.ok || !createData.success || !createData.product) {
    console.error('✗ Product creation failed');
    process.exit(1);
  }
  const createdProduct = createData.product;
  const productId = createdProduct._id;
  console.log(`✓ Product created successfully! ID: ${productId}, Images saved: ${createdProduct.images.length}`);

  // Check physical file existence
  const uploadsDir = __dirname;
  for (const imgUrl of createdProduct.images) {
    const relPath = imgUrl.startsWith('/') ? imgUrl.substring(1) : imgUrl;
    const diskPath = path.join(uploadsDir, relPath);
    if (fs.existsSync(diskPath)) {
      console.log(`✓ Verified physical file on disk: ${diskPath}`);
    } else {
      console.error(`✗ Physical file NOT found on disk: ${diskPath}`);
      process.exit(1);
    }
  }

  // 5. Test Static File Serving
  console.log('\n[4] Testing Express static file serving for uploaded product images...');
  const sampleImgUrl = createdProduct.images[0];
  const staticRes = await fetch(`${BASE_URL}${sampleImgUrl}`);
  console.log(`GET ${sampleImgUrl} -> Status: ${staticRes.status}, Content-Type: ${staticRes.headers.get('content-type')}`);
  if (staticRes.status !== 200) {
    console.error('✗ Static file serving failed');
    process.exit(1);
  }
  console.log('✓ Static image successfully served by backend.');

  // 6. Test GET all products and GET product by ID
  console.log('\n[5] Testing GET /api/admin/products...');
  const listRes = await fetch(`${BASE_URL}/api/admin/products`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const listData = await listRes.json();
  console.log(`GET /api/admin/products -> Count: ${listData.count || listData.products?.length}`);
  const found = listData.products.find(p => p._id === productId);
  if (!found) {
    console.error('✗ Created product not listed in GET /api/admin/products');
    process.exit(1);
  }
  console.log('✓ Found newly created product in list.');

  console.log('\n[6] Testing GET /api/admin/products/:id...');
  const getSingleRes = await fetch(`${BASE_URL}/api/admin/products/${productId}`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const getSingleData = await getSingleRes.json();
  if (getSingleData.product?.title !== 'Mechanical Gaming Keyboard') {
    console.error('✗ Product title mismatch in single product fetch:', getSingleData);
    process.exit(1);
  }
  console.log('✓ GET single product verified successfully.');

  // 7. Test Input Validations & Orphan Cleanup
  console.log('\n[7] Testing validation errors & orphan file cleanup...');
  const badFormData = new FormData();
  badFormData.append('title', ''); // missing title
  badFormData.append('price', '-10'); // invalid price
  badFormData.append('quantity', '10');
  badFormData.append('images', file1Blob, 'bad_sample.png');

  const beforeUploadsCount = fs.readdirSync(path.join(uploadsDir, 'uploads/products')).length;
  const badRes = await fetch(`${BASE_URL}/api/admin/products`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: badFormData
  });
  const badData = await badRes.json();
  const afterUploadsCount = fs.readdirSync(path.join(uploadsDir, 'uploads/products')).length;

  console.log(`Validation failure HTTP status: ${badRes.status} (expected 400)`);
  console.log(`Error message: ${badData.message}`);
  if (badRes.status === 400 && beforeUploadsCount === afterUploadsCount) {
    console.log('✓ Validation rejected correctly and orphan uploaded image was cleaned up from disk.');
  } else {
    console.error(`✗ Orphan file cleanup failed. Before count: ${beforeUploadsCount}, After count: ${afterUploadsCount}`);
    process.exit(1);
  }

  // 8. Test Product Update (PUT /api/admin/products/:id)
  console.log('\n[8] Testing PUT /api/admin/products/:id (Updating text fields and modifying images)...');
  const imgToKeep = createdProduct.images[0];
  const imgToRemove = createdProduct.images[1];
  const removeDiskPath = path.join(uploadsDir, imgToRemove.startsWith('/') ? imgToRemove.substring(1) : imgToRemove);

  const updateFormData = new FormData();
  updateFormData.append('title', 'Mechanical Gaming Keyboard RGB Pro');
  updateFormData.append('price', '149.99');
  updateFormData.append('quantity', '30');
  // keep 1 image
  updateFormData.append('existingImages', JSON.stringify([imgToKeep]));
  // add 1 new image
  updateFormData.append('images', file1Blob, 'new_sample3.png');

  const updateRes = await fetch(`${BASE_URL}/api/admin/products/${productId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: updateFormData
  });
  const updateData = await updateRes.json();
  console.log('Update product response:', updateData);

  if (!updateRes.ok || updateData.product.title !== 'Mechanical Gaming Keyboard RGB Pro') {
    console.error('✗ Product update failed');
    process.exit(1);
  }
  console.log('✓ Product updated successfully.');

  // Verify removed image is deleted from disk
  if (!fs.existsSync(removeDiskPath)) {
    console.log(`✓ Verified removed image was cleaned up from disk: ${removeDiskPath}`);
  } else {
    console.error(`✗ Removed image was NOT deleted from disk: ${removeDiskPath}`);
    process.exit(1);
  }

  // 9. Test Product Deletion (DELETE /api/admin/products/:id)
  console.log('\n[9] Testing DELETE /api/admin/products/:id...');
  const updatedImages = updateData.product.images;
  const deleteRes = await fetch(`${BASE_URL}/api/admin/products/${productId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const deleteData = await deleteRes.json();
  console.log('Delete status:', deleteRes.status, 'Response:', deleteData);

  if (!deleteRes.ok || !deleteData.success) {
    console.error('✗ Product deletion failed');
    process.exit(1);
  }
  console.log('✓ Product deleted from MongoDB.');

  // Verify all remaining product images are cleaned up from disk
  for (const imgUrl of updatedImages) {
    const relPath = imgUrl.startsWith('/') ? imgUrl.substring(1) : imgUrl;
    const diskPath = path.join(uploadsDir, relPath);
    if (!fs.existsSync(diskPath)) {
      console.log(`✓ Verified disk image cleaned up on delete: ${diskPath}`);
    } else {
      console.error(`✗ Disk image still exists after delete: ${diskPath}`);
      process.exit(1);
    }
  }

  // 10. Test Security & ACL Permissions
  console.log('\n[10] Testing Security & ACL Protection...');
  // 10a. Unauthenticated request
  const unauthRes = await fetch(`${BASE_URL}/api/admin/products`);
  console.log(`Unauthenticated GET /api/admin/products -> Status: ${unauthRes.status} (expected 401)`);
  if (unauthRes.status !== 401) {
    console.error('✗ Unauthenticated access was not blocked with 401');
    process.exit(1);
  }
  console.log('✓ Unauthenticated request blocked correctly.');

  // 10b. Customer user access without permission
  console.log('Testing Customer token and permission denial...');
  const mongoose = require('mongoose');
  const User = require('./src/models/User');
  const Role = require('./src/models/Role');
  require('dotenv').config({ path: path.join(__dirname, '.env') });
  
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/seeder_demo_db');
  }
  
  const customerRole = await Role.findOne({ name: 'Customer' });
  let customerUser = await User.findOne({ role: customerRole._id });
  if (!customerUser) {
    customerUser = await User.create({
      name: 'Test Customer',
      email: 'testcustomer@example.com',
      password: 'hashedpassword123',
      role: customerRole._id,
      isEmailVerified: true
    });
  }

  const jwt = require('jsonwebtoken');
  const jwtSecret = process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_in_production_2026';
  const custToken = jwt.sign({ id: customerUser._id, role: 'Customer' }, jwtSecret, { expiresIn: '1h' });

  const custProdRes = await fetch(`${BASE_URL}/api/admin/products`, {
    headers: { Authorization: `Bearer ${custToken}` }
  });
  console.log(`Customer GET /api/admin/products -> Status: ${custProdRes.status} (expected 403)`);
  if (custProdRes.status !== 403) {
    console.error(`✗ Customer was not blocked with 403, received ${custProdRes.status}`);
    process.exit(1);
  }
  console.log('✓ Customer without products:read permission blocked with 403 Forbidden.');

  // 11. Regression testing across all existing modules
  console.log('\n[11] Testing Regression across Dashboard Test Route, Users, Promotions, Roles...');
  const dashRes = await fetch(`${BASE_URL}/api/admin/test`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  console.log(`GET /api/admin/test -> Status: ${dashRes.status}`);

  const usersRes = await fetch(`${BASE_URL}/api/admin/users`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  console.log(`GET /api/admin/users -> Status: ${usersRes.status}`);

  const rolesRes = await fetch(`${BASE_URL}/api/admin/roles`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  console.log(`GET /api/admin/roles -> Status: ${rolesRes.status}`);

  if (dashRes.status === 200 && usersRes.status === 200 && rolesRes.status === 200) {
    console.log('✓ All existing modules working without regression!');
  } else {
    console.error('✗ Regression detected!');
    process.exit(1);
  }

  // Clean up test temp images
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  } catch (e) {}

  console.log('\n======================================================');
  console.log('🎉 ALL PRODUCTS MODULE TESTS PASSED WITH 100% SUCCESS!');
  console.log('======================================================');
}

runTests().catch(err => {
  console.error('Test suite runtime error:', err);
  process.exit(1);
});
