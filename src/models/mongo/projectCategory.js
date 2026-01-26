import mongoose from 'mongoose';

const projectCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
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

export default mongoose.models.ProjectCategory || mongoose.model('ProjectCategory', projectCategorySchema);
