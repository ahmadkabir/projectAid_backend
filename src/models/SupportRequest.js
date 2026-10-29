import mongoose from 'mongoose';

const supportRequestSchema = new mongoose.Schema(
  {
    legacyId: {
      type: Number,
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
      index: true
    },
    orderIdLegacy: {
      type: Number,
      default: null
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true
    },
    message: {
      type: String,
      required: [true, 'Message is required']
    },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved', 'closed'],
      default: 'open',
      index: true
    },
    adminResponse: {
      type: String,
      default: null
    }
  },
  {
    collection: 'supportrequests',
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        if (ret.user && typeof ret.user === 'object' && ret.user._id) {
          ret.userId = ret.user._id.toString();
        } else if (ret.user) {
          ret.userId = ret.user.toString();
        }
        if (ret.project && typeof ret.project === 'object' && ret.project._id) {
          ret.projectId = ret.project._id.toString();
        } else if (ret.project) {
          ret.projectId = ret.project.toString();
        }
        if (ret.order && typeof ret.order === 'object' && ret.order._id) {
          ret.orderId = ret.order._id.toString();
        } else if (ret.order) {
          ret.orderId = ret.order.toString();
        } else if (ret.orderIdLegacy) {
          ret.orderId = ret.orderIdLegacy;
        }
        delete ret.__v;
        return ret;
      }
    },
    toObject: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        if (ret.user && typeof ret.user === 'object' && ret.user._id) {
          ret.userId = ret.user._id.toString();
        } else if (ret.user) {
          ret.userId = ret.user.toString();
        }
        if (ret.project && typeof ret.project === 'object' && ret.project._id) {
          ret.projectId = ret.project._id.toString();
        } else if (ret.project) {
          ret.projectId = ret.project.toString();
        }
        if (ret.order && typeof ret.order === 'object' && ret.order._id) {
          ret.orderId = ret.order._id.toString();
        } else if (ret.order) {
          ret.orderId = ret.order.toString();
        } else if (ret.orderIdLegacy) {
          ret.orderId = ret.orderIdLegacy;
        }
        delete ret.__v;
        return ret;
      }
    }
  }
);

supportRequestSchema.virtual('userId')
  .get(function () {
    if (this.user && typeof this.user === 'object' && this.user._id) {
      return this.user._id.toString();
    }
    return this.user ? this.user.toString() : null;
  })
  .set(function (val) {
    if (mongoose.Types.ObjectId.isValid(val)) {
      this.user = val;
    }
  });

supportRequestSchema.virtual('projectId')
  .get(function () {
    if (this.project && typeof this.project === 'object' && this.project._id) {
      return this.project._id.toString();
    }
    return this.project ? this.project.toString() : null;
  })
  .set(function (val) {
    if (mongoose.Types.ObjectId.isValid(val)) {
      this.project = val;
    }
  });

supportRequestSchema.virtual('orderId')
  .get(function () {
    if (this.order && typeof this.order === 'object' && this.order._id) {
      return this.order._id.toString();
    }
    return this.order ? this.order.toString() : (this.orderIdLegacy || null);
  })
  .set(function (val) {
    if (mongoose.Types.ObjectId.isValid(val)) {
      this.order = val;
    } else if (val) {
      this.orderIdLegacy = Number(val);
    }
  });

supportRequestSchema.statics.findByIdOrLegacy = function (id) {
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

const SupportRequest =
  mongoose.models.SupportRequest || mongoose.model('SupportRequest', supportRequestSchema);

export default SupportRequest;
