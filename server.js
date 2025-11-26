require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const connectDB = require('./config/database');
const { authenticateJWT } = require('./middlewares/auth');
const { handleSocketMessage } = require('./controllers/chatController');

// Import routes
const authRoutes = require('./routes/auth');
const appointmentRoutes = require('./routes/appointments');
const chatRoutes = require('./routes/chat');
const documentRoutes = require('./routes/documents');
const lawyerRoutes = require('./routes/lawyers');
const templateRoutes = require('./routes/templates');
const notificationRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');
const verificationRoutes = require('./routes/verification');
const profileRoutes = require('./routes/profile');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Trust proxy - Required for Render and other reverse proxies
app.set('trust proxy', 1);

// Connect to database (must be before importing routes that use models)
connectDB();

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
  },
});

// Make io available to routes via req.io
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Middlewares
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Serve admin panel static files
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin')));
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// Serve uploaded files (with authentication)
app.get('/uploads/*', authenticateJWT, (req, res) => {
  const filePath = path.join(__dirname, req.path);
  const fs = require('fs');
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({
      success: false,
      message: 'File not found',
    });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/lawyers', lawyerRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/reviews', require('./routes/reviews'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'NepalAdvocate API is running' });
});

// Socket.IO authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.substring(7);

    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    const { verifyToken } = require('./config/jwt');
    const User = require('./models/User');

    const decoded = verifyToken(token);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user || !user.isActive) {
      return next(new Error('Authentication error: Invalid user'));
    }

    socket.userId = user._id.toString();
    socket.userRole = user.role;
    next();
  } catch (error) {
    next(new Error('Authentication error: Invalid token'));
  }
});

// Store active calls for routing (shared across all connections)
const activeCalls = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.userId}`);

  // Join user-specific room
  socket.join(`user:${socket.userId}`);

  // Handle joining conversation rooms
  socket.on('joinConversation', async (conversationId) => {
    try {
      const Conversation = require('./models/Conversation');
      const conversation = await Conversation.findById(conversationId);

      if (!conversation) {
        socket.emit('error', { message: 'Conversation not found' });
        return;
      }

      // Check if user is a participant (handle both ObjectId and string comparison)
      const isParticipant = conversation.participants.some(
        (p) => p.toString() === socket.userId.toString()
      );

      if (isParticipant) {
        socket.join(`conversation:${conversationId}`);
        socket.emit('joinedConversation', { conversationId });
        console.log(`User ${socket.userId} joined conversation ${conversationId}`);
      } else {
        socket.emit('error', { message: 'Access denied: You are not a participant' });
      }
    } catch (error) {
      console.error('Error joining conversation:', error);
      socket.emit('error', { message: 'Error joining conversation' });
    }
  });

  // Handle leaving conversation rooms
  socket.on('leaveConversation', (conversationId) => {
    socket.leave(`conversation:${conversationId}`);
  });

  // Handle sending messages
  socket.on('sendMessage', async (data) => {
    await handleSocketMessage(io, socket, data);
  });

  // Handle typing indicator
  socket.on('typing', (data) => {
    socket.to(`conversation:${data.conversationId}`).emit('userTyping', {
      userId: socket.userId,
      isTyping: data.isTyping,
    });
  });

  // Handle call signaling
  socket.on('startCall', async (data) => {
    try {
      const { callId, conversationId, otherUserId, callType, offer } = data;
      const Conversation = require('./models/Conversation');
      
      console.log(`Starting call - callId: ${callId}, caller: ${socket.userId}, callee: ${otherUserId}`);
      
      // Check if there's already an active call for this conversation
      for (const [existingCallId, existingCall] of activeCalls.entries()) {
        if (existingCall.conversationId === conversationId && 
            (existingCall.callerId === socket.userId || existingCall.calleeId === socket.userId)) {
          console.log(`Active call ${existingCallId} already exists for this conversation, cleaning it up`);
          activeCalls.delete(existingCallId);
        }
      }
      
      // Verify conversation exists and user is participant
      const conversation = await Conversation.findById(conversationId);
      if (!conversation || !conversation.participants.some(p => p.toString() === socket.userId.toString())) {
        socket.emit('error', { message: 'Invalid conversation or access denied' });
        return;
      }

      // Store call info for routing
      activeCalls.set(callId, {
        callerId: socket.userId,
        calleeId: otherUserId,
        conversationId,
      });
      console.log(`Call ${callId} stored in active calls`);

      // Send call to other user
      console.log(`Sending incoming call to user:${otherUserId} from caller:${socket.userId}`);
      io.to(`user:${otherUserId}`).emit('incomingCall', {
        callId,
        conversationId,
        callerId: socket.userId,
        callType,
        offer,
      });
      console.log(`Incoming call event emitted to user:${otherUserId}`);
    } catch (error) {
      console.error('Error starting call:', error);
      socket.emit('error', { message: 'Error starting call' });
    }
  });

  socket.on('acceptCall', (data) => {
    const { callId, answer } = data;
    const callInfo = activeCalls.get(callId);
    if (callInfo) {
      // Forward answer to caller
      io.to(`user:${callInfo.callerId}`).emit('callAccepted', {
        callId,
        answer,
      });
    } else {
      // Fallback to broadcast if call info not found
      socket.broadcast.emit('callAccepted', {
        callId,
        answer,
      });
    }
  });

  socket.on('rejectCall', (data) => {
    const { callId } = data;
    console.log(`Call rejected - callId: ${callId}, userId: ${socket.userId}`);
    const callInfo = activeCalls.get(callId);
    if (callInfo) {
      // Notify caller that call was rejected
      console.log(`Notifying caller ${callInfo.callerId} that call was rejected`);
      io.to(`user:${callInfo.callerId}`).emit('callRejected', {
        callId,
      });
      // Clean up the call from active calls
      activeCalls.delete(callId);
      console.log(`Call ${callId} removed from active calls`);
    } else {
      console.log(`Call ${callId} not found in active calls, broadcasting rejection`);
      // Fallback to broadcast to all sockets
      socket.broadcast.emit('callRejected', {
        callId,
      });
    }
  });

  socket.on('endCall', (data) => {
    const { callId } = data;
    console.log(`Call ended - callId: ${callId}, userId: ${socket.userId}`);
    const callInfo = activeCalls.get(callId);
    if (callInfo) {
      // Notify other participant that call ended
      const otherUserId = callInfo.callerId === socket.userId ? callInfo.calleeId : callInfo.callerId;
      console.log(`Notifying other user ${otherUserId} that call ended`);
      io.to(`user:${otherUserId}`).emit('callEnded', {
        callId,
      });
      // Clean up the call from active calls
      activeCalls.delete(callId);
      console.log(`Call ${callId} removed from active calls`);
    } else {
      console.log(`Call ${callId} not found in active calls, broadcasting end`);
      // Fallback to broadcast to all sockets
      socket.broadcast.emit('callEnded', {
        callId,
      });
    }
  });

  socket.on('iceCandidate', (data) => {
    const { callId, candidate } = data;
    const callInfo = activeCalls.get(callId);
    if (callInfo) {
      // Forward ICE candidate to other participant
      const otherUserId = callInfo.callerId === socket.userId ? callInfo.calleeId : callInfo.callerId;
      io.to(`user:${otherUserId}`).emit('iceCandidate', {
        callId,
        candidate,
      });
    } else {
      // Fallback to broadcast
      socket.broadcast.emit('iceCandidate', {
        callId,
        candidate,
      });
    }
  });

  socket.on('offer', (data) => {
    const { callId, offer } = data;
    const callInfo = activeCalls.get(callId);
    if (callInfo) {
      // Forward offer to other participant
      const otherUserId = callInfo.callerId === socket.userId ? callInfo.calleeId : callInfo.callerId;
      io.to(`user:${otherUserId}`).emit('offer', {
        callId,
        offer,
      });
    } else {
      // Fallback to broadcast
      socket.broadcast.emit('offer', {
        callId,
        offer,
      });
    }
  });

  socket.on('answer', (data) => {
    const { callId, answer } = data;
    const callInfo = activeCalls.get(callId);
    if (callInfo) {
      // Forward answer to caller
      io.to(`user:${callInfo.callerId}`).emit('answer', {
        callId,
        answer,
      });
    } else {
      // Fallback to broadcast
      socket.broadcast.emit('answer', {
        callId,
        answer,
      });
    }
  });

  // Handle upgrade to video call
  socket.on('upgradeToVideo', (data) => {
    const { callId, offer } = data;
    const callInfo = activeCalls.get(callId);
    if (callInfo) {
      // Forward upgrade offer to other participant
      const otherUserId = callInfo.callerId === socket.userId ? callInfo.calleeId : callInfo.callerId;
      io.to(`user:${otherUserId}`).emit('upgradeToVideo', {
        callId,
        offer,
      });
    } else {
      // Fallback to broadcast
      socket.broadcast.emit('upgradeToVideo', {
        callId,
        offer,
      });
    }
    // Forward video upgrade offer to other participant
    socket.broadcast.emit('upgradeToVideo', {
      callId,
      offer,
    });
  });

  // Handle call recording
  socket.on('startRecording', (data) => {
    const { callId, conversationId } = data;
    // Notify other participant that recording started
    socket.broadcast.emit('recordingStarted', {
      callId,
      conversationId,
    });
  });

  socket.on('stopRecording', (data) => {
    const { callId, conversationId } = data;
    // Notify other participant that recording stopped
    socket.broadcast.emit('recordingStopped', {
      callId,
      conversationId,
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.userId}`);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// 404 handler (only for API routes, not admin panel)
app.use((req, res) => {
  // If it's an admin panel route, serve index.html for SPA routing
  if (req.path.startsWith('/admin')) {
    return res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
  }
  
  // Otherwise return JSON error for API routes
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

