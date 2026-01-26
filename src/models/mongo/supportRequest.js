import mongoose from 'mongoose';

const supportRequestSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  orderIdLegacy: {
    type: Number,
    default: null
  },
  subject: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved', 'closed'],
    default: 'open'
  },
  adminResponse: String,
  legacyId: {
    type: Number,
    index: true,
    unique: true,
    sparse: true
  }
}, {
  timestamps: true
});

export default mongoose.models.SupportRequest || mongoose.model('SupportRequest', supportRequestSchema);
