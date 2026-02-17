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
    },
    // Metadata for search
    event: {
      type: String,
      trim: true,
      default: null,
      index: true
    },
    location: {
      type: String,
      trim: true,
      default: null,
      index: true
    },
    tags: {
      type: [String],
      default: [],
      index: true
    },
    date: {
      type: Date,
      default: Date.now,
      index: true
    },
    analyzed: {
      type: Boolean,
      default: false
    },
    isPrivate: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: true }
  }
);

module.exports = mongoose.model('Photo', photoSchema);
