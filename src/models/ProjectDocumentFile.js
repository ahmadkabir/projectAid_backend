import mongoose from 'mongoose';

const projectDocumentFileSchema = new mongoose.Schema(
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
    fileName: {
      type: String,
      required: [true, 'File name is required']
    },
    originalName: {
      type: String,
      default: null
    },
    category: {
      type: String,
      enum: ['documentation', 'software', 'guide'],
      default: 'documentation',
      index: true
    },
    fileType: {
      type: String,
      enum: ['pdf', 'doc', 'docx', 'zip', 'rar'],
      required: true
    },
    filePath: {
      type: String,
      default: null
    },
    storageKey: {
      type: String,
      default: null,
      index: true
    },
    storageProvider: {
      type: String,
      default: 'local'
    },
    mimeType: {
      type: String,
      default: null
    },
    fileSize: {
      type: Number,
      default: null
    },
    checksum: {
      type: String,
      default: null
    },
    uploadStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'completed',
      index: true
    },
    isCurrent: {
      type: Boolean,
      default: true,
      index: true
    },
    supersededAt: {
      type: Date,
      default: null
    },
    archivedAt: {
      type: Date,
      default: null
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    collection: 'projectdocumentfiles',
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

projectDocumentFileSchema.virtual('projectId')
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

projectDocumentFileSchema.statics.findByIdOrLegacy = function (id) {
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

const ProjectDocumentFile =
  mongoose.models.ProjectDocumentFile || mongoose.model('ProjectDocumentFile', projectDocumentFileSchema);

export default ProjectDocumentFile;
