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
      enum: ['email', 'whatsapp'],
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Delivery', deliverySchema);
