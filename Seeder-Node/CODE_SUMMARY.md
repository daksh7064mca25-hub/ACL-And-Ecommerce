# Codebase Reference & File Guide

This document provides a comprehensive overview of all key files in the **Seeder Node** project, explaining the exact role, purpose, and complete source code of each file.

---

## 📋 Table of Contents
1. [`package.json`](#1-packagejson)
2. [`src/config/db.js`](#2-srcconfigdbjs)
3. [`src/models/Role.js`](#3-srcmodelsrolejs)
4. [`src/models/User.js`](#4-srcmodelsuserjs)
5. [`src/services/emailService.js`](#5-srcservicesemailservicejs)
6. [`src/middleware/authMiddleware.js`](#6-srcmiddlewareauthmiddlewarejs)
7. [`src/controllers/authController.js`](#7-srccontrollersauthcontrollerjs)
8. [`src/routes/authRoutes.js`](#8-srcroutesauthroutesjs)
9. [`src/routes/adminRoutes.js`](#9-srcroutesadminroutesjs)
10. [`src/seeders/initSetup.js`](#10-srcseedersinitsetupjs)
11. [`src/app.js`](#11-srcappjs)
12. [`server.js`](#12-serverjs)

---

## 1. `package.json`

```json
{
  "name": "seeder-node-demo",
  "version": "1.0.0",
  "description": "A beginner-friendly Node.js project demonstrating database initialization and seeding with MongoDB and Mongoose",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "initsetup": "node src/seeders/initSetup.js"
  },
  "keywords": [
    "nodejs",
    "express",
    "mongodb",
    "mongoose",
    "seeder",
    "database-initialization"
  ],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "dotenv": "^16.4.7",
    "express": "^4.21.2",
    "mongoose": "^8.9.5",
    "nodemailer": "^6.10.0"
  },
  "devDependencies": {
    "nodemon": "^3.1.9"
  }
}
```

---

## 2. `src/config/db.js`

```javascript
require('dotenv').config();
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI;

    if (!mongoURI) {
      throw new Error('MONGO_URI is not defined in the environment variables (.env file)');
    }

    const conn = await mongoose.connect(mongoURI);
    console.log(`[Database] MongoDB Connected successfully: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`[Database] Error connecting to MongoDB: ${error.message}`);
    throw error;
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    console.log('[Database] MongoDB connection closed successfully.');
  } catch (error) {
    console.error(`[Database] Error disconnecting from MongoDB: ${error.message}`);
    throw error;
  }
};

module.exports = {
  connectDB,
  disconnectDB,
};
```

---

## 3. `src/models/Role.js`

```javascript
const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Role name is required'],
      unique: true,
      trim: true,
    },

    display: {
      type: String,
      enum: ['Administrator', 'Customer', 'Rider', 'Staff'],
      required: [true, 'Role display name is required'],
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const Role = mongoose.model('Role', roleSchema);

module.exports = Role;
```

---

## 4. `src/models/User.js`

```javascript
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'User name is required'],
      trim: true,
    },

    email: {
      type: String,
      required: [true, 'User email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: [true, 'User password is required'],
    },

    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role',
      required: [true, 'User role is required'],
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    emailVerificationToken: {
      type: String,
    },

    emailVerificationExpires: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model('User', userSchema);

module.exports = User;
```

---

## 5. `src/services/emailService.js`

```javascript
const nodemailer = require('nodemailer');

const createTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port: Number(port),
      secure: Number(port) === 465,
      auth: {
        user,
        pass,
      },
    });
  }

  return nodemailer.createTransport({
    host: host || 'smtp.ethereal.email',
    port: Number(port),
    auth: {
      user: user || '',
      pass: pass || '',
    },
  });
};

const sendVerificationEmail = async ({ to, name, verificationToken }) => {
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
  const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${verificationToken}`;
  const fromEmail = process.env.EMAIL_FROM || '"Customer Support" <no-reply@example.com>';

  const mailOptions = {
    from: fromEmail,
    to,
    subject: 'Please verify your email address',
    text: `Hello ${name},\n\nThank you for signing up! Please verify your email by clicking the link below:\n\n${verificationUrl}\n\nThis verification link will expire in 24 hours.\n\nIf you did not create this account, please ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #2b6cb0;">Welcome to our Platform, ${name}!</h2>
        <p>Thank you for signing up as a Customer. To activate your account, please verify your email address by clicking the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" style="background-color: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            Verify Email Address
          </a>
        </div>
        <p>Or copy and paste this URL into your browser:</p>
        <p style="word-break: break-all; color: #4a5568;"><a href="${verificationUrl}">${verificationUrl}</a></p>
        <p style="font-size: 13px; color: #718096; margin-top: 30px;">
          Note: This verification link will expire in 24 hours.<br>
          If you did not create an account, you can safely ignore this email.
        </p>
      </div>
    `,
  };

  console.log(`[EmailService] Verification URL for ${to}:`);
  console.log(` -> ${verificationUrl}\n`);

  try {
    const transporter = createTransporter();
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      const info = await transporter.sendMail(mailOptions);
      console.log(`[EmailService] Verification email sent: ${info.messageId}`);
      return { success: true, messageId: info.messageId, verificationUrl };
    } else {
      console.log('[EmailService] SMTP credentials not provided in .env. Email link printed to console for local testing.');
      return { success: true, simulated: true, verificationUrl };
    }
  } catch (error) {
    console.error(`[EmailService] Error sending email: ${error.message}`);
    return { success: false, error: error.message, verificationUrl };
  }
};

module.exports = {
  sendVerificationEmail,
};
```

---

## 6. `src/middleware/authMiddleware.js`

```javascript
const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Authentication Middleware
 * Validates the JWT Bearer token from the Authorization header and attaches
 * the authenticated user (with populated role) to req.user.
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // 1. Check if Authorization header is present and correctly formatted
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided or invalid format. Expected format: Bearer <token>',
      });
    }

    // 2. Extract token from header
    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Token missing.',
      });
    }

    // 3. Verify JWT secret existence in environment
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('[Auth Middleware Error]: JWT_SECRET is not configured in environment variables');
      return res.status(500).json({
        success: false,
        message: 'Internal server error: Authentication configuration missing.',
      });
    }

    // 4. Verify the JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (tokenError) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token. Please log in again.',
      });
    }

    // 5. Fetch user from database to ensure they still exist and have a valid role
    const user = await User.findById(decoded.id).populate('role').select('-password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication failed. User no longer exists.',
      });
    }

    // 6. Attach user object to request
    req.user = user;
    next();
  } catch (error) {
    console.error('[Auth Middleware Error]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error during authentication.',
    });
  }
};

/**
 * Admin Authorization Middleware
 * Ensures the authenticated user possesses the 'Admin' role.
 * Must be used after authenticateToken.
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.role || req.user.role.name !== 'Admin') {
    return res.status(403).json({
      success: false,
      message: 'Access forbidden. Admin privileges required.',
    });
  }

  next();
};

module.exports = {
  authenticateToken,
  requireAdmin,
  authMiddleware: authenticateToken,
};
```

---

## 7. `src/controllers/authController.js`

```javascript
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
const { sendVerificationEmail } = require('../services/emailService');

const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address',
      });
    }

    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists',
      });
    }

    const customerRole = await Role.findOne({ name: 'Customer' });
    if (!customerRole) {
      return res.status(500).json({
        success: false,
        message: 'Customer role not found in database. Please run database seeder first.',
      });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const newUser = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: customerRole._id,
      isEmailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: tokenExpiry,
    });

    await sendVerificationEmail({
      to: newUser.email,
      name: newUser.name,
      verificationToken,
    });

    return res.status(201).json({
      success: true,
      message: 'Account created successfully. Please check your email to verify your account.',
      data: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: customerRole.name,
        isEmailVerified: newUser.isEmailVerified,
      },
    });
  } catch (error) {
    console.error('[Signup Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during signup. Please try again later.',
    });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Verification token is required in the query parameter',
      });
    }

    const user = await User.findOne({ emailVerificationToken: token });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification token. No matching user found.',
      });
    }

    if (!user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Verification token has expired. Please register again or request a new link.',
      });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    console.log(`[Auth] User ${user.email} verified email successfully.`);

    return res.status(200).json({
      success: true,
      message: 'Email has been successfully verified. Your account is now active.',
    });
  } catch (error) {
    console.error('[Verify Email Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during email verification. Please try again later.',
    });
  }
};

const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Invalid input format for email or password',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).populate('role');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    if (!user.role || user.role.name !== 'Admin') {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden. Only administrators are allowed to log in.',
      });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('[Admin Login Error]: JWT_SECRET is not configured in environment variables');
      return res.status(500).json({
        success: false,
        message: 'Internal server error: Authentication configuration missing.',
      });
    }

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role.name,
      },
      jwtSecret,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || '1d',
      }
    );

    console.log(`[Auth] Admin user '${user.email}' logged in successfully.`);

    return res.status(200).json({
      success: true,
      message: 'Admin login successful',
      data: {
        token,
        admin: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role.name,
        },
      },
    });
  } catch (error) {
    console.error('[Admin Login Error]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error during admin login. Please try again later.',
    });
  }
};

module.exports = {
  signup,
  verifyEmail,
  adminLogin,
};
```

---

## 8. `src/routes/authRoutes.js`

```javascript
const express = require('express');
const router = express.Router();
const { signup, verifyEmail, adminLogin } = require('../controllers/authController');

router.post('/signup', signup);
router.get('/verify-email', verifyEmail);
router.post('/admin/login', adminLogin);

module.exports = router;
```

---

## 9. `src/routes/adminRoutes.js`

```javascript
const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/authMiddleware');

router.get('/test', authenticateToken, requireAdmin, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to the Admin test route. Authorization successful!',
    data: {
      admin: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role.name,
      },
    },
  });
});

module.exports = router;
```

---

## 10. `src/seeders/initSetup.js`

```javascript
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const bcrypt = require('bcryptjs');
const { connectDB, disconnectDB } = require('../config/db');
const Role = require('../models/Role');
const User = require('../models/User');


const createRoles = async () => {
  console.log('[Roles] Initializing default roles...');

  const rolesToCreate = [
    { name: 'Admin', display: 'Administrator' },
    { name: 'Customer', display: 'Customer' },
    { name: 'Rider', display: 'Rider' },
    { name: 'Staff', display: 'Staff' },
  ];

  const rolePromises = rolesToCreate.map(async (role) => {
    const existingRole = await Role.findOne({ name: role.name });

    if (existingRole) {
      console.log(`  - Role '${role.name}' already exists. Skipping.`);
      return existingRole;
    }

    const newRole = await Role.create(role);

    console.log(
      `  + Role '${role.name}' created successfully (ID: ${newRole._id}).`
    );

    return newRole;
  });

  await Promise.all(rolePromises);

  console.log('[Roles] Role initialization complete.\n');
};

const createAdmin = async () => {
  console.log('[Admin] Initializing default Admin user...');

  const adminRole = await Role.findOne({ name: 'Admin' });

  if (!adminRole) {
    throw new Error("Admin role not found. Ensure createRoles() ran before createAdmin().");
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

    await createRoles();
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
```

---

## 11. `src/app.js`

```javascript
const express = require('express');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

module.exports = app;
```

---

## 12. `server.js`

```javascript
require('dotenv').config();

const app = require('./src/app');
const { connectDB } = require('./src/config/db');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`[Server] Express server running at http://localhost:${PORT}`);
      console.log(`[Server] Health Check available at http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error(`[Server] Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

startServer();
```

