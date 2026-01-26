import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProjectCategory',
    required: true
  },
  documentationPrice: {
    type: Number,
    default: 0
  },
  softwarePrice: {
    type: Number,
    default: 0
  },
  fullProjectPrice: {
    type: Number,
    default: 0
  },
  documentationFile: String,
  softwareFile: String,
  thumbnail: String,
  summary: String,
  objective: String,
  features: String,
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  projectType: {
    type: String,
    enum: ['documentation', 'software'],
    default: 'documentation'
  },
  price: Number,
  level: {
    type: String,
    enum: ['ND', 'HND', 'BSc', 'MSc']
  },
  institution: String,
  legacyId: {
    type: Number,
    index: true,
    unique: true,
    sparse: true
  },
  categoryIdLegacy: Number
}, {
  timestamps: true
});

export default mongoose.models.Project || mongoose.model('Project', projectSchema);
