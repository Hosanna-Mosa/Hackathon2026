const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema(
  {
    person: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['email', 'whatsapp', 'direct_link'],
      required: true
    },
    recipientEmail: {
      type: String,
      trim: true
    },
    subject: {
      type: String,
      trim: true
    },
    message: {
      type: String,
      trim: true
    },
    photoLinks: {
      type: [String],
      default: []
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'failed'],
      default: 'pending'
    },
    providerMessageId: {
      type: String,
      trim: true
    },
    errorMessage: {
      type: String,
      trim: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Delivery', deliverySchema);
