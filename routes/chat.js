const express = require('express');
const router = express.Router();
const {
  getConversations,
  getMessages,
  getOrCreateConversation,
} = require('../controllers/chatController');
const { authenticateJWT } = require('../middlewares/auth');

router.get('/conversations', authenticateJWT, getConversations);
router.get('/conversation/find/:userId', authenticateJWT, getOrCreateConversation);
router.get('/conversations/:conversationId/messages', authenticateJWT, getMessages);

module.exports = router;

