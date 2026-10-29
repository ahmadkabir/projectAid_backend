import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema(
  {
    legacyId: {
      type: Number
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true
    },
    projectIdLegacy: {
      type: Number
    },
    itemType: {
      type: String,
      enum: ['documentation', 'software', 'full'],
      required: true
    },
    price: {
      type: Number,
      required: true
    }
  },
  {
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

orderItemSchema.virtual('projectId')
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

const orderSchema = new mongoose.Schema(
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
    totalAmount: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
      index: true
    },
    paymentMethod: {
      type: String,
      default: null
    },
    transactionId: {
      type: String,
      default: null,
      index: true
    },
    items: [orderItemSchema]
  },
  {
    collection: 'orders',
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
        delete ret.__v;
        return ret;
      }
    }
  }
);

orderSchema.virtual('userId')
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

orderSchema.statics.findByIdOrLegacy = function (id) {
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

const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);

export { orderItemSchema };
export default Order;
