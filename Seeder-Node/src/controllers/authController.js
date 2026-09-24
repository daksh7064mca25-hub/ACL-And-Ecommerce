const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
const { sendVerificationEmail } = require('../services/emailService');

/**
 * Customer Signup Controller
 * POST /api/auth/signup
 */
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

/**
 * Email Verification Controller
 * GET /api/auth/verify-email?token=TOKEN
 */
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;

    // 1. Validate token query parameter
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Verification token is required in the query parameter',
      });
    }

    // 2. Find user by verification token
    const user = await User.findOne({ emailVerificationToken: token });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification token. No matching user found.',
      });
    }

    // 3. Check if the verification token has expired
    if (!user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Verification token has expired. Please register again or request a new link.',
      });
    }

    // 4. Update user verification status and clear the token fields
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    console.log(`[Auth] User ${user.email} verified email successfully.`);

    // 5. Return success response
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

/**
 * Admin Login Controller
 * POST /api/auth/admin/login
 * Only allows users with the 'Admin' role to authenticate.
 */
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Validate request body
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

    // 2. Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // 3. Find user and populate their assigned role
    const user = await User.findOne({ email: normalizedEmail }).populate('role');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // 4. Verify password with stored bcrypt hash
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // 5. Verify user role is strictly 'Admin'
    if (!user.role || user.role.name !== 'Admin') {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden. Only administrators are allowed to log in.',
      });
    }

    // 6. Generate JWT token
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

    // 7. Return success response (never exposing password)
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

/**
 * Customer Login Controller
 * POST /api/auth/customer/login or POST /api/auth/login
 */
const customerLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
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

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(500).json({
        success: false,
        message: 'Authentication configuration missing',
      });
    }

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role ? user.role.name : 'Customer',
      },
      jwtSecret,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role ? user.role.name : 'Customer',
          isEmailVerified: user.isEmailVerified,
        },
      },
    });
  } catch (error) {
    console.error('[Customer Login Error]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error during login. Please try again later.',
    });
  }
};

module.exports = {
  signup,
  verifyEmail,
  adminLogin,
  customerLogin,
};

