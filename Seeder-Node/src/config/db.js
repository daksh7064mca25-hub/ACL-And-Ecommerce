require('dotenv').config();
const mongoose = require('mongoose');

/**
 * Sanitizes MongoDB URIs by masking sensitive password credentials in logs.
 * Example: mongodb+srv://user:myPassword123@cluster0.net -> mongodb+srv://user:****@cluster0.net
 */
const sanitizeMongoUri = (uri) => {
  if (!uri || typeof uri !== 'string') return '';
  return uri.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)[^@]+(@.+)/i, '$1****$2');
};

/**
 * Sanitizes error messages in case database credentials leak into exception strings.
 */
const sanitizeErrorMessage = (message) => {
  if (!message || typeof message !== 'string') return '';
  return message.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)[^@]+(@.+)/gi, '$1****$2');
};

/**
 * Checks if a URI targets a local loopback interface.
 */
const isLocalhostUri = (uri) => {
  if (!uri || typeof uri !== 'string') return false;
  return /:\/\/(localhost|127\.0\.0\.1|::1)(:|\/|$)/i.test(uri);
};

/**
 * Resolves the MongoDB connection URI based on environment variables and runtime environment.
 */
const getMongoURI = () => {
  // Check common environment variable aliases: MONGODB_URI (Render/Atlas standard), MONGO_URI, DATABASE_URL
  const configuredUri = (
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    process.env.DATABASE_URL ||
    ''
  ).trim();

  const isProduction =
    process.env.NODE_ENV === 'production' ||
    process.env.RENDER === 'true';

  if (isProduction) {
    if (!configuredUri) {
      throw new Error(
        '[Database] Missing production database configuration: Neither MONGODB_URI nor MONGO_URI is defined. ' +
        'Please configure your cloud MongoDB Atlas connection string in the Render environment variables dashboard ' +
        '(e.g., MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/<database>?retryWrites=true&w=majority).'
      );
    }

    if (isLocalhostUri(configuredUri)) {
      throw new Error(
        `[Database] Invalid production database configuration: Detected localhost URI (${sanitizeMongoUri(configuredUri)}). ` +
        'Render cloud instances cannot connect to localhost:27017 because there is no local MongoDB server running inside the container. ' +
        'Please update MONGODB_URI in Render with your remote MongoDB Atlas connection string.'
      );
    }

    return configuredUri;
  }

  // Local Development: Use configured URI if available, otherwise fallback to local MongoDB instance
  if (configuredUri) {
    return configuredUri;
  }

  const localFallback = 'mongodb://localhost:27017/seeder_demo_db';
  console.log(`[Database] No cloud database URI provided. Defaulting to local MongoDB: ${localFallback}`);
  return localFallback;
};

const connectDB = async () => {
  let targetURI = '';
  try {
    targetURI = getMongoURI();

    const conn = await mongoose.connect(targetURI, {
      serverSelectionTimeoutMS: 10000, // Fail fast (10s) instead of hanging indefinitely if network/IP is blocked
    });

    console.log(`[Database] MongoDB connected successfully to host: ${conn.connection.host} (database: ${conn.connection.name})`);
    return conn;
  } catch (error) {
    const sanitizedMsg = sanitizeErrorMessage(error.message);
    const maskedTarget = sanitizeMongoUri(targetURI);
    console.error(`[Database] Error connecting to MongoDB: ${sanitizedMsg}`);
    if (maskedTarget) {
      console.error(`[Database] Attempted target: ${maskedTarget}`);
    }
    throw error;
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    console.log('[Database] MongoDB connection closed successfully.');
  } catch (error) {
    console.error(`[Database] Error disconnecting from MongoDB: ${sanitizeErrorMessage(error.message)}`);
    throw error;
  }
};

module.exports = {
  connectDB,
  disconnectDB,
  sanitizeMongoUri,
  getMongoURI,
};
