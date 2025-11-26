const User = require('../models/User');
const LawyerProfile = require('../models/LawyerProfile');
const Appointment = require('../models/Appointment');
const LegalTemplate = require('../models/LegalTemplate');
const Document = require('../models/Document');

// @route   GET /api/admin/stats
// @desc    Get admin dashboard statistics
// @access  Private (Admin only)
exports.getStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalClients = await User.countDocuments({ role: 'CLIENT' });
    const totalLawyers = await User.countDocuments({ role: 'LAWYER' });
    const totalAdmins = await User.countDocuments({ role: 'ADMIN' });
    const totalAppointments = await Appointment.countDocuments();
    const totalTemplates = await LegalTemplate.countDocuments();
    const totalDocuments = await Document.countDocuments();
    
    // Count pending lawyer verifications
    const pendingVerifications = await LawyerProfile.countDocuments({ isVerified: false });

    const appointmentsByStatus = await Appointment.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        totalClients,
        totalLawyers,
        totalAdmins,
        totalAppointments,
        totalTemplates,
        totalDocuments,
        pendingVerifications,
        appointmentsByStatus,
      },
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @route   GET /api/admin/users
// @desc    Get all users (Admin)
// @access  Private (Admin only)
exports.getUsers = async (req, res) => {
  try {
    const { role, page = 1, limit = 20 } = req.query;

    const query = {};
    
    // Always exclude admins from user management (for security)
    // Only show CLIENT and LAWYER roles
    if (role && role !== 'ADMIN') {
      query.role = role;
    } else {
      // If no role filter or filtering for non-admin, exclude admins
      query.role = { $ne: 'ADMIN' };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @route   GET /api/admin/users/:id
// @desc    Get user by ID (Admin)
// @access  Private (Admin only)
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('lawyerProfile');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @route   PATCH /api/admin/users/:id
// @desc    Update user details (Admin)
// @access  Private (Admin only)
exports.updateUser = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, role } = req.body;
    const updateData = {};

    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (role !== undefined) {
      // Prevent changing admin role for security
      const user = await User.findById(req.params.id);
      if (user && user.role === 'ADMIN' && role !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Cannot change admin role',
        });
      }
      updateData.role = role;
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      message: 'User updated successfully',
      data: { user },
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @route   PATCH /api/admin/users/:id/password
// @desc    Change user password (Admin)
// @access  Private (Admin only)
exports.changeUserPassword = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long',
      });
    }

    const user = await User.findById(req.params.id).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Set new password (will be hashed by pre-save hook)
    user.password = password;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @route   PATCH /api/admin/users/:id/status
// @desc    Update user status (Admin)
// @access  Private (Admin only)
exports.updateUserStatus = async (req, res) => {
  try {
    const { isActive } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      message: 'User status updated',
      data: { user },
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @route   PATCH /api/admin/lawyers/:id/verify
// @desc    Verify lawyer (Admin)
// @access  Private (Admin only)
exports.verifyLawyer = async (req, res) => {
  try {
    const { hourlyRate } = req.body;
    const updateData = { isVerified: true };
    
    // If hourly rate is provided, update it
    if (hourlyRate !== undefined) {
      if (hourlyRate < 0) {
        return res.status(400).json({
          success: false,
          message: 'Hourly rate must be a positive number',
        });
      }
      updateData.hourlyRate = hourlyRate;
    }

    const lawyerProfile = await LawyerProfile.findOneAndUpdate(
      { user: req.params.id },
      updateData,
      { new: true }
    ).populate('user', 'firstName lastName email');

    if (!lawyerProfile) {
      return res.status(404).json({
        success: false,
        message: 'Lawyer profile not found',
      });
    }

    // Update verification request status if exists
    const VerificationRequest = require('../models/VerificationRequest');
    const verificationRequest = await VerificationRequest.findOne({
      lawyer: req.params.id,
      status: 'PENDING',
    });

    if (verificationRequest) {
      verificationRequest.status = 'APPROVED';
      verificationRequest.reviewedAt = new Date();
      verificationRequest.reviewedBy = req.user._id;
      await verificationRequest.save();

      // Notify lawyer
      const createNotification = require('../utils/createNotification');
      await createNotification(
        req.params.id,
        'VERIFICATION_APPROVED',
        'Account Verified!',
        'Congratulations! Your account has been verified. You can now edit your hourly rate and your profile will show a verification badge.',
        lawyerProfile._id,
        'user'
      );
    }

    res.json({
      success: true,
      message: 'Lawyer verified successfully',
      data: { lawyer: lawyerProfile },
    });
  } catch (error) {
    console.error('Verify lawyer error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

