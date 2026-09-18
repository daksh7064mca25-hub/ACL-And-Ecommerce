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
