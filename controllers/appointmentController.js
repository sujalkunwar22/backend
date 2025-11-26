const Appointment = require('../models/Appointment');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const createNotification = require('../utils/createNotification');
const { validationResult } = require('express-validator');

// @route   POST /api/appointments
// @desc    Create a new appointment request
// @access  Private (Client only)
exports.createAppointment = async (req, res) => {
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
        message: 'Only clients can create appointment requests',
      });
    }

    const { lawyerId, proposedDate, proposedTime, reason, notes } = req.body;

    // Verify lawyer exists and is active
    const lawyer = await User.findOne({ _id: lawyerId, role: 'LAWYER', isActive: true });
    if (!lawyer) {
      return res.status(404).json({
        success: false,
        message: 'Lawyer not found or inactive',
      });
    }

    // Create appointment
    const appointment = await Appointment.create({
      client: req.user._id,
      lawyer: lawyerId,
      proposedDate: new Date(proposedDate),
      proposedTime,
      reason,
      notes: notes || '',
      status: 'PENDING',
    });

    // Create or get conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [req.user._id, lawyerId] },
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [req.user._id, lawyerId],
        appointment: appointment._id,
      });
    } else {
      conversation.appointment = appointment._id;
      await conversation.save();
    }

    appointment.conversationId = conversation._id;
    await appointment.save();

    // Populate appointment
    await appointment.populate([
      { path: 'client', select: 'firstName lastName email phone' },
      { path: 'lawyer', select: 'firstName lastName email phone' },
    ]);

    // Create notification for lawyer
    await createNotification(
      lawyerId,
      'APPOINTMENT_REQUEST',
      'New Appointment Request',
      `${req.user.firstName} ${req.user.lastName} requested an appointment`,
      appointment._id,
      'appointment'
    );

    // Emit Socket.IO event (will be handled in server.js)
    req.io.emit(`appointment:${lawyerId}`, {
      type: 'APPOINTMENT_REQUEST',
      appointment: appointment,
    });

    res.status(201).json({
      success: true,
      message: 'Appointment request created successfully',
      data: { appointment },
    });
  } catch (error) {
    console.error('Create appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @route   PATCH /api/appointments/:id/propose
// @desc    Propose a new time for appointment (Lawyer)
// @access  Private (Lawyer only)
exports.proposeTime = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array(),
      });
    }

    if (req.user.role !== 'LAWYER') {
      return res.status(403).json({
        success: false,
        message: 'Only lawyers can propose appointment times',
      });
    }

    const { proposedDate, proposedTime } = req.body;
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found',
      });
    }

    if (appointment.lawyer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only propose times for your own appointments',
      });
    }

    if (appointment.status === 'CONFIRMED' || appointment.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: `Cannot propose time for ${appointment.status.toLowerCase()} appointment`,
      });
    }

    appointment.proposedDate = new Date(proposedDate);
    appointment.proposedTime = proposedTime;
    appointment.status = 'PROPOSED';
    appointment.lawyerConfirmation = false;
    appointment.clientConfirmation = false;

    await appointment.save();
    await appointment.populate([
      { path: 'client', select: 'firstName lastName email phone' },
      { path: 'lawyer', select: 'firstName lastName email phone' },
    ]);

    // Create notification for client
    await createNotification(
      appointment.client._id,
      'APPOINTMENT_PROPOSED',
      'Appointment Time Proposed',
      `${req.user.firstName} ${req.user.lastName} proposed a new time for your appointment: ${proposedDate.toLocaleDateString()} at ${proposedTime}`,
      appointment._id,
      'appointment'
    );

    req.io.emit(`appointment:${appointment.client._id}`, {
      type: 'APPOINTMENT_PROPOSED',
      appointment: appointment,
    });

    res.json({
      success: true,
      message: 'Time proposed successfully',
      data: { appointment },
    });
  } catch (error) {
    console.error('Propose time error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @route   PATCH /api/appointments/:id/confirm
// @desc    Confirm appointment (both parties must confirm)
// @access  Private
exports.confirmAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found',
      });
    }

    // Check if user is part of this appointment
    const isClient = appointment.client.toString() === req.user._id.toString();
    const isLawyer = appointment.lawyer.toString() === req.user._id.toString();

    if (!isClient && !isLawyer) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to confirm this appointment',
      });
    }

    if (appointment.status === 'CANCELLED' || appointment.status === 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: `Cannot confirm ${appointment.status.toLowerCase()} appointment`,
      });
    }

    // Set confirmation based on role
    if (isClient) {
      appointment.clientConfirmation = true;
    } else if (isLawyer) {
      appointment.lawyerConfirmation = true;
    }

    // If both parties confirmed, update status
    if (appointment.clientConfirmation && appointment.lawyerConfirmation) {
      appointment.status = 'CONFIRMED';
      appointment.confirmedDate = appointment.proposedDate;
      appointment.confirmedTime = appointment.proposedTime;
    }

    await appointment.save();
    await appointment.populate([
      { path: 'client', select: 'firstName lastName email phone' },
      { path: 'lawyer', select: 'firstName lastName email phone' },
    ]);

    // Notify the other party
    const otherPartyId = isClient ? appointment.lawyer._id : appointment.client._id;
    const notificationType = appointment.status === 'CONFIRMED'
      ? 'APPOINTMENT_CONFIRMED'
      : 'APPOINTMENT_REQUEST';

    await createNotification(
      otherPartyId,
      notificationType,
      appointment.status === 'CONFIRMED' ? 'Appointment Confirmed' : 'Appointment Confirmation Update',
      appointment.status === 'CONFIRMED'
        ? `Your appointment with ${isClient ? appointment.lawyer.firstName : appointment.client.firstName} is confirmed`
        : `${req.user.firstName} ${req.user.lastName} confirmed the appointment`,
      appointment._id,
      'appointment'
    );

    req.io.emit(`appointment:${otherPartyId}`, {
      type: appointment.status === 'CONFIRMED' ? 'APPOINTMENT_CONFIRMED' : 'APPOINTMENT_UPDATE',
      appointment: appointment,
    });

    res.json({
      success: true,
      message: appointment.status === 'CONFIRMED'
        ? 'Appointment confirmed by both parties'
        : 'Your confirmation has been recorded',
      data: { appointment },
    });
  } catch (error) {
    console.error('Confirm appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @route   GET /api/appointments/mine
// @desc    Get user's appointments
// @access  Private
exports.getMyAppointments = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const query = {};

    if (req.user.role === 'CLIENT') {
      query.client = req.user._id;
    } else if (req.user.role === 'LAWYER') {
      query.lawyer = req.user._id;
    } else {
      // Admin can see all
      // For now, return empty or handle admin differently
    }

    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const appointments = await Appointment.find(query)
      .populate('client', 'firstName lastName email phone')
      .populate('lawyer', 'firstName lastName email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Appointment.countDocuments(query);

    res.json({
      success: true,
      data: {
        appointments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @route   PATCH /api/appointments/:id/accept
// @desc    Accept appointment (Lawyer only)
// @access  Private (Lawyer only)
exports.acceptAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found',
      });
    }

    if (req.user.role !== 'LAWYER') {
      return res.status(403).json({
        success: false,
        message: 'Only lawyers can accept appointments',
      });
    }

    if (appointment.lawyer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only accept your own appointments',
      });
    }

    if (appointment.status === 'CONFIRMED' || appointment.status === 'CANCELLED' || appointment.status === 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: `Cannot accept ${appointment.status.toLowerCase()} appointment`,
      });
    }

    // Accept the appointment - set lawyer confirmation and status to CONFIRMED
    appointment.lawyerConfirmation = true;
    appointment.status = 'CONFIRMED';
    appointment.confirmedDate = appointment.proposedDate;
    appointment.confirmedTime = appointment.proposedTime;

    await appointment.save();
    await appointment.populate([
      { path: 'client', select: 'firstName lastName email phone' },
      { path: 'lawyer', select: 'firstName lastName email phone' },
    ]);

    // Notify client
    await createNotification(
      appointment.client._id,
      'APPOINTMENT_CONFIRMED',
      'Appointment Accepted',
      `${req.user.firstName} ${req.user.lastName} accepted your appointment request`,
      appointment._id,
      'appointment'
    );

    req.io.emit(`appointment:${appointment.client._id}`, {
      type: 'APPOINTMENT_CONFIRMED',
      appointment: appointment,
    });

    res.json({
      success: true,
      message: 'Appointment accepted successfully',
      data: { appointment },
    });
  } catch (error) {
    console.error('Accept appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @route   PATCH /api/appointments/:id/reject
// @desc    Reject appointment (Lawyer only)
// @access  Private (Lawyer only)
exports.rejectAppointment = async (req, res) => {
  try {
    const { rejectionReason } = req.body;
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found',
      });
    }

    if (req.user.role !== 'LAWYER') {
      return res.status(403).json({
        success: false,
        message: 'Only lawyers can reject appointments',
      });
    }

    if (appointment.lawyer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only reject your own appointments',
      });
    }

    if (appointment.status === 'CANCELLED' || appointment.status === 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: `Cannot reject ${appointment.status.toLowerCase()} appointment`,
      });
    }

    // Reject the appointment
    appointment.status = 'CANCELLED';
    await appointment.save();
    await appointment.populate([
      { path: 'client', select: 'firstName lastName email phone' },
      { path: 'lawyer', select: 'firstName lastName email phone' },
    ]);

    // Notify client
    await createNotification(
      appointment.client._id,
      'APPOINTMENT_CANCELLED',
      'Appointment Rejected',
      `${req.user.firstName} ${req.user.lastName} rejected your appointment request${rejectionReason ? ': ' + rejectionReason : ''}`,
      appointment._id,
      'appointment'
    );

    req.io.emit(`appointment:${appointment.client._id}`, {
      type: 'APPOINTMENT_REJECTED',
      appointment: appointment,
    });

    res.json({
      success: true,
      message: 'Appointment rejected successfully',
      data: { appointment },
    });
  } catch (error) {
    console.error('Reject appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @route   PATCH /api/appointments/:id/complete
// @desc    Complete consultation (Lawyer only)
// @access  Private (Lawyer only)
exports.completeAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found',
      });
    }

    if (req.user.role !== 'LAWYER') {
      return res.status(403).json({
        success: false,
        message: 'Only lawyers can complete consultations',
      });
    }

    if (appointment.lawyer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only complete your own consultations',
      });
    }

    if (appointment.status !== 'CONFIRMED') {
      return res.status(400).json({
        success: false,
        message: 'Only confirmed appointments can be completed',
      });
    }

    // Complete the appointment
    appointment.status = 'COMPLETED';
    await appointment.save();
    await appointment.populate([
      { path: 'client', select: 'firstName lastName email phone profilePicture' },
      { path: 'lawyer', select: 'firstName lastName email phone profilePicture' },
    ]);

    // Notify client
    await createNotification(
      appointment.client._id,
      'APPOINTMENT_COMPLETED',
      'Consultation Completed',
      `${req.user.firstName} ${req.user.lastName} marked your consultation as completed`,
      appointment._id,
      'appointment'
    );

    req.io.emit(`appointment:${appointment.client._id}`, {
      type: 'APPOINTMENT_COMPLETED',
      appointment: appointment,
    });

    res.json({
      success: true,
      message: 'Consultation completed successfully',
      data: { appointment },
    });
  } catch (error) {
    console.error('Complete appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @route   GET /api/appointments/history
// @desc    Get consultation history (completed and cancelled consultations)
// @access  Private
exports.getConsultationHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Include both COMPLETED and CANCELLED appointments in history
    let query = { status: { $in: ['COMPLETED', 'CANCELLED'] } };

    // Filter by role
    if (req.user.role === 'LAWYER') {
      query.lawyer = req.user._id;
    } else if (req.user.role === 'CLIENT') {
      query.client = req.user._id;
    }

    const appointments = await Appointment.find(query)
      .populate('client', 'firstName lastName email phone profilePicture')
      .populate('lawyer', 'firstName lastName email phone profilePicture')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Appointment.countDocuments(query);

    res.json({
      success: true,
      data: {
        appointments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Get consultation history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @route   GET /api/appointments/:id
// @desc    Get single appointment
// @access  Private
exports.getAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('client', 'firstName lastName email phone profilePicture')
      .populate('lawyer', 'firstName lastName email phone profilePicture');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found',
      });
    }

    // Check authorization
    const isClient = appointment.client._id.toString() === req.user._id.toString();
    const isLawyer = appointment.lawyer._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'ADMIN';

    if (!isClient && !isLawyer && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    res.json({
      success: true,
      data: { appointment },
    });
  } catch (error) {
    console.error('Get appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

