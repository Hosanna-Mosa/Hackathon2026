const mongoose = require('mongoose');

const faceSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    photoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Photo',
      required: true,
      index: true
    },
    box: {
      x: { type: Number, required: true, min: 0 },
      y: { type: Number, required: true, min: 0 },
      width: { type: Number, required: true, min: 1 },
      height: { type: Number, required: true, min: 1 }
    },
    personId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      default: null,
      index: true
    },
    embedding: {
      type: [Number],
      default: []
    },
    // Set true only after user confirms label so identity memory can learn safely.
    learningConfirmed: {
      type: Boolean,
      default: false
    },
    orderIndex: {
      type: Number,
      min: 0,
      default: 0
    }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model('Face', faceSchema);
