const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const bcrypt = require('bcryptjs');
const { connectDB, disconnectDB } = require('../config/db');
const Permission = require('../models/Permission');
const Role = require('../models/Role');
const User = require('../models/User');

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
  ],
  Staff: ['dashboard:read', 'users:read', 'users:update'],
  Rider: ['dashboard:read'],
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
