const mongoose = require('mongoose');

const personSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    embeddings: {
      // Learning memory: one embedding per confirmed label event.
      type: [[Number]],
      default: []
    },
    averageEmbedding: {
      // Optional centroid used for diagnostics/possible future acceleration.
      type: [Number],
      default: []
    },
    imageUrl: {
      type: String,
      trim: true,
      default: ''
    }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

personSchema.index({ ownerId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Person', personSchema);
