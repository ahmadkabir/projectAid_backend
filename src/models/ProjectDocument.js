import mongoose from 'mongoose';

const projectDocumentSchema = new mongoose.Schema(
  {
    legacyId: {
      type: Number,
      index: true
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true
    },
    projectIdLegacy: {
      type: Number,
      index: true
    },
    content: {
      type: String,
      required: [true, 'Document content is required']
    }
  },
  {
    collection: 'projectdocuments',
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        if (ret.project && typeof ret.project === 'object' && ret.project._id) {
          ret.projectId = ret.project._id.toString();
        } else if (ret.project) {
          ret.projectId = ret.project.toString();
        } else if (ret.projectIdLegacy) {
          ret.projectId = ret.projectIdLegacy;
        }
        delete ret.__v;
        return ret;
      }
    },
    toObject: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        if (ret.project && typeof ret.project === 'object' && ret.project._id) {
          ret.projectId = ret.project._id.toString();
        } else if (ret.project) {
          ret.projectId = ret.project.toString();
        } else if (ret.projectIdLegacy) {
          ret.projectId = ret.projectIdLegacy;
        }
        delete ret.__v;
        return ret;
      }
    }
  }
);

projectDocumentSchema.virtual('projectId')
  .get(function () {
    if (this.project && typeof this.project === 'object' && this.project._id) {
      return this.project._id.toString();
    }
    return this.project ? this.project.toString() : (this.projectIdLegacy || null);
  })
  .set(function (val) {
    if (mongoose.Types.ObjectId.isValid(val)) {
      this.project = val;
    } else if (val) {
      this.projectIdLegacy = Number(val);
    }
  });

projectDocumentSchema.statics.findByIdOrLegacy = function (id) {
  if (!id) return null;
  if (mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === String(id)) {
    return this.findById(id);
  }
  const numeric = Number(id);
  if (!Number.isNaN(numeric)) {
    return this.findOne({ legacyId: numeric });
  }
  return this.findById(id);
};

const ProjectDocument =
  mongoose.models.ProjectDocument || mongoose.model('ProjectDocument', projectDocumentSchema);

export default ProjectDocument;
