const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  createReview,
  getLawyerReviews,
  getMyReviews,
} = require('../controllers/reviewController');
const { authenticateJWT } = require('../middlewares/auth');

// Validation rules
const createReviewValidation = [
  body('lawyerId').isMongoId().withMessage('Valid lawyer ID is required'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().isLength({ max: 1000 }).withMessage('Comment must be less than 1000 characters'),
  body('appointmentId').optional().isMongoId().withMessage('Valid appointment ID is required'),
];

// Routes
router.post('/', authenticateJWT, createReviewValidation, createReview);
router.get('/lawyer/:lawyerId', getLawyerReviews);
router.get('/mine', authenticateJWT, getMyReviews);

module.exports = router;

