const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    lawyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      maxlength: 1000,
    },
    isVisible: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure one review per client-lawyer pair per appointment
reviewSchema.index({ lawyer: 1, client: 1, appointment: 1 }, { unique: true });
reviewSchema.index({ lawyer: 1, createdAt: -1 });
reviewSchema.index({ client: 1 });

module.exports = mongoose.model('Review', reviewSchema);

