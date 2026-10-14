const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Socket.IO Authentication Middleware
 * Reuses the existing JWT authentication mechanism.
 * Extracts and verifies JWT from handshake auth token, authorization header, or query.
 */
const socketAuthMiddleware = async (socket, next) => {
  try {
    const authHeader = socket.handshake.auth?.token ||
                       socket.handshake.headers?.authorization ||
                       socket.handshake.query?.token;

    // If no token is provided, mark as guest (can only receive public broadcasts)
    if (!authHeader) {
      socket.user = null;
      console.log(`[Socket Auth] Unauthenticated guest connection established (${socket.id})`);
      return next();
    }

    // Extract Bearer token if prefixed
    let token = authHeader;
    if (typeof token === 'string' && token.startsWith('Bearer ')) {
      token = token.slice(7).trim();
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('[Socket Auth Error]: JWT_SECRET is not configured in environment variables');
      return next(new Error('Server authentication configuration missing'));
    }

    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (tokenErr) {
      console.warn(`[Socket Auth Warning]: Token verification failed for socket ${socket.id}: ${tokenErr.message}`);
      return next(new Error('Authentication error: Invalid or expired token'));
    }

    if (!decoded || !decoded.id) {
      return next(new Error('Authentication error: Invalid token payload'));
    }

    // Fetch user from MongoDB with populated role
    const user = await User.findById(decoded.id).populate('role').select('-password');
    if (!user) {
      console.warn(`[Socket Auth Warning]: User not found for token id ${decoded.id}`);
      return next(new Error('Authentication error: User no longer exists'));
    }

    const roleName = user.role ? (user.role.name || user.role) : (decoded.role || 'Customer');

    socket.user = {
      id: user._id.toString(),
      role: roleName,
      email: user.email,
      name: user.name,
    };

    console.log(`[Socket Auth] Socket authenticated: ${user.email} [Role: ${roleName}] (Socket: ${socket.id})`);
    return next();
  } catch (error) {
    console.error('[Socket Auth Exception]:', error.message);
    return next(new Error('Internal server error during socket authentication'));
  }
};

module.exports = {
  socketAuthMiddleware,
};
