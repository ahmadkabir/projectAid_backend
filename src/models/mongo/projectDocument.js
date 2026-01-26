import mongoose from 'mongoose';

const projectDocumentSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    unique: true
  },
  projectIdLegacy: Number,
  content: {
    type: String,
    required: true
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

export default mongoose.models.ProjectDocument || mongoose.model('ProjectDocument', projectDocumentSchema);
