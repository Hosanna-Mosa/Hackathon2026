const mongoose = require('mongoose');

const personSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
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

module.exports = mongoose.model('Person', personSchema);
