const express = require('express');
const router = express.Router();
const {
  getLawyers,
  getLawyerById,
  updateProfile,
  getMyClients,
} = require('../controllers/lawyerController');
const { authenticateJWT, authorizeRoles } = require('../middlewares/auth');

router.get('/', getLawyers);
router.get('/my-clients', authenticateJWT, authorizeRoles('LAWYER'), getMyClients);
router.get('/:id', getLawyerById);
router.patch('/profile', authenticateJWT, authorizeRoles('LAWYER'), updateProfile);

module.exports = router;

