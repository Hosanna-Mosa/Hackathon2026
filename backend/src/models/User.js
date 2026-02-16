const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: true,
      select: false
    },
    photos: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Photo'
        }
      ],
      default: []
    },
    faces: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Face'
        }
      ],
      default: []
    },
    people: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Person'
        }
      ],
      default: []
    },
    deliveries: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Delivery'
        }
      ],
      default: []
    }
  },
  { timestamps: true }
);
module.exports = mongoose.model('User', userSchema);