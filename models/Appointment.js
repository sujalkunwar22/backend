const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    lawyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'PROPOSED', 'CONFIRMED', 'CANCELLED', 'COMPLETED'],
      default: 'PENDING',
    },
    proposedDate: {
      type: Date,
      required: true,
    },
    proposedTime: {
      type: String,
      required: true,
    },
    confirmedDate: {
      type: Date,
      default: null,
    },
    confirmedTime: {
      type: String,
      default: null,
    },
    reason: {
      type: String,
      required: [true, 'Reason for appointment is required'],
      maxlength: 500,
    },
    notes: {
      type: String,
      maxlength: 1000,
    },
    clientConfirmation: {
      type: Boolean,
      default: false,
    },
    lawyerConfirmation: {
      type: Boolean,
      default: false,
    },
    meetingLink: {
      type: String,
      default: null,
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
appointmentSchema.index({ client: 1, createdAt: -1 });
appointmentSchema.index({ lawyer: 1, createdAt: -1 });
appointmentSchema.index({ status: 1 });
appointmentSchema.index({ confirmedDate: 1 });

// Virtual for conversation ID generation
appointmentSchema.virtual('getConversationId').get(function () {
  return this.conversationId || this._id;
});

module.exports = mongoose.model('Appointment', appointmentSchema);

