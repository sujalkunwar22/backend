const Review = require('../models/Review');
const LawyerProfile = require('../models/LawyerProfile');
const Appointment = require('../models/Appointment');
const { validationResult } = require('express-validator');

// @route   POST /api/reviews
// @desc    Create a review for a lawyer
// @access  Private (Client only)
exports.createReview = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array(),
      });
    }

    if (req.user.role !== 'CLIENT') {
      return res.status(403).json({
        success: false,
        message: 'Only clients can create reviews',
      });
    }

    const { lawyerId, appointmentId, rating, comment } = req.body;

    // Verify lawyer exists
    const User = require('../models/User');
    const lawyer = await User.findOne({ _id: lawyerId, role: 'LAWYER' });
    if (!lawyer) {
      return res.status(404).json({
        success: false,
        message: 'Lawyer not found',
      });
    }

    // Verify appointment exists and belongs to client-lawyer pair (if provided)
    if (appointmentId) {
      const appointment = await Appointment.findById(appointmentId);
      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: 'Appointment not found',
        });
      }
      if (appointment.client.toString() !== req.user._id.toString() ||
          appointment.lawyer.toString() !== lawyerId) {
        return res.status(403).json({
          success: false,
          message: 'Appointment does not belong to this client-lawyer pair',
        });
      }
    }

    // Check if review already exists for this appointment
    const existingReview = await Review.findOne({
      lawyer: lawyerId,
      client: req.user._id,
      appointment: appointmentId || null,
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this lawyer for this appointment',
      });
    }

    // Create review
    const review = await Review.create({
      lawyer: lawyerId,
      client: req.user._id,
      appointment: appointmentId || null,
      rating,
      comment: comment || '',
    });

    // Update lawyer profile rating
    await updateLawyerRating(lawyerId);

    await review.populate([
      { path: 'lawyer', select: 'firstName lastName' },
      { path: 'client', select: 'firstName lastName' },
    ]);

    res.status(201).json({
      success: true,
      message: 'Review created successfully',
      data: { review },
    });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @route   GET /api/reviews/lawyer/:lawyerId
// @desc    Get reviews for a lawyer
// @access  Public
exports.getLawyerReviews = async (req, res) => {
  try {
    const { lawyerId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const reviews = await Review.find({
      lawyer: lawyerId,
      isVisible: true,
    })
      .populate('client', 'firstName lastName profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Review.countDocuments({
      lawyer: lawyerId,
      isVisible: true,
    });

    res.json({
      success: true,
      data: {
        reviews,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Get lawyer reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @route   GET /api/reviews/mine
// @desc    Get user's reviews (as client or lawyer)
// @access  Private
exports.getMyReviews = async (req, res) => {
  try {
    const { role } = req.query;
    const query = {};

    if (req.user.role === 'CLIENT') {
      query.client = req.user._id;
    } else if (req.user.role === 'LAWYER') {
      query.lawyer = req.user._id;
    }

    const reviews = await Review.find(query)
      .populate('lawyer', 'firstName lastName profilePicture')
      .populate('client', 'firstName lastName profilePicture')
      .populate('appointment')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: { reviews },
    });
  } catch (error) {
    console.error('Get my reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// Helper function to update lawyer rating
async function updateLawyerRating(lawyerId) {
  const reviews = await Review.find({
    lawyer: lawyerId,
    isVisible: true,
  });

  if (reviews.length === 0) {
    return;
  }

  const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
  const averageRating = totalRating / reviews.length;

  await LawyerProfile.findOneAndUpdate(
    { user: lawyerId },
    {
      rating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
      totalReviews: reviews.length,
    }
  );
}

