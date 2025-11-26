const mongoose = require('mongoose');

const legalTemplateSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Template title is required'],
      trim: true,
    },
    content: {
      type: String,
      required: [true, 'Template content is required'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: [
        'Contract',
        'Agreement',
        'Notice',
        'Petition',
        'Affidavit',
        'Power of Attorney',
        'Will',
        'Other',
      ],
    },
    description: {
      type: String,
      maxlength: 500,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

legalTemplateSchema.index({ category: 1 });
legalTemplateSchema.index({ isActive: 1 });
legalTemplateSchema.index({ createdAt: -1 });

module.exports = mongoose.model('LegalTemplate', legalTemplateSchema);

