const express = require('express');
const router = express.Router();
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  clearAll,
} = require('../controllers/notificationController');
const { authenticateJWT } = require('../middlewares/auth');

router.get('/', authenticateJWT, getNotifications);
router.patch('/:id/read', authenticateJWT, markAsRead);
router.patch('/read-all', authenticateJWT, markAllAsRead);
router.delete('/clear-all', authenticateJWT, clearAll);

module.exports = router;

