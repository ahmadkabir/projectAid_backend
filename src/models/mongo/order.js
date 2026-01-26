import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  projectIdLegacy: Number,
  itemType: {
    type: String,
    enum: ['documentation', 'software', 'full'],
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  legacyId: Number
}, { _id: false, timestamps: true });

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  totalAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  paymentMethod: String,
  transactionId: String,
  items: [orderItemSchema],
  legacyId: {
    type: Number,
    index: true,
    unique: true,
    sparse: true
  }
}, {
  timestamps: true
});

export default mongoose.models.Order || mongoose.model('Order', orderSchema);
