const mongoose = require('mongoose');

const buildMongoHelpMessage = (error) => {
  const message = String(error?.message || '');

  if (message.includes('IP that isn\'t whitelisted') || message.includes('Could not connect to any servers in your MongoDB Atlas cluster')) {
    return (
      `${message}\n` +
      'Atlas fix: add your current IP in Network Access, or temporarily allow 0.0.0.0/0 for development.'
    );
  }

  if (message.includes('querySrv ENOTFOUND')) {
    return `${message}\nDNS lookup failed for the MongoDB SRV host. Check internet/VPN/firewall and URI host.`;
  }

  return message;
};

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error('MONGO_URI is missing in environment variables.');
  }

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000
    });
  } catch (error) {
    throw new Error(buildMongoHelpMessage(error));
  }

  console.log('MongoDB connected');
};

module.exports = connectDB;
