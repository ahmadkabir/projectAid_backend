import mongoose from 'mongoose';

const options = {
  timestamps: true,
  versionKey: false
};

const userSchema = new mongoose.Schema({
  legacyId: { type: Number, index: true, unique: true },
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, enum: ['student', 'admin'], default: 'student' }
}, options);

const projectCategorySchema = new mongoose.Schema({
  legacyId: { type: Number, index: true, unique: true },
  name: { type: String, required: true },
  description: String
}, options);

const projectSchema = new mongoose.Schema({
  legacyId: { type: Number, index: true, unique: true },
  title: String,
  description: String,
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'ProjectCategory' },
  categoryIdLegacy: Number,
  documentationPrice: Number,
  softwarePrice: Number,
  fullProjectPrice: Number,
  documentationFile: String,
  softwareFile: String,
  thumbnail: String,
  summary: String,
  objective: String,
  features: String,
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  projectType: { type: String, enum: ['documentation', 'software'], default: 'documentation' },
  price: Number,
  level: { type: String, enum: ['ND', 'HND', 'BSc', 'MSc'] },
  institution: String
}, options);

const orderItemSchema = new mongoose.Schema({
  legacyId: { type: Number, index: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  projectIdLegacy: Number,
  itemType: { type: String, enum: ['documentation', 'software', 'full'] },
  price: Number
}, options);

const orderSchema = new mongoose.Schema({
  legacyId: { type: Number, index: true, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  totalAmount: Number,
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  paymentMethod: String,
  transactionId: String,
  items: [orderItemSchema]
}, options);

const supportRequestSchema = new mongoose.Schema({
  legacyId: { type: Number, index: true, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  orderIdLegacy: Number,
  subject: String,
  message: String,
  status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open' },
  adminResponse: String
}, options);

const projectDocumentSchema = new mongoose.Schema({
  legacyId: { type: Number, index: true, unique: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  projectIdLegacy: Number,
  content: String
}, options);

const projectDocumentFileSchema = new mongoose.Schema({
  legacyId: { type: Number, index: true, unique: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  projectIdLegacy: Number,
  fileName: String,
  fileType: { type: String, enum: ['pdf', 'docx'] },
  filePath: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, options);

export const mongoModels = {
  User: mongoose.model('User', userSchema),
  ProjectCategory: mongoose.model('ProjectCategory', projectCategorySchema),
  Project: mongoose.model('Project', projectSchema),
  Order: mongoose.model('Order', orderSchema),
  SupportRequest: mongoose.model('SupportRequest', supportRequestSchema),
  ProjectDocument: mongoose.model('ProjectDocument', projectDocumentSchema),
  ProjectDocumentFile: mongoose.model('ProjectDocumentFile', projectDocumentFileSchema)
};
