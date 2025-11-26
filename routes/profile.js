const express = require('express');
const router = express.Router();
const {
  uploadProfilePicture,
  deleteProfilePicture,
} = require('../controllers/profileController');
const { authenticateJWT } = require('../middlewares/auth');
const { imageUpload } = require('../middlewares/upload');

router.post('/picture', authenticateJWT, imageUpload.single('image'), uploadProfilePicture);
router.delete('/picture', authenticateJWT, deleteProfilePicture);

module.exports = router;

