const mongoose = require('mongoose');

const lawyerProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    barLicenseNumber: {
      type: String,
      required: [true, 'Bar license number is required'],
      unique: true,
    },
    specialization: {
      type: [String],
      required: [true, 'At least one specialization is required'],
      enum: [
        'Criminal Law',
        'Civil Law',
        'Corporate Law',
        'Family Law',
        'Property Law',
        'Tax Law',
        'Immigration Law',
        'Labor Law',
        'Intellectual Property',
        'Constitutional Law',
        'Other',
      ],
    },
    experience: {
      type: Number,
      required: [true, 'Years of experience is required'],
      min: 0,
    },
    hourlyRate: {
      type: Number,
      required: [true, 'Hourly rate is required'],
      min: 0,
    },
    bio: {
      type: String,
      maxlength: 1000,
    },
    education: [
      {
        degree: String,
        institution: String,
        year: Number,
      },
    ],
    languages: [String],
    availability: {
      monday: { available: Boolean, startTime: String, endTime: String },
      tuesday: { available: Boolean, startTime: String, endTime: String },
      wednesday: { available: Boolean, startTime: String, endTime: String },
      thursday: { available: Boolean, startTime: String, endTime: String },
      friday: { available: Boolean, startTime: String, endTime: String },
      saturday: { available: Boolean, startTime: String, endTime: String },
      sunday: { available: Boolean, startTime: String, endTime: String },
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

lawyerProfileSchema.index({ user: 1 });
lawyerProfileSchema.index({ specialization: 1 });
lawyerProfileSchema.index({ rating: -1 });

module.exports = mongoose.model('LawyerProfile', lawyerProfileSchema);

