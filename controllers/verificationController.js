const VerificationRequest = require('../models/VerificationRequest');
const LawyerProfile = require('../models/LawyerProfile');
const User = require('../models/User');
const createNotification = require('../utils/createNotification');

// @route   POST /api/verification/request
// @desc    Submit verification request (Lawyer)
// @access  Private (Lawyer only)
exports.submitVerificationRequest = async (req, res) => {
  try {
    if (req.user.role !== 'LAWYER') {
      return res.status(403).json({
        success: false,
        message: 'Only lawyers can submit verification requests',
      });
    }

    // Check if lawyer has a profile
    const lawyerProfile = await LawyerProfile.findOne({ user: req.user._id });
    if (!lawyerProfile) {
      return res.status(400).json({
        success: false,
        message: 'Please complete your lawyer profile before requesting verification',
      });
    }

    // Check if already verified
    if (lawyerProfile.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'Your profile is already verified',
      });
    }

    // Check if there's already a pending request
    const existingRequest = await VerificationRequest.findOne({
      lawyer: req.user._id,
      status: 'PENDING',
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending verification request',
      });
    }

    // Create verification request
    const verificationRequest = await VerificationRequest.create({
      lawyer: req.user._id,
      status: 'PENDING',
    });

    // Notify admins
    const admins = await User.find({ role: 'ADMIN', isActive: true });
    for (const admin of admins) {
      await createNotification(
        admin._id,
        'VERIFICATION_REQUEST',
        'New Verification Request',
        `${req.user.firstName} ${req.user.lastName} has submitted a verification request`,
        verificationRequest._id,
        'user'
      );
    }

    res.json({
      success: true,
      message: 'Verification request submitted successfully',
      data: { verificationRequest },
    });
  } catch (error) {
    console.error('Submit verification request error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @route   GET /api/verification/request/status
// @desc    Get verification request status (Lawyer)
// @access  Private (Lawyer only)
exports.getVerificationStatus = async (req, res) => {
  try {
    if (req.user.role !== 'LAWYER') {
      return res.status(403).json({
        success: false,
        message: 'Only lawyers can check verification status',
      });
    }

    const lawyerProfile = await LawyerProfile.findOne({ user: req.user._id });
    const verificationRequest = await VerificationRequest.findOne({
      lawyer: req.user._id,
    })
      .populate('reviewedBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        isVerified: lawyerProfile?.isVerified || false,
        verificationRequest: verificationRequest || null,
        profileComplete: !!lawyerProfile,
      },
    });
  } catch (error) {
    console.error('Get verification status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @route   GET /api/admin/verification/requests
// @desc    Get all verification requests (Admin)
// @access  Private (Admin only)
exports.getVerificationRequests = async (req, res) => {
  try {
    const { status } = req.query;

    const query = {};
    if (status) {
      query.status = status;
    }

    const requests = await VerificationRequest.find(query)
      .populate('lawyer', 'firstName lastName email phone profilePicture createdAt')
      .populate('reviewedBy', 'firstName lastName email')
      .sort({ submittedAt: -1 });

    // Get lawyer profiles for each request
    const requestsWithProfiles = await Promise.all(
      requests.map(async (request) => {
        const profile = await LawyerProfile.findOne({ user: request.lawyer._id });
        return {
          ...request.toObject(),
          lawyerProfile: profile,
        };
      })
    );

    res.json({
      success: true,
      data: {
        requests: requestsWithProfiles,
        total: requestsWithProfiles.length,
      },
    });
  } catch (error) {
    console.error('Get verification requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @route   PATCH /api/admin/verification/requests/:id/reject
// @desc    Reject verification request (Admin)
// @access  Private (Admin only)
exports.rejectVerificationRequest = async (req, res) => {
  try {
    const { rejectionReason } = req.body;

    const verificationRequest = await VerificationRequest.findById(req.params.id);
    if (!verificationRequest) {
      return res.status(404).json({
        success: false,
        message: 'Verification request not found',
      });
    }

    verificationRequest.status = 'REJECTED';
    verificationRequest.reviewedAt = new Date();
    verificationRequest.reviewedBy = req.user._id;
    verificationRequest.rejectionReason = rejectionReason || 'Verification request rejected';

    await verificationRequest.save();

    // Notify lawyer
    await createNotification(
      verificationRequest.lawyer,
      'VERIFICATION_REJECTED',
      'Verification Request Rejected',
      `Your verification request has been rejected. ${rejectionReason || 'Please review your profile and try again.'}`,
      verificationRequest._id,
      'user'
    );

    res.json({
      success: true,
      message: 'Verification request rejected',
      data: { verificationRequest },
    });
  } catch (error) {
    console.error('Reject verification request error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

