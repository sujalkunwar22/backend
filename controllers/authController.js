const User = require('../models/User');
const LawyerProfile = require('../models/LawyerProfile');
const { generateToken } = require('../config/jwt');
const { validationResult } = require('express-validator');

// @route   POST /api/auth/register
// @desc    Register a new user (Client or Lawyer)
// @access  Public
exports.register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array(),
      });
    }

    const { email, password, role, firstName, lastName, phone, lawyerData, acceptedTerms, acceptedPrivacy } = req.body;

    // Validate terms and privacy acceptance
    if (!acceptedTerms || !acceptedPrivacy) {
      return res.status(400).json({
        success: false,
        message: 'You must accept both the Terms of Service and Privacy Policy to register',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists',
      });
    }

    // Validate role
    if (!['CLIENT', 'LAWYER'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be CLIENT or LAWYER',
      });
    }

    // Create user
    const user = await User.create({
      email,
      password,
      role,
      firstName,
      lastName,
      phone,
    });

    // If lawyer, create lawyer profile (only if lawyerData has required fields)
    if (role === 'LAWYER' && lawyerData && 
        lawyerData.barLicenseNumber && 
        lawyerData.specialization && 
        Array.isArray(lawyerData.specialization) && 
        lawyerData.specialization.length > 0 &&
        lawyerData.experience !== undefined && 
        lawyerData.hourlyRate !== undefined) {
      await LawyerProfile.create({
        user: user._id,
        barLicenseNumber: lawyerData.barLicenseNumber,
        specialization: lawyerData.specialization,
        experience: lawyerData.experience,
        hourlyRate: lawyerData.hourlyRate,
        bio: lawyerData.bio || '',
        education: lawyerData.education || [],
        languages: lawyerData.languages || [],
        availability: lawyerData.availability || {},
      });
    }

    // Generate token
    const token = generateToken(user._id, user.role);

    // Get user with populated lawyer profile if applicable
    let userResponse = user.toObject();
    if (role === 'LAWYER') {
      const profile = await LawyerProfile.findOne({ user: user._id });
      userResponse.lawyerProfile = profile;
    }

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          lawyerProfile: userResponse.lawyerProfile || null,
        },
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: error.message,
    });
  }
};

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
exports.login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array(),
      });
    }

    const { email, password } = req.body;

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is inactive. Please contact support.',
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Generate token
    const token = generateToken(user._id, user.role);

    // Get lawyer profile if applicable
    let lawyerProfile = null;
    if (user.role === 'LAWYER') {
      lawyerProfile = await LawyerProfile.findOne({ user: user._id });
    }

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          profilePicture: user.profilePicture,
          lawyerProfile: lawyerProfile,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: error.message,
    });
  }
};

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Get lawyer profile if applicable
    let lawyerProfile = null;
    if (user.role === 'LAWYER') {
      lawyerProfile = await LawyerProfile.findOne({ user: user._id });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          profilePicture: user.profilePicture,
          lawyerProfile: lawyerProfile,
        },
      },
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @route   GET /api/auth/user/:id
// @desc    Get user by ID
// @access  Private
exports.getUserById = async (req, res) => {
  try {
    const User = require('../models/User');
    const LawyerProfile = require('../models/LawyerProfile');
    
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Get lawyer profile if applicable
    let lawyerProfile = null;
    if (user.role === 'LAWYER') {
      lawyerProfile = await LawyerProfile.findOne({ user: user._id });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          profilePicture: user.profilePicture,
          lawyerProfile: lawyerProfile,
        },
      },
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @route   PATCH /api/auth/profile
// @desc    Update user profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Update allowed fields
    const allowedUpdates = ['firstName', 'lastName', 'phone'];
    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        user[field] = req.body[field];
      }
    });

    await user.save();

    // Get lawyer profile if applicable
    let lawyerProfile = null;
    if (user.role === 'LAWYER') {
      lawyerProfile = await LawyerProfile.findOne({ user: user._id });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          profilePicture: user.profilePicture,
          lawyerProfile: lawyerProfile,
        },
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

