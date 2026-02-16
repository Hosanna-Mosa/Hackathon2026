const mongoose = require('mongoose');

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error('MONGO_URI is missing in environment variables.');
  }

  console.log('Attempting to connect to MongoDB...');
  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      family: 4 // Force IPv4 to avoid potential IPv6 issues
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error detail:', error);
    throw error;
  }
};

module.exports = connectDB;
