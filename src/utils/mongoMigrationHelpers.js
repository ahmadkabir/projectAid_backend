import mongoose from 'mongoose';
import { mongoModels } from './mongoModels.js';

const { User, ProjectCategory, Project, Order, SupportRequest, ProjectDocument, ProjectDocumentFile } = mongoModels;

export const connectMongo = async () => {
  const { MONGO_URI } = process.env;

  if (!MONGO_URI) {
    throw new Error('Missing MONGO_URI in environment. Please provide connection string to MongoDB.');
  }

  await mongoose.connect(MONGO_URI, {
    autoIndex: true,
    serverSelectionTimeoutMS: 5000
  });

  console.log('✅ Connected to MongoDB');
  return mongoose.connection;
};

export const closeMongoConnection = async (connection) => {
  if (connection) {
    await connection.close();
    console.log('🔌 MongoDB connection closed');
  }
};

const insertWithProgress = async (Model, documents, options = {}) => {
  if (!documents || documents.length === 0) {
    return 0;
  }

  const { clear = false, transform = (doc) => doc } = options;

  if (clear) {
    await Model.deleteMany({});
  }

  const transformedDocs = documents.map(transform);
  const result = await Model.insertMany(transformedDocs, { ordered: false });
  return result.length;
};

const createIdMap = (rows = []) => {
  return rows.reduce((acc, row) => {
    acc[row.id] = new mongoose.Types.ObjectId();
    return acc;
  }, {});
};

export const insertAllData = async (data) => {
  console.log('📤 Inserting data into MongoDB...');

  const userIdMap = createIdMap(data.users);
  const categoryIdMap = createIdMap(data.project_categories);
  const projectIdMap = createIdMap(data.projects);
  const orderIdMap = createIdMap(data.orders);
  const supportRequestIdMap = createIdMap(data.support_requests);
  const projectDocumentIdMap = createIdMap(data.project_documents);
  const projectDocumentFileIdMap = createIdMap(data.project_document_files);

  const insertedCounts = {};

  insertedCounts.users = await insertWithProgress(User, data.users, {
    clear: true,
    transform: (row) => ({
      _id: userIdMap[row.id],
      legacyId: row.id,
      name: row.name,
      email: row.email,
      password: row.password,
      role: row.role,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    })
  });

  insertedCounts.projectCategories = await insertWithProgress(ProjectCategory, data.project_categories, {
    clear: true,
    transform: (row) => ({
      _id: categoryIdMap[row.id],
      legacyId: row.id,
      name: row.name,
      description: row.description,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    })
  });

  insertedCounts.projects = await insertWithProgress(Project, data.projects, {
    clear: true,
    transform: (row) => ({
      _id: projectIdMap[row.id],
      legacyId: row.id,
      title: row.title,
      description: row.description,
      category: categoryIdMap[row.categoryId] || null,
      categoryIdLegacy: row.categoryId,
      documentationPrice: row.documentationPrice,
      softwarePrice: row.softwarePrice,
      fullProjectPrice: row.fullProjectPrice,
      documentationFile: row.documentationFile || null,
      softwareFile: row.softwareFile || null,
      thumbnail: row.thumbnail || null,
      summary: row.summary,
      objective: row.objective,
      features: row.features,
      status: row.status,
      projectType: row.projectType || 'documentation',
      level: row.level,
      institution: row.institution,
      price: row.price,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    })
  });

  insertedCounts.orders = await insertWithProgress(Order, data.orders, {
    clear: true,
    transform: (row) => ({
      _id: orderIdMap[row.id],
      legacyId: row.id,
      user: userIdMap[row.userId] || null,
      totalAmount: row.totalAmount,
      status: row.status,
      paymentMethod: row.paymentMethod,
      transactionId: row.transactionId,
      items: data.order_items
        .filter((item) => item.orderId === row.id)
        .map((item) => ({
          legacyId: item.id,
          project: projectIdMap[item.projectId] || null,
          projectIdLegacy: item.projectId,
          itemType: item.itemType,
          price: item.price,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt
        })),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    })
  });

  insertedCounts.supportRequests = await insertWithProgress(SupportRequest, data.support_requests, {
    clear: true,
    transform: (row) => ({
      _id: supportRequestIdMap[row.id],
      legacyId: row.id,
      user: userIdMap[row.userId] || null,
      project: projectIdMap[row.projectId] || null,
      orderIdLegacy: row.orderId,
      subject: row.subject,
      message: row.message,
      status: row.status,
      adminResponse: row.adminResponse,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    })
  });

  insertedCounts.projectDocuments = await insertWithProgress(ProjectDocument, data.project_documents, {
    clear: true,
    transform: (row) => ({
      _id: projectDocumentIdMap[row.id],
      legacyId: row.id,
      project: projectIdMap[row.projectId] || null,
      projectIdLegacy: row.projectId,
      content: row.content,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    })
  });

  insertedCounts.projectDocumentFiles = await insertWithProgress(ProjectDocumentFile, data.project_document_files, {
    clear: true,
    transform: (row) => ({
      _id: projectDocumentFileIdMap[row.id],
      legacyId: row.id,
      project: projectIdMap[row.projectId] || null,
      projectIdLegacy: row.projectId,
      fileName: row.fileName,
      fileType: row.fileType,
      filePath: row.filePath,
      createdBy: row.createdBy ? userIdMap[row.createdBy] : null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    })
  });

  console.log('✅ MongoDB insertion complete:', insertedCounts);
  return insertedCounts;
};
