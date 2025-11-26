const LegalTemplate = require('../models/LegalTemplate');

// @route   GET /api/templates
// @desc    Get all legal templates
// @access  Public
exports.getTemplates = async (req, res) => {
  try {
    const { category, search, page = 1, limit = 20 } = req.query;

    const query = { isActive: true };

    if (category) {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const templates = await LegalTemplate.find(query)
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await LegalTemplate.countDocuments(query);

    res.json({
      success: true,
      data: {
        templates,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @route   GET /api/templates/:id
// @desc    Get single template
// @access  Public
exports.getTemplateById = async (req, res) => {
  try {
    const template = await LegalTemplate.findById(req.params.id)
      .populate('createdBy', 'firstName lastName');

    if (!template || !template.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Template not found',
      });
    }

    // Increment usage count
    template.usageCount += 1;
    await template.save();

    res.json({
      success: true,
      data: { template },
    });
  } catch (error) {
    console.error('Get template error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @route   POST /api/templates
// @desc    Create legal template (Admin only)
// @access  Private (Admin only)
exports.createTemplate = async (req, res) => {
  try {
    const { title, content, category, description } = req.body;

    const template = await LegalTemplate.create({
      title,
      content,
      category,
      description: description || '',
      createdBy: req.user._id,
    });

    await template.populate('createdBy', 'firstName lastName');

    res.status(201).json({
      success: true,
      message: 'Template created successfully',
      data: { template },
    });
  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @route   PATCH /api/templates/:id
// @desc    Update template (Admin only)
// @access  Private (Admin only)
exports.updateTemplate = async (req, res) => {
  try {
    const template = await LegalTemplate.findById(req.params.id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found',
      });
    }

    const allowedUpdates = ['title', 'content', 'category', 'description', 'isActive'];
    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        template[field] = req.body[field];
      }
    });

    await template.save();
    await template.populate('createdBy', 'firstName lastName');

    res.json({
      success: true,
      message: 'Template updated successfully',
      data: { template },
    });
  } catch (error) {
    console.error('Update template error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @route   DELETE /api/templates/:id
// @desc    Delete template (Admin only)
// @access  Private (Admin only)
exports.deleteTemplate = async (req, res) => {
  try {
    const template = await LegalTemplate.findById(req.params.id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found',
      });
    }

    await LegalTemplate.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error) {
    console.error('Delete template error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

