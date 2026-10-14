const { Server } = require('socket.io');
const { socketAuthMiddleware } = require('./auth');
const { registerSocketHandlers } = require('./handlers');

let io = null;

/**
 * Initialize Socket.IO with the HTTP server and configure CORS and Middleware.
 * 
 * @param {import('http').Server} httpServer - Node.js HTTP Server instance
 * @returns {Server} Socket.IO server instance
 */
const initSocket = (httpServer) => {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    process.env.ADMIN_FRONTEND_URL,
    process.env.CUSTOMER_FRONTEND_URL,
    process.env.FRONTEND_URL,
  ].filter(Boolean);

  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or Postman)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
          return callback(null, true);
        }
        // In local development, also allow 127.0.0.1 origins
        if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
          return callback(null, true);
        }
        return callback(null, true); // Dev-friendly fallback
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: true,
      allowedHeaders: ['Authorization', 'Content-Type'],
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  // Attach JWT Authentication Middleware
  io.use(socketAuthMiddleware);

  // Attach Connection and Room Event Handlers
  io.on('connection', (socket) => {
    registerSocketHandlers(io, socket);
  });

  console.log('[Socket] Socket.IO server initialized and listening for connections.');
  return io;
};

/**
 * Retrieve the active Socket.IO instance
 * @returns {Server|null}
 */
const getIO = () => {
  if (!io) {
    console.warn('[Socket Warning] Socket.IO instance has not been initialized yet.');
  }
  return io;
};

module.exports = {
  initSocket,
  getIO,
};
