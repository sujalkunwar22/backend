const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  register,
  login,
  getMe,
  updateProfile,
  getUserById,
} = require('../controllers/authController');
const { authenticateJWT } = require('../middlewares/auth');

// Validation rules
const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('role').isIn(['CLIENT', 'LAWYER']),
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('acceptedTerms').isBoolean().equals(true).withMessage('You must accept the Terms of Service'),
  body('acceptedPrivacy').isBoolean().equals(true).withMessage('You must accept the Privacy Policy'),
];

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
];

// Routes
router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.get('/me', authenticateJWT, getMe);
router.get('/user/:id', authenticateJWT, getUserById);
router.patch('/profile', authenticateJWT, updateProfile);

module.exports = router;

