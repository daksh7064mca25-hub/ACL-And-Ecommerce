const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const bcrypt = require('bcryptjs');
const { connectDB, disconnectDB } = require('../config/db');
const Permission = require('../models/Permission');
const Role = require('../models/Role');
const User = require('../models/User');
const DeliveryZone = require('../models/DeliveryZone');

const permissionsToCreate = [
  {
    name: 'dashboard:read',
    display: 'View Dashboard',
    description: 'Allows viewing dashboard metrics and overview',
  },
  {
    name: 'users:read',
    display: 'View Users',
    description: 'Allows viewing registered customers',
  },
  {
    name: 'users:create',
    display: 'Create Users',
    description: 'Allows creating customer accounts',
  },
  {
    name: 'users:update',
    display: 'Update Users',
    description: 'Allows editing user details',
  },
  {
    name: 'users:delete',
    display: 'Delete Users',
    description: 'Allows removing user accounts',
  },
  {
    name: 'promotions:read',
    display: 'View Promotions',
    description: 'Allows viewing promotions module',
  },
  {
    name: 'promotions:send',
    display: 'Send Promotions',
    description: 'Allows dispatching promotional emails to customers',
  },
  {
    name: 'roles:read',
    display: 'View Roles',
    description: 'Allows viewing system roles and assigned permissions',
  },
  {
    name: 'roles:create',
    display: 'Create Roles',
    description: 'Allows creating new custom roles and assigning permissions',
  },
  {
    name: 'roles:update',
    display: 'Update Roles',
    description: 'Allows modifying role names and permission mappings',
  },
  {
    name: 'roles:delete',
    display: 'Delete Roles',
    description: 'Allows removing unused custom roles',
  },
  {
    name: 'products:read',
    display: 'View Products',
    description: 'Allows viewing all product records',
  },
  {
    name: 'products:create',
    display: 'Create Products',
    description: 'Allows creating new products with multiple images',
  },
  {
    name: 'products:update',
    display: 'Update Products',
    description: 'Allows editing product information and images',
  },
  {
    name: 'products:delete',
    display: 'Delete Products',
    description: 'Allows removing products and associated images',
  },
  {
    name: 'refunds:read',
    display: 'View Refund Requests',
    description: 'Allows viewing refund requests and customer order details',
  },
  {
    name: 'refunds:approve',
    display: 'Approve & Process Refunds',
    description: 'Allows approving customer refund requests and processing refunds via Stripe',
  },
  {
    name: 'refunds:reject',
    display: 'Reject Refund Requests',
    description: 'Allows rejecting customer refund requests with an explanation note',
  },
  {
    name: 'delivery_zones:read',
    display: 'View Delivery Zones',
    description: 'Allows viewing configured geographical delivery zones and service areas',
  },
  {
    name: 'delivery_zones:create',
    display: 'Create Delivery Zones',
    description: 'Allows drawing and adding new geographical delivery zones on the map',
  },
  {
    name: 'delivery_zones:update',
    display: 'Update Delivery Zones',
    description: 'Allows modifying delivery zone boundaries, delivery fees, and minimum orders',
  },
  {
    name: 'delivery_zones:delete',
    display: 'Delete Delivery Zones',
    description: 'Allows removing unused delivery zones from the system',
  },
];

const rolePermissionMapping = {
  Admin: [
    'dashboard:read',
    'users:read',
    'users:create',
    'users:update',
    'users:delete',
    'promotions:read',
    'promotions:send',
    'roles:read',
    'roles:create',
    'roles:update',
    'roles:delete',
    'products:read',
    'products:create',
    'products:update',
    'products:delete',
    'refunds:read',
    'refunds:approve',
    'refunds:reject',
    'delivery_zones:read',
    'delivery_zones:create',
    'delivery_zones:update',
    'delivery_zones:delete',
  ],
  Staff: ['dashboard:read', 'users:read', 'users:update', 'delivery_zones:read'],
  Rider: ['dashboard:read', 'delivery_zones:read'],
  Customer: ['dashboard:read'],
};

const createPermissions = async () => {
  console.log('[Permissions] Initializing permissions...');
  const permissionMap = {};

  for (const perm of permissionsToCreate) {
    let existingPerm = await Permission.findOne({ name: perm.name });
    if (existingPerm) {
      console.log(`  - Permission '${perm.name}' already exists. Skipping.`);
      permissionMap[perm.name] = existingPerm._id;
    } else {
      const created = await Permission.create(perm);
      console.log(`  + Permission '${perm.name}' created successfully (ID: ${created._id}).`);
      permissionMap[perm.name] = created._id;
    }
  }

  console.log('[Permissions] Permission initialization complete.\n');
  return permissionMap;
};

const createRoles = async (permissionMap) => {
  console.log('[Roles] Initializing default roles with ACL permissions...');

  const rolesToCreate = [
    { name: 'Admin', display: 'Administrator' },
    { name: 'Customer', display: 'Customer' },
    { name: 'Rider', display: 'Rider' },
    { name: 'Staff', display: 'Staff' },
  ];

  for (const roleData of rolesToCreate) {
    const permNames = rolePermissionMapping[roleData.name] || [];
    const permissionIds = permNames.map((pName) => permissionMap[pName]).filter(Boolean);

    let existingRole = await Role.findOne({ name: roleData.name });

    if (existingRole) {
      existingRole.permissions = permissionIds;
      if (roleData.display) existingRole.display = roleData.display;
      await existingRole.save();
      console.log(`  - Role '${roleData.name}' updated with ${permissionIds.length} permission(s).`);
    } else {
      const newRole = await Role.create({
        name: roleData.name,
        display: roleData.display,
        permissions: permissionIds,
      });
      console.log(`  + Role '${roleData.name}' created with ${permissionIds.length} permission(s) (ID: ${newRole._id}).`);
    }
  }

  console.log('[Roles] Role initialization complete.\n');
};

const seedProductsWithLocations = async () => {
  console.log('[Products] Checking and seeding default products with GeoJSON locations...');
  const Product = require('../models/Product');

  const defaultProducts = [
    {
      title: 'SaaS Motion & UI Animation Library',
      price: 108,
      quantity: 45,
      images: [],
      location: {
        type: 'Point',
        coordinates: [76.768066, 30.741482], // Chandigarh Sector 17 [lng, lat]
        formattedAddress: 'Sector 17 Plaza, Chandigarh',
        city: 'Chandigarh',
        state: 'Chandigarh',
        country: 'India',
        postalCode: '160017',
      },
    },
    {
      title: '3D Futuristic Cyberpunk Assets',
      price: 149,
      quantity: 30,
      images: [],
      location: {
        type: 'Point',
        coordinates: [76.717873, 30.704649], // Mohali Phase 7 [lng, lat]
        formattedAddress: 'Phase 7 Market, Sector 61, Mohali',
        city: 'Mohali',
        state: 'Punjab',
        country: 'India',
        postalCode: '160062',
      },
    },
    {
      title: 'Premium Brand Identity & Typography Kit',
      price: 199,
      quantity: 25,
      images: [],
      location: {
        type: 'Point',
        coordinates: [76.860565, 30.694209], // Panchkula Sector 5 [lng, lat]
        formattedAddress: 'City Centre, Sector 5, Panchkula',
        city: 'Panchkula',
        state: 'Haryana',
        country: 'India',
        postalCode: '134109',
      },
    },
    {
      title: 'Fullstack Next.js 15 & Node.js Starter Kit',
      price: 249,
      quantity: 50,
      images: [],
      location: {
        type: 'Point',
        coordinates: [77.217722, 28.63042], // Connaught Place, New Delhi [lng, lat]
        formattedAddress: 'Inner Circle, Connaught Place, New Delhi',
        city: 'New Delhi',
        state: 'Delhi',
        country: 'India',
        postalCode: '110001',
      },
    },
    {
      title: 'E-Commerce Tailwind Design System',
      price: 79,
      quantity: 60,
      images: [],
      location: {
        type: 'Point',
        coordinates: [77.624462, 12.935242], // Koramangala, Bengaluru [lng, lat]
        formattedAddress: '80 Feet Road, 4th Block, Koramangala, Bengaluru',
        city: 'Bengaluru',
        state: 'Karnataka',
        country: 'India',
        postalCode: '560034',
      },
    },
    {
      title: 'Interactive 3D Three.js Web Experience Kit',
      price: 189,
      quantity: 20,
      images: [],
      location: {
        type: 'Point',
        coordinates: [72.829529, 19.059559], // Bandra West, Mumbai [lng, lat]
        formattedAddress: 'Hill Road, Bandra West, Mumbai',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        postalCode: '400050',
      },
    },
  ];

  for (const prodData of defaultProducts) {
    const existing = await Product.findOne({ title: prodData.title });
    if (existing) {
      if (!existing.location || !existing.location.coordinates || existing.location.coordinates.length === 0) {
        existing.location = prodData.location;
        await existing.save();
        console.log(`  - Updated product '${prodData.title}' with GeoJSON location.`);
      }
    } else {
      await Product.create(prodData);
      console.log(`  + Created product '${prodData.title}' with location (${prodData.location.city}).`);
    }
  }

  // Also ensure any existing products without location get a default location
  const unlocatedProducts = await Product.find({
    $or: [{ location: { $exists: false } }, { 'location.coordinates': { $exists: false } }, { 'location.coordinates': { $size: 0 } }],
  });

  if (unlocatedProducts.length > 0) {
    console.log(`  - Assigning default Chandigarh location to ${unlocatedProducts.length} unlocated product(s)...`);
    for (let i = 0; i < unlocatedProducts.length; i++) {
      const p = unlocatedProducts[i];
      // Offset slightly to spread across Chandigarh tri-city
      const offsetLat = 30.7333 + (i * 0.015) % 0.06;
      const offsetLng = 76.7794 + (i * 0.015) % 0.06;
      p.location = {
        type: 'Point',
        coordinates: [offsetLng, offsetLat],
        formattedAddress: `Sector ${17 + i}, Chandigarh`,
        city: 'Chandigarh',
        state: 'Chandigarh',
        country: 'India',
        postalCode: '160017',
      };
      await p.save();
    }
  }

  console.log('[Products] Product location seeding complete.\n');
};

const createAdmin = async () => {
  console.log('[Admin] Initializing default Admin user...');

  const adminRole = await Role.findOne({ name: 'Admin' });

  if (!adminRole) {
    throw new Error('Admin role not found. Ensure createRoles() ran before createAdmin().');
  }

  const adminName = process.env.ADMIN_NAME || 'System Admin';
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';

  const existingAdmin = await User.findOne({ email: adminEmail });

  if (existingAdmin) {
    console.log(`  - Admin user '${adminEmail}' already exists. Skipping.`);
  } else {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(adminPassword, saltRounds);

    const newAdmin = await User.create({
      name: adminName,
      email: adminEmail,
      password: hashedPassword,
      role: adminRole._id,
      isEmailVerified: true,
    });

    console.log(`  + Admin user created successfully:`);
    console.log(`    - ID:    ${newAdmin._id}`);
    console.log(`    - Name:  ${newAdmin.name}`);
    console.log(`    - Email: ${newAdmin.email}`);
    console.log(`    - Role:  Admin (${adminRole._id})`);
  }

  console.log('[Admin] Admin user initialization complete.\n');
};

const seedDeliveryZones = async () => {
  console.log('[DeliveryZones] Checking and seeding delivery zones...');

  const defaultZones = [
    {
      name: 'Chandigarh Core Express Zone',
      code: 'CHD-EXP',
      description: 'Ultra-fast 30-45 mins express delivery covering Chandigarh Sectors 1-38.',
      boundary: {
        type: 'Polygon',
        coordinates: [
          [
            [76.740, 30.710],
            [76.815, 30.710],
            [76.815, 30.775],
            [76.740, 30.775],
            [76.740, 30.710],
          ],
        ],
      },
      deliveryFee: 30,
      minOrderAmount: 100,
      estimatedDeliveryTime: '30-45 mins',
      priority: 5,
      isActive: true,
      coverageType: 'all_products',
      color: '#4f46e5',
    },
    {
      name: 'Mohali IT & Urban Zone',
      code: 'MOH-URB',
      description: 'Fast delivery covering Mohali Sectors 55 to 82 and Phase 1-11.',
      boundary: {
        type: 'Polygon',
        coordinates: [
          [
            [76.670, 30.660],
            [76.745, 30.660],
            [76.745, 30.730],
            [76.670, 30.730],
            [76.670, 30.660],
          ],
        ],
      },
      deliveryFee: 45,
      minOrderAmount: 150,
      estimatedDeliveryTime: '45-60 mins',
      priority: 4,
      isActive: true,
      coverageType: 'all_products',
      color: '#059669',
    },
    {
      name: 'Panchkula Express Zone',
      code: 'PKL-EXP',
      description: 'Scheduled express delivery covering Panchkula Urban Sectors 1-21.',
      boundary: {
        type: 'Polygon',
        coordinates: [
          [
            [76.815, 30.650],
            [76.890, 30.650],
            [76.890, 30.730],
            [76.815, 30.730],
            [76.815, 30.650],
          ],
        ],
      },
      deliveryFee: 50,
      minOrderAmount: 200,
      estimatedDeliveryTime: '45-60 mins',
      priority: 3,
      isActive: true,
      coverageType: 'all_products',
      color: '#d97706',
    },
    {
      name: 'Greater Tricity Super-Saver Zone',
      code: 'TRI-SAVER',
      description: 'Wide coverage zone covering greater Tricity, Kharar, Zirakpur, and Dera Bassi.',
      boundary: {
        type: 'Polygon',
        coordinates: [
          [
            [76.640, 30.600],
            [76.920, 30.600],
            [76.920, 30.820],
            [76.640, 30.820],
            [76.640, 30.600],
          ],
        ],
      },
      deliveryFee: 75,
      minOrderAmount: 350,
      estimatedDeliveryTime: 'Same Day (2-4 hrs)',
      priority: 1,
      isActive: true,
      coverageType: 'all_products',
      color: '#7c3aed',
    },
  ];

  for (const zoneData of defaultZones) {
    const existing = await DeliveryZone.findOne({ code: zoneData.code });
    if (existing) {
      console.log(`  - Delivery Zone '${zoneData.name}' (${zoneData.code}) exists. Skipping.`);
    } else {
      const created = await DeliveryZone.create(zoneData);
      console.log(`  + Delivery Zone '${created.name}' (${created.code}) created (Fee: ₹${created.deliveryFee}, Min: ₹${created.minOrderAmount}).`);
    }
  }

  console.log('[DeliveryZones] Delivery zones seeding complete.\n');
};

const initSetup = async () => {
  console.log('========================================');
  console.log('  STARTING DATABASE INITIALIZATION SETUP');
  console.log('========================================\n');

  try {
    await connectDB();
    console.log();

    const permissionMap = await createPermissions();
    await createRoles(permissionMap);
    await createAdmin();
    await seedProductsWithLocations();
    await seedDeliveryZones();

    console.log('========================================');
    console.log('  DATABASE INITIALIZATION SUCCESSFUL!   ');
    console.log('========================================\n');
  } catch (error) {
    console.error('\n========================================');
    console.error('  DATABASE INITIALIZATION FAILED!       ');
    console.error('========================================');
    console.error(`[Seeder Error]: ${error.message}\n`);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
};

initSetup();
