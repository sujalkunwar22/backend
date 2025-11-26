const express = require('express');
const router = express.Router();
const {
  uploadDocument,
  getMyDocuments,
  getDocument,
  downloadDocument,
  deleteDocument,
  getSharedDocuments,
} = require('../controllers/documentController');
const { authenticateJWT } = require('../middlewares/auth');
const { anyFileUpload } = require('../middlewares/upload');

// Use anyFileUpload to accept all file types
router.post('/upload', authenticateJWT, anyFileUpload.single('file'), uploadDocument);
router.get('/mine', authenticateJWT, getMyDocuments);
router.get('/shared/:userId', authenticateJWT, getSharedDocuments);
router.get('/:id', authenticateJWT, getDocument);
router.get('/:id/download', authenticateJWT, downloadDocument);
router.delete('/:id', authenticateJWT, deleteDocument);

module.exports = router;

