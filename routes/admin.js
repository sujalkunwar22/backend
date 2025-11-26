const express = require('express');
const router = express.Router();
const {
  getStats,
  getUsers,
  getUserById,
  updateUser,
  changeUserPassword,
  updateUserStatus,
  verifyLawyer,
} = require('../controllers/adminController');
const {
  getVerificationRequests,
  rejectVerificationRequest,
} = require('../controllers/verificationController');
const { authenticateJWT, authorizeRoles } = require('../middlewares/auth');

// All admin routes require authentication and ADMIN role
router.use(authenticateJWT);
router.use(authorizeRoles('ADMIN'));

router.get('/stats', getStats);
router.get('/users', getUsers);
router.get('/users/:id', getUserById);
router.patch('/users/:id', updateUser);
router.patch('/users/:id/password', changeUserPassword);
router.patch('/users/:id/status', updateUserStatus);
router.patch('/lawyers/:id/verify', verifyLawyer);
router.get('/verification/requests', getVerificationRequests);
router.patch('/verification/requests/:id/reject', rejectVerificationRequest);

module.exports = router;

