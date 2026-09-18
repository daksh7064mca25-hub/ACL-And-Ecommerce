
require('dotenv').config();

const app = require('./src/app');
const { connectDB } = require('./src/config/db');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {

    await connectDB();

    app.listen(PORT, () => {
      console.log(`[Server] Express server running at http://localhost:${PORT}`);
      // console.log(`[Server] Health Check available at http://localhost:${PORT}/api/health`);
    });
  } 
  
  catch (error) {
    console.error(`[Server] Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

startServer();
