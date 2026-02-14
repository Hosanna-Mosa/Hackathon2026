require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/db');
const { preloadFaceApiModels } = require('./services/faceApiLoader');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    // Face-api models are loaded once and reused across all requests.
    try {
      await preloadFaceApiModels();
    } catch (faceApiError) {
      console.warn('[faceapi-loader] preload skipped:', faceApiError.message);
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to boot server:', error.message);
    process.exit(1);
  }
};

startServer();
