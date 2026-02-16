const mongoose = require('mongoose');

const photoSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    // Public URL returned by VPS cloud upload server.
    imageUrl: {
      type: String,
      required: true,
      trim: true
    },
    folder: {
      type: String,
      required: true,
      trim: true
    },
    faceCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    detectionResult: {
      totalPersons: {
        type: Number,
        default: 0,
        min: 0
      },
      validFaces: {
        type: Number,
        default: 0,
        min: 0
      },
      uncertainPersons: {
        type: Number,
        default: 0,
        min: 0
      }
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: true }
  }
);

module.exports = mongoose.model('Photo', photoSchema);
