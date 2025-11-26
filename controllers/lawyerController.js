const LawyerProfile = require('../models/LawyerProfile');
const User = require('../models/User');
const Appointment = require('../models/Appointment');

// @route   GET /api/lawyers
// @desc    Get all lawyers with filters
// @access  Public (or Private)
exports.getLawyers = async (req, res) => {
  try {
    const { specialization, search, minRating, page = 1, limit = 20 } = req.query;

    // Query users with role LAWYER (exclude admins)
    const userQuery = { role: 'LAWYER', isActive: true };

    if (search) {
      userQuery.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Find all users with role LAWYER
    const lawyers = await User.find(userQuery)
      .select('_id firstName lastName email phone profilePicture role createdAt updatedAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await User.countDocuments(userQuery);

    // Get all lawyer IDs
    const lawyerIds = lawyers.map((lawyer) => lawyer._id);

    // Get all profiles for these lawyers in one query
    const profiles = await LawyerProfile.find({ user: { $in: lawyerIds } });
    const profileMap = new Map();
    profiles.forEach((profile) => {
      profileMap.set(profile.user.toString(), profile);
    });

    // Combine users with their profiles
    const lawyersWithProfiles = lawyers
      .map((lawyer) => {
        const profile = profileMap.get(lawyer._id.toString());

        // Apply filters
        if (specialization) {
          if (!profile || !profile.specialization.includes(specialization)) {
            return null;
          }
        }

        if (minRating) {
          if (!profile || profile.rating < parseFloat(minRating)) {
            return null;
          }
        }

        // Build user object with all fields
        const userObj = {
          _id: lawyer._id.toString(),
          id: lawyer._id.toString(),
          firstName: lawyer.firstName,
          lastName: lawyer.lastName,
          email: lawyer.email,
          phone: lawyer.phone,
          profilePicture: lawyer.profilePicture,
          role: lawyer.role,
          createdAt: lawyer.createdAt,
          updatedAt: lawyer.updatedAt,
        };

        if (profile) {
          return {
            user: userObj,
            // Also include user fields at root level for easier access
            _id: lawyer._id.toString(),
            id: lawyer._id.toString(),
            firstName: lawyer.firstName,
            lastName: lawyer.lastName,
            email: lawyer.email,
            phone: lawyer.phone,
            profilePicture: lawyer.profilePicture,
            role: lawyer.role,
            ...profile.toObject(),
          };
        } else {
          // Return lawyer without profile
          return {
            user: userObj,
            // Also include user fields at root level for easier access
            _id: lawyer._id.toString(),
            id: lawyer._id.toString(),
            firstName: lawyer.firstName,
            lastName: lawyer.lastName,
            email: lawyer.email,
            phone: lawyer.phone,
            profilePicture: lawyer.profilePicture,
            role: lawyer.role,
            barLicenseNumber: null,
            specialization: [],
            experience: 0,
            hourlyRate: 0,
            bio: null,
            rating: 0,
            totalReviews: 0,
            isVerified: false,
            createdAt: null,
            updatedAt: null,
          };
        }
      })
      .filter((lawyer) => lawyer !== null);

    res.json({
      success: true,
      data: {
        lawyers: lawyersWithProfiles,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Get lawyers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @route   GET /api/lawyers/:id
// @desc    Get lawyer profile by ID
// @access  Public
exports.getLawyerById = async (req, res) => {
  try {
    const lawyerProfile = await LawyerProfile.findOne({ user: req.params.id })
      .populate('user', 'firstName lastName email phone profilePicture role');

    if (!lawyerProfile) {
      return res.status(404).json({
        success: false,
        message: 'Lawyer not found',
      });
    }

    res.json({
      success: true,
      data: { lawyer: lawyerProfile },
    });
  } catch (error) {
    console.error('Get lawyer error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @route   PATCH /api/lawyers/profile
// @desc    Update lawyer profile (create if doesn't exist)
// @access  Private (Lawyer only)
exports.updateProfile = async (req, res) => {
  try {
    if (req.user.role !== 'LAWYER') {
      return res.status(403).json({
        success: false,
        message: 'Only lawyers can update their profile',
      });
    }

    let lawyerProfile = await LawyerProfile.findOne({ user: req.user._id });

    // If profile doesn't exist, create it
    if (!lawyerProfile) {
      const { specialization, experience, hourlyRate, barLicenseNumber, bio } = req.body;

      // Validate required fields for new profile
      if (!specialization || specialization.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one specialization is required',
        });
      }

      if (experience === undefined || experience < 0) {
        return res.status(400).json({
          success: false,
          message: 'Years of experience is required',
        });
      }

      if (hourlyRate === undefined || hourlyRate < 0) {
        return res.status(400).json({
          success: false,
          message: 'Hourly rate is required',
        });
      }

      // Check if barLicenseNumber is provided
      if (!barLicenseNumber || barLicenseNumber.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Bar license number is required',
        });
      }

      lawyerProfile = await LawyerProfile.create({
        user: req.user._id,
        barLicenseNumber: barLicenseNumber,
        specialization: specialization,
        experience: experience,
        hourlyRate: hourlyRate,
        bio: bio || '',
        rating: 0,
        totalReviews: 0,
        isVerified: false,
      });
    } else {
      // Update existing profile
      // Check if trying to update hourly rate without verification
      if (req.body.hourlyRate !== undefined && !lawyerProfile.isVerified) {
        return res.status(403).json({
          success: false,
          message: 'You cannot update your hourly rate until your profile is verified by an admin',
        });
      }

      const allowedUpdates = [
        'specialization',
        'experience',
        'hourlyRate',
        'bio',
        'barLicenseNumber',
        'education',
        'languages',
        'availability',
      ];

      allowedUpdates.forEach((field) => {
        if (req.body[field] !== undefined) {
          lawyerProfile[field] = req.body[field];
        }
      });

      await lawyerProfile.save();
    }

    await lawyerProfile.populate('user', 'firstName lastName email phone profilePicture role');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { lawyer: lawyerProfile },
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

// @route   GET /api/lawyers/my-clients
// @desc    Get all unique clients for the logged-in lawyer
// @access  Private (Lawyer only)
exports.getMyClients = async (req, res) => {
  try {
    if (req.user.role !== 'LAWYER') {
      return res.status(403).json({
        success: false,
        message: 'Only lawyers can access their clients',
      });
    }

    // Get all appointments for this lawyer
    const appointments = await Appointment.find({ lawyer: req.user._id })
      .populate('client', 'firstName lastName email phone profilePicture role')
      .select('client status createdAt updatedAt')
      .sort({ createdAt: -1 });

    // Get unique clients with their appointment stats
    const clientMap = new Map();

    appointments.forEach((appointment) => {
      const clientId = appointment.client._id.toString();
      
      if (!clientMap.has(clientId)) {
        clientMap.set(clientId, {
          client: appointment.client,
          totalAppointments: 0,
          pendingAppointments: 0,
          confirmedAppointments: 0,
          completedAppointments: 0,
          lastAppointmentDate: null, // Will be set from first non-cancelled appointment
        });
      }

      const clientData = clientMap.get(clientId);
      
      // Only count non-cancelled appointments
      if (appointment.status !== 'CANCELLED') {
        clientData.totalAppointments++;
        
        // Update last appointment date only for non-cancelled appointments
        if (clientData.lastAppointmentDate === null || 
            appointment.createdAt > clientData.lastAppointmentDate) {
          clientData.lastAppointmentDate = appointment.createdAt;
        }
      }

      switch (appointment.status) {
        case 'PENDING':
        case 'PROPOSED':
          clientData.pendingAppointments++;
          break;
        case 'CONFIRMED':
          clientData.confirmedAppointments++;
          break;
        case 'COMPLETED':
          clientData.completedAppointments++;
          break;
        case 'CANCELLED':
          // Don't count cancelled appointments in stats
          break;
      }
    });

    // Convert map to array and filter out clients with only cancelled appointments
    // (clients should only appear if they have at least one non-cancelled appointment)
    const clients = Array.from(clientMap.values())
      .filter((clientData) => {
        // Include client if they have at least one non-cancelled appointment
        const nonCancelledCount = clientData.pendingAppointments + 
                                  clientData.confirmedAppointments + 
                                  clientData.completedAppointments;
        return nonCancelledCount > 0 && clientData.lastAppointmentDate !== null;
      })
      .map((clientData) => {
        // Safety check: ensure lastAppointmentDate is set (should already be set)
        if (clientData.lastAppointmentDate === null) {
          clientData.lastAppointmentDate = new Date();
        }
        return clientData;
      });

    res.json({
      success: true,
      data: {
        clients,
        total: clients.length,
      },
    });
  } catch (error) {
    console.error('Get my clients error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

