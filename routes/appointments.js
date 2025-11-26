const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  createAppointment,
  proposeTime,
  confirmAppointment,
  acceptAppointment,
  rejectAppointment,
  cancelAppointment,
  completeAppointment,
  getMyAppointments,
  getAppointment,
  getConsultationHistory,
} = require('../controllers/appointmentController');
const { authenticateJWT } = require('../middlewares/auth');

// Validation rules
const createAppointmentValidation = [
  body('lawyerId').isMongoId(),
  body('proposedDate').isISO8601(),
  body('proposedTime').notEmpty(),
  body('reason').trim().isLength({ min: 10 }),
];

const proposeTimeValidation = [
  body('proposedDate').isISO8601(),
  body('proposedTime').notEmpty(),
];

// Routes
router.post('/', authenticateJWT, createAppointmentValidation, createAppointment);
router.patch('/:id/propose', authenticateJWT, proposeTimeValidation, proposeTime);
router.patch('/:id/accept', authenticateJWT, acceptAppointment);
router.patch('/:id/reject', authenticateJWT, rejectAppointment);
router.patch('/:id/cancel', authenticateJWT, cancelAppointment);
router.patch('/:id/confirm', authenticateJWT, confirmAppointment);
router.patch('/:id/complete', authenticateJWT, completeAppointment);
router.get('/history', authenticateJWT, getConsultationHistory);
router.get('/mine', authenticateJWT, getMyAppointments);
router.get('/:id', authenticateJWT, getAppointment);

module.exports = router;

