const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const Appointment = require('../models/Appointment');
const createNotification = require('../utils/createNotification');

// @route   GET /api/chat/conversations
// @desc    Get user's conversations
// @access  Private
exports.getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id,
    })
      .populate('participants', 'firstName lastName email profilePicture')
      .populate('appointment')
      .populate('lastMessage')
      .sort({ lastMessageAt: -1 });

    res.json({
      success: true,
      data: { conversations },
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @route   GET /api/chat/conversations/:conversationId/messages
// @desc    Get messages for a conversation
// @access  Private
exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // Verify user is part of conversation
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
      });
    }

    if (!conversation.participants.includes(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Check if appointment is confirmed or completed (if conversation has an appointment)
    // Allow viewing messages for CONFIRMED and COMPLETED appointments
    if (conversation.appointment) {
      const appointment = await Appointment.findById(conversation.appointment);
      if (appointment && appointment.status !== 'CONFIRMED' && appointment.status !== 'COMPLETED') {
        return res.status(403).json({
          success: false,
          message: 'Chat is only available after the appointment is confirmed by the lawyer',
          appointmentStatus: appointment.status,
          error: 'APPOINTMENT_NOT_CONFIRMED',
        });
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const messages = await Message.find({ conversation: conversationId })
      .populate('sender', 'firstName lastName profilePicture')
      .select('_id conversation sender content messageType fileUrl isRead readAt createdAt updatedAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Message.countDocuments({ conversation: conversationId });

    res.json({
      success: true,
      data: {
        messages: messages.reverse(), // Reverse to show oldest first
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// Socket.IO message handler (called from server.js)
exports.handleSocketMessage = async (io, socket, data) => {
  try {
    const { conversationId, content, messageType = 'text', fileUrl = null } = data;
    const userId = socket.userId;

    // Verify conversation exists and user is participant
    const conversation = await Conversation.findById(conversationId);
    if (!conversation || !conversation.participants.includes(userId)) {
      socket.emit('error', { message: 'Invalid conversation or access denied' });
      return;
    }

    // Check if appointment is confirmed (if conversation has an appointment)
    if (conversation.appointment) {
      const Appointment = require('../models/Appointment');
      const appointment = await Appointment.findById(conversation.appointment);
      if (appointment && appointment.status !== 'CONFIRMED') {
        socket.emit('error', { 
          message: 'Chat is only available after the appointment is confirmed by the lawyer' 
        });
        return;
      }
    }

    // Create message
    const message = await Message.create({
      conversation: conversationId,
      sender: userId,
      content,
      messageType,
      fileUrl: fileUrl || null,
    });
    
    // Debug logging
    if (messageType === 'file') {
      console.log('File message created:', {
        messageId: message._id,
        fileUrl: message.fileUrl,
        content: message.content,
        messageType: message.messageType,
      });
    }

    // Update conversation last message
    conversation.lastMessage = message._id;
    conversation.lastMessageAt = new Date();
    await conversation.save();

    // Populate message
    await message.populate('sender', 'firstName lastName profilePicture');

    // Get other participant
    const otherParticipant = conversation.participants.find(
      (p) => p.toString() !== userId.toString()
    )?.toString();

    // Broadcast to conversation room with properly formatted message
    const messageData = {
      message: {
        _id: message._id,
        id: message._id.toString(),
        conversation: message.conversation.toString(),
        conversationId: message.conversation.toString(),
        sender: {
          _id: message.sender._id,
          id: message.sender._id.toString(),
          firstName: message.sender.firstName,
          lastName: message.sender.lastName,
          profilePicture: message.sender.profilePicture,
        },
        senderId: message.sender._id.toString(),
        content: message.content,
        messageType: message.messageType,
        fileUrl: message.fileUrl || null,
        isRead: message.isRead,
        readAt: message.readAt,
        createdAt: message.createdAt,
      },
    };
    
    // Debug logging for file messages
    if (messageType === 'file') {
      console.log('Broadcasting file message:', {
        conversationId,
        fileUrl: messageData.message.fileUrl,
        messageType: messageData.message.messageType,
      });
    }
    
    io.to(`conversation:${conversationId}`).emit('newMessage', messageData);

    // Create notification for other participant
    await createNotification(
      otherParticipant,
      'MESSAGE',
      'New Message',
      `You have a new message from ${message.sender.firstName}`,
      conversationId,
      'message'
    );

    // Emit notification event
    io.to(`user:${otherParticipant}`).emit('notification', {
      type: 'MESSAGE',
      message: `New message from ${message.sender.firstName}`,
    });
  } catch (error) {
    console.error('Socket message error:', error);
    socket.emit('error', { message: 'Failed to send message' });
  }
};

// @route   GET /api/chat/conversation/find/:userId
// @desc    Get or create conversation between current user and another user
// @access  Private
exports.getOrCreateConversation = async (req, res) => {
  try {
    const { userId } = req.params;

    if (req.user._id.toString() === userId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot create conversation with yourself',
      });
    }

    // Find existing conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [req.user._id, userId] },
    })
      .populate('participants', 'firstName lastName email profilePicture')
      .populate('appointment')
      .populate('lastMessage');

    // If no conversation exists, create one
    if (!conversation) {
      conversation = await Conversation.create({
        participants: [req.user._id, userId],
      });
      await conversation.populate('participants', 'firstName lastName email profilePicture');
    }

    res.json({
      success: true,
      data: { conversation },
    });
  } catch (error) {
    console.error('Get or create conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

