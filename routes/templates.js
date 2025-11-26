const express = require('express');
const router = express.Router();
const {
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} = require('../controllers/templateController');
const { authenticateJWT, authorizeRoles } = require('../middlewares/auth');

router.get('/', getTemplates);
router.get('/:id', getTemplateById);
router.post('/', authenticateJWT, authorizeRoles('ADMIN'), createTemplate);
router.patch('/:id', authenticateJWT, authorizeRoles('ADMIN'), updateTemplate);
router.delete('/:id', authenticateJWT, authorizeRoles('ADMIN'), deleteTemplate);

module.exports = router;

