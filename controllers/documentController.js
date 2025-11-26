const Document = require('../models/Document');
const createNotification = require('../utils/createNotification');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Calculate file hash
function calculateFileHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(fileBuffer).digest('hex');
}

// Check for duplicate file
function findDuplicateFile(filePath) {
  try {
    const fileHash = calculateFileHash(filePath);
    
    // Check if file with same hash exists
    const Document = require('../models/Document');
    // We'll check in the database for existing files with same hash
    // For now, check if file with same size and name pattern exists
    return fileHash;
  } catch (error) {
    console.error('Error calculating file hash:', error);
    return null;
  }
}

// @route   POST /api/documents/upload
// @desc    Upload a document
// @access  Private
exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    const { appointmentId, description, category } = req.body;

    // Check for duplicate file by hash and size
    const fileHash = calculateFileHash(req.file.path);
    
    // Find existing documents with same size (quick check first)
    const candidates = await Document.find({
      owner: req.user._id,
      fileSize: req.file.size,
    });
    
    // Check if any candidate has the same hash
    let existingDoc = null;
    for (const doc of candidates) {
      if (fs.existsSync(doc.filePath)) {
        try {
          const docHash = calculateFileHash(doc.filePath);
          if (docHash === fileHash) {
            existingDoc = doc;
            break;
          }
        } catch (error) {
          // Skip if file doesn't exist or can't be read
          continue;
        }
      }
    }

    let finalFilePath = req.file.path;
    let finalFileName = req.file.filename;

    // If duplicate found and file exists, reuse it
    if (existingDoc && fs.existsSync(existingDoc.filePath)) {
      // Delete the newly uploaded duplicate file
      try {
        fs.unlinkSync(req.file.path);
      } catch (error) {
        console.error('Error deleting duplicate file:', error);
      }
      
      // Use existing file
      finalFilePath = existingDoc.filePath;
      finalFileName = existingDoc.fileName;
      
      // Create new document record pointing to existing file
      const document = await Document.create({
        owner: req.user._id,
        appointment: appointmentId || null,
        fileName: finalFileName,
        originalName: req.file.originalname, // Keep original name
        filePath: finalFilePath,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        description: description || '',
        category: category || 'other',
      });

      // If document is related to appointment, notify the other party
      if (appointmentId) {
        const Appointment = require('../models/Appointment');
        const appointment = await Appointment.findById(appointmentId);
        if (appointment) {
          const otherPartyId =
            appointment.client.toString() === req.user._id.toString()
              ? appointment.lawyer
              : appointment.client;

          await createNotification(
            otherPartyId,
            'DOCUMENT_UPLOADED',
            'New Document Uploaded',
            `${req.user.firstName} ${req.user.lastName} uploaded a document`,
            document._id,
            'document'
          );

          req.io.emit(`document:${otherPartyId}`, {
            type: 'DOCUMENT_UPLOADED',
            document: document,
          });
        }
      }

      return res.status(201).json({
        success: true,
        message: 'Document uploaded successfully (reused existing file)',
        data: { document },
      });
    }

    // No duplicate found, create new document
    const document = await Document.create({
      owner: req.user._id,
      appointment: appointmentId || null,
      fileName: finalFileName,
      originalName: req.file.originalname,
      filePath: finalFilePath,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      description: description || '',
      category: category || 'other',
    });

    // If document is related to appointment, notify the other party
    if (appointmentId) {
      const Appointment = require('../models/Appointment');
      const appointment = await Appointment.findById(appointmentId);
      if (appointment) {
        const otherPartyId =
          appointment.client.toString() === req.user._id.toString()
            ? appointment.lawyer
            : appointment.client;

        await createNotification(
          otherPartyId,
          'DOCUMENT_UPLOADED',
          'New Document Uploaded',
          `${req.user.firstName} ${req.user.lastName} uploaded a document`,
          document._id,
          'document'
        );

        req.io.emit(`document:${otherPartyId}`, {
          type: 'DOCUMENT_UPLOADED',
          document: document,
        });
      }
    }

    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      data: { document },
    });
  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @route   GET /api/documents/mine
// @desc    Get user's documents
// @access  Private
exports.getMyDocuments = async (req, res) => {
  try {
    const { appointmentId, category, page = 1, limit = 20 } = req.query;
    const query = { owner: req.user._id };

    if (appointmentId) {
      query.appointment = appointmentId;
    }

    if (category) {
      query.category = category;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const documents = await Document.find(query)
      .populate('appointment')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Document.countDocuments(query);

    res.json({
      success: true,
      data: {
        documents,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @route   GET /api/documents/:id
// @desc    Get single document
// @access  Private
exports.getDocument = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id).populate('appointment');

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found',
      });
    }

    // Check authorization
    const isOwner = document.owner.toString() === req.user._id.toString();
    const isShared = document.isShared && document.sharedWith.includes(req.user._id);
    const isAdmin = req.user.role === 'ADMIN';

    if (!isOwner && !isShared && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    res.json({
      success: true,
      data: { document },
    });
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @route   GET /api/documents/:id/download
// @desc    Download document file
// @access  Private
exports.downloadDocument = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found',
      });
    }

    // Check authorization
    const isOwner = document.owner.toString() === req.user._id.toString();
    const isShared = document.isShared && document.sharedWith.includes(req.user._id);
    const isAdmin = req.user.role === 'ADMIN';

    if (!isOwner && !isShared && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Check if file exists
    if (!fs.existsSync(document.filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found on server',
      });
    }

    res.download(document.filePath, document.originalName);
  } catch (error) {
    console.error('Download document error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @route   DELETE /api/documents/:id
// @desc    Delete document
// @access  Private
exports.deleteDocument = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found',
      });
    }

    // Check authorization
    const isOwner = document.owner.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Delete file from filesystem
    if (fs.existsSync(document.filePath)) {
      fs.unlinkSync(document.filePath);
    }

    await Document.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @route   GET /api/documents/shared/:userId
// @desc    Get shared documents and files between current user and another user
// @access  Private
exports.getSharedDocuments = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const Message = require('../models/Message');
    const Conversation = require('../models/Conversation');
    const fs = require('fs');
    const path = require('path');

    // Find documents where:
    // 1. Current user is owner and document is shared with userId
    // 2. userId is owner and document is shared with current user
    const documentQuery = {
      $or: [
        {
          owner: req.user._id,
          isShared: true,
          sharedWith: userId,
        },
        {
          owner: userId,
          isShared: true,
          sharedWith: req.user._id,
        },
      ],
    };

    // Find conversation between the two users
    const conversation = await Conversation.findOne({
      participants: { $all: [req.user._id, userId] },
    });

    const allFiles = [];

    // Get shared documents
    const documents = await Document.find(documentQuery)
      .populate('owner', 'firstName lastName email profilePicture')
      .populate('appointment')
      .sort({ createdAt: -1 });

    // Convert documents to file format
    documents.forEach((doc) => {
      allFiles.push({
        id: doc._id.toString(),
        type: 'document',
        fileName: doc.fileName,
        originalName: doc.originalName,
        filePath: doc.filePath,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        description: doc.description,
        category: doc.category,
        owner: doc.owner,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      });
    });

    // Get files shared via chat messages
    if (conversation) {
      const fileMessages = await Message.find({
        conversation: conversation._id,
        messageType: 'file',
        $or: [
          { fileUrl: { $ne: null, $ne: '' } },
          { fileUrl: { $exists: true } },
        ],
      })
        .populate('sender', 'firstName lastName email profilePicture')
        .sort({ createdAt: -1 });

      // Process chat file messages
      for (const message of fileMessages) {
        const filePath = message.fileUrl;
        if (filePath) {
          // Check if file exists
          const fullPath = path.isAbsolute(filePath)
            ? filePath
            : path.join(__dirname, '..', filePath);
          
          let fileSize = 0;
          let mimeType = 'application/octet-stream';
          
          try {
            if (fs.existsSync(fullPath)) {
              const stats = fs.statSync(fullPath);
              fileSize = stats.size;
              
              // Determine mime type from extension
              const ext = path.extname(filePath).toLowerCase();
              const mimeTypes = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.pdf': 'application/pdf',
                '.doc': 'application/msword',
                '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                '.txt': 'text/plain',
                '.mp4': 'video/mp4',
                '.mp3': 'audio/mpeg',
              };
              mimeType = mimeTypes[ext] || 'application/octet-stream';
            }
          } catch (err) {
            console.error('Error reading file:', err);
          }

          // Extract original filename from message content or file path
          let originalName = message.content || path.basename(filePath);
          // If content is just a filename, use it; otherwise extract from path
          if (!originalName || originalName === path.basename(filePath)) {
            originalName = path.basename(filePath);
          }
          
          const fileName = path.basename(filePath);

          allFiles.push({
            id: message._id.toString(),
            type: 'chat',
            fileName: fileName,
            originalName: originalName,
            filePath: filePath,
            fileSize: fileSize,
            mimeType: mimeType,
            description: null,
            category: 'other',
            owner: message.sender,
            createdAt: message.createdAt,
            updatedAt: message.createdAt,
          });
        }
      }
    }

    // Sort all files by creation date (newest first)
    allFiles.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Apply pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedFiles = allFiles.slice(skip, skip + parseInt(limit));
    const total = allFiles.length;

    res.json({
      success: true,
      data: {
        files: paginatedFiles,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Get shared documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

