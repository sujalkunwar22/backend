const express = require('express');
const router = express.Router();
const {
  submitVerificationRequest,
  getVerificationStatus,
  getVerificationRequests,
  rejectVerificationRequest,
} = require('../controllers/verificationController');
const { authenticateJWT, authorizeRoles } = require('../middlewares/auth');

// Lawyer routes
router.post('/request', authenticateJWT, authorizeRoles('LAWYER'), submitVerificationRequest);
router.get('/request/status', authenticateJWT, authorizeRoles('LAWYER'), getVerificationStatus);

// Admin routes - moved to admin.js for consistency

module.exports = router;

