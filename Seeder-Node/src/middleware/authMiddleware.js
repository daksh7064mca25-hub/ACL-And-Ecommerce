const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
const Permission = require('../models/Permission');

/**
 * Authentication Middleware
 * Validates the JWT Bearer token from the Authorization header and attaches
 * the authenticated user (with populated role and permissions) to req.user.
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

    // 5. Fetch user from database with populated role and nested permissions
    const user = await User.findById(decoded.id)
      .populate({
        path: 'role',
        populate: {
          path: 'permissions',
          model: 'Permission',
        },
      })
      .select('-password');

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
 * Permission-Based Authorization Middleware (ACL)
 * Verifies whether the authenticated user's assigned role possesses the specified permission.
 * Must be used after authenticateToken.
 *
 * @param {string} permissionName - Name of the required permission (e.g. 'users:read', 'promotions:send')
 */
const requirePermission = (permissionName) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action.',
      });
    }

    const permissions = req.user.role.permissions || [];
    const hasPerm = permissions.some((perm) => {
      if (typeof perm === 'string') return perm === permissionName;
      return perm && perm.name === permissionName;
    });

    if (!hasPerm) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action.',
      });
    }

    next();
  };
};

/**
 * Admin Authorization Middleware (Role-based legacy check)
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
  requirePermission,
  requireAdmin,
  authMiddleware: authenticateToken,
};
