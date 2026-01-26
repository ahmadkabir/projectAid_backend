import mongoose from 'mongoose';

const projectDocumentFileSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  projectIdLegacy: Number,
  fileName: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    enum: ['pdf', 'docx'],
    required: true
  },
  filePath: {
    type: String,
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  legacyId: {
    type: Number,
    index: true,
    unique: true,
    sparse: true
  }
}, {
  timestamps: true
});

export default mongoose.models.ProjectDocumentFile || mongoose.model('ProjectDocumentFile', projectDocumentFileSchema);
