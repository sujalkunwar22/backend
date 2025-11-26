const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Ensure upload directory exists
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Store file hashes to detect duplicates
const fileHashMap = new Map(); // In-memory cache: hash -> filename
const fileHashFile = path.join(uploadDir, '.file-hashes.json');

// Load existing file hashes on startup
function loadFileHashes() {
  try {
    if (fs.existsSync(fileHashFile)) {
      const data = fs.readFileSync(fileHashFile, 'utf8');
      const hashes = JSON.parse(data);
      Object.entries(hashes).forEach(([hash, filename]) => {
        fileHashMap.set(hash, filename);
      });
    }
  } catch (error) {
    console.error('Error loading file hashes:', error);
  }
}

// Save file hashes to disk
function saveFileHashes() {
  try {
    const hashes = Object.fromEntries(fileHashMap);
    fs.writeFileSync(fileHashFile, JSON.stringify(hashes, null, 2));
  } catch (error) {
    console.error('Error saving file hashes:', error);
  }
}

// Calculate file hash
function calculateFileHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(fileBuffer).digest('hex');
}

// Load hashes on startup
loadFileHashes();

// Configure storage with duplicate detection
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: async (req, file, cb) => {
    try {
      // Create temporary file path
      const tempSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      const tempFileName = `${file.fieldname}-${tempSuffix}${ext}`;
      const tempFilePath = path.join(uploadDir, tempFileName);
      
      // Wait for file to be written (multer handles this)
      // We'll check for duplicates in the document controller after upload
      cb(null, tempFileName);
    } catch (error) {
      cb(error);
    }
  },
});

// File filter for documents
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images, PDFs, and documents are allowed.'));
  }
};

// File filter for images only (profile pictures)
const imageFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images (JPEG, PNG, GIF, WEBP) are allowed.'));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: fileFilter,
});

// Image upload middleware (for profile pictures)
const imageUpload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for images
  },
  fileFilter: imageFilter,
});

// Upload middleware that accepts all file types (for chat files)
const anyFileUpload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for any files
  },
  // No fileFilter - accepts all file types
});

module.exports = upload;
module.exports.imageUpload = imageUpload;
module.exports.anyFileUpload = anyFileUpload;

