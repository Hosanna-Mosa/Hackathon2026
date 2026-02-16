const mongoose = require('mongoose');

const chatHistorySchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    prompt: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },
    command: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },
    status: {
      type: String,
      enum: ['success', 'failed'],
      default: 'success',
      index: true
    },
    agentDecision: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    assistant: {
      action: {
        type: String,
        default: 'unknown'
      },
      message: {
        type: String,
        default: ''
      },
      data: {
        type: mongoose.Schema.Types.Mixed,
        default: null
      }
    },
    errorMessage: {
      type: String,
      default: null,
      trim: true
    }
  },
  { timestamps: true }
);

chatHistorySchema.index({ ownerId: 1, createdAt: -1 });

module.exports = mongoose.model('ChatHistory', chatHistorySchema);
