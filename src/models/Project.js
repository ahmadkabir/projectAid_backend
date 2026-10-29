import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
  {
    legacyId: {
      type: Number,
      index: true
    },
    title: {
      type: String,
      required: [true, 'Project title is required'],
      trim: true
    },
    description: {
      type: String,
      required: [true, 'Project description is required']
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProjectCategory',
      required: false,
      index: true
    },
    categoryIdLegacy: {
      type: Number,
      index: true
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
    documentationFile: {
      type: String,
      default: null
    },
    softwareFile: {
      type: String,
      default: null
    },
    thumbnail: {
      type: String,
      default: null
    },
    summary: {
      type: String,
      default: null
    },
    objective: {
      type: String,
      default: null
    },
    features: {
      type: String,
      default: null
    },
    status: {
      type: String,
      default: 'draft'
    },
    projectType: {
      type: String,
      enum: ['documentation', 'software'],
      default: 'documentation'
    },
    price: {
      type: Number,
      default: 0
    },
    level: {
      type: String,
      enum: ['ND', 'HND', 'BSc', 'MSc', null],
      default: null
    },
    institution: {
      type: String,
      default: null
    },
    softwareName: {
      type: String,
      default: null
    },
    softwareVersion: {
      type: String,
      default: null
    },
    softwareDescription: {
      type: String,
      default: null
    },
    softwareOperatingSystem: {
      type: String,
      default: null
    },
    softwareRequirements: {
      type: String,
      default: null
    },
    softwareLicense: {
      type: String,
      default: null
    },
    softwareRedistributionAllowed: {
      type: Boolean,
      default: null
    },
    softwareSaleMode: {
      type: String,
      enum: ['included', 'separate', null],
      default: null
    },
    softwareStatus: {
      type: String,
      enum: ['active', 'archived', null],
      default: null
    }
  },
  {
    collection: 'projects',
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        if (ret.category && typeof ret.category === 'object' && ret.category._id) {
          ret.categoryId = ret.category._id.toString();
        } else if (ret.category) {
          ret.categoryId = ret.category.toString();
        } else if (ret.categoryIdLegacy) {
          ret.categoryId = ret.categoryIdLegacy;
        }
        delete ret.__v;
        return ret;
      }
    },
    toObject: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        if (ret.category && typeof ret.category === 'object' && ret.category._id) {
          ret.categoryId = ret.category._id.toString();
        } else if (ret.category) {
          ret.categoryId = ret.category.toString();
        } else if (ret.categoryIdLegacy) {
          ret.categoryId = ret.categoryIdLegacy;
        }
        delete ret.__v;
        return ret;
      }
    }
  }
);

projectSchema.virtual('categoryId')
  .get(function () {
    if (this.category && typeof this.category === 'object' && this.category._id) {
      return this.category._id.toString();
    }
    return this.category ? this.category.toString() : (this.categoryIdLegacy || null);
  })
  .set(function (val) {
    if (mongoose.Types.ObjectId.isValid(val)) {
      this.category = val;
    } else if (val) {
      this.categoryIdLegacy = Number(val);
    }
  });

projectSchema.virtual('documentFiles', {
  ref: 'ProjectDocumentFile',
  localField: '_id',
  foreignField: 'project'
});

projectSchema.statics.findByIdOrLegacy = function (id) {
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

const Project = mongoose.models.Project || mongoose.model('Project', projectSchema);

export default Project;
