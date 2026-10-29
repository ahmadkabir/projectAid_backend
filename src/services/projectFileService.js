import path from 'path';
import crypto from 'crypto';
import mongoose from 'mongoose';
import ProjectDocumentFile from '../models/ProjectDocumentFile.js';
import {
  buildStorageKey,
  saveBuffer,
  deleteObject,
  isStorageConfigured,
  getStorageProvider,
  legacyPathForKey,
  extensionOf
} from './storageService.js';
import { validateUploadedFile } from './fileValidation.js';

/**
 * Project file records: upload validation, storage, metadata and safe
 * replacement.
 *
 * Replacement never deletes the previous object: it is marked as superseded so
 * completed orders keep working. Objects are only deleted when the database
 * write that introduced them fails.
 */

export class UploadError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'UploadError';
    this.status = status;
  }
}

export const FILE_CATEGORIES = ['documentation', 'software', 'guide'];

export const PURPOSE_BY_CATEGORY = {
  documentation: 'documentation',
  software: 'software',
  guide: 'guide'
};

export const assertStorageReady = () => {
  if (!isStorageConfigured()) {
    throw new UploadError(
      'Object storage is not configured. Set STORAGE_PROVIDER and the STORAGE_S3_* variables.',
      503
    );
  }
};

const buildProjectQuery = (projectId) => {
  if (mongoose.Types.ObjectId.isValid(projectId) && String(new mongoose.Types.ObjectId(projectId)) === String(projectId)) {
    return { project: projectId };
  }
  const numeric = Number(projectId);
  if (!Number.isNaN(numeric)) {
    return { $or: [{ projectIdLegacy: numeric }, { project: projectId }] };
  }
  return { project: projectId };
};

export const listProjectFiles = async (projectId, { includeSuperseded = false } = {}) => {
  const query = buildProjectQuery(projectId);
  if (!includeSuperseded) query.isCurrent = true;

  return ProjectDocumentFile.find(query).sort({ createdAt: -1, _id: -1 });
};

export const currentFileFor = async (projectId, category, { session, transaction } = {}) => {
  const activeSession = session || transaction?.session || (transaction instanceof mongoose.ClientSession ? transaction : null);
  const query = {
    ...buildProjectQuery(projectId),
    category,
    isCurrent: true,
    uploadStatus: 'completed'
  };

  const findQuery = ProjectDocumentFile.findOne(query).sort({ createdAt: -1, _id: -1 });
  if (activeSession) findQuery.session(activeSession);
  return findQuery;
};

/**
 * Upload a file and record its metadata as the current file for its category.
 */
export const storeProjectFile = async ({
  projectId,
  category,
  file,
  createdBy = null,
  supersede = true,
  session,
  transaction
}) => {
  const activeSession = session || transaction?.session || (transaction instanceof mongoose.ClientSession ? transaction : null);
  if (!FILE_CATEGORIES.includes(category)) {
    throw new UploadError(`Unsupported file category: ${category}`);
  }
  assertStorageReady();

  const purpose = PURPOSE_BY_CATEGORY[category];
  const validation = validateUploadedFile(file, purpose);
  if (!validation.ok) {
    throw new UploadError(validation.error);
  }

  const { meta } = validation;
  const storageKey = buildStorageKey({
    category,
    projectId,
    originalName: meta.originalName
  });

  const saved = await saveBuffer(storageKey, file.buffer, { contentType: meta.mimeType });

  try {
    const projectQuery = buildProjectQuery(projectId);

    if (supersede) {
      const updateQuery = ProjectDocumentFile.updateMany(
        { ...projectQuery, category, isCurrent: true },
        { isCurrent: false, supersededAt: new Date() }
      );
      if (activeSession) updateQuery.session(activeSession);
      await updateQuery;
    }

    const docData = {
      project: mongoose.Types.ObjectId.isValid(projectId) ? projectId : undefined,
      projectIdLegacy: !mongoose.Types.ObjectId.isValid(projectId) && !Number.isNaN(Number(projectId)) ? Number(projectId) : undefined,
      fileName: storageKey.split('/').pop(),
      originalName: meta.originalName,
      category,
      fileType: meta.fileType,
      filePath: legacyPathForKey(storageKey),
      storageKey,
      storageProvider: saved.provider,
      mimeType: meta.mimeType,
      fileSize: saved.size,
      checksum: saved.checksum,
      uploadStatus: 'completed',
      isCurrent: true,
      createdBy
    };

    const doc = new ProjectDocumentFile(docData);
    await doc.save({ session: activeSession });
    return doc;
  } catch (error) {
    // The database rejected the record: remove the object we just wrote so no
    // orphan is left behind.
    await deleteObject(storageKey).catch(() => {});
    throw error;
  }
};

/**
 * Record an object that was already written to storage out-of-band (a browser
 * PUT against a presigned URL). Its signature and size have been verified by
 * the caller, so this only performs the bookkeeping.
 */
export const recordUploadedObject = async ({
  projectId,
  category,
  originalName,
  mimeType,
  fileType,
  size,
  storageKey,
  checksum = null,
  createdBy = null,
  supersede = true,
  session,
  transaction
}) => {
  const activeSession = session || transaction?.session || (transaction instanceof mongoose.ClientSession ? transaction : null);
  if (!FILE_CATEGORIES.includes(category)) {
    throw new UploadError(`Unsupported file category: ${category}`);
  }

  const projectQuery = buildProjectQuery(projectId);

  if (supersede) {
    const updateQuery = ProjectDocumentFile.updateMany(
      { ...projectQuery, category, isCurrent: true },
      { isCurrent: false, supersededAt: new Date() }
    );
    if (activeSession) updateQuery.session(activeSession);
    await updateQuery;
  }

  const docData = {
    project: mongoose.Types.ObjectId.isValid(projectId) ? projectId : undefined,
    projectIdLegacy: !mongoose.Types.ObjectId.isValid(projectId) && !Number.isNaN(Number(projectId)) ? Number(projectId) : undefined,
    fileName: storageKey.split('/').pop(),
    originalName,
    category,
    fileType,
    filePath: legacyPathForKey(storageKey),
    storageKey,
    storageProvider: getStorageProvider(),
    mimeType,
    fileSize: size,
    checksum,
    uploadStatus: 'completed',
    isCurrent: true,
    createdBy
  };

  const doc = new ProjectDocumentFile(docData);
  await doc.save({ session: activeSession });
  return doc;
};

/**
 * Remove objects uploaded during a failed request (e.g. a project create that
 * rolled back). Never used for files that already existed.
 */
export const cleanupUploadedObjects = async (keys = []) => {
  await Promise.all(
    keys.filter(Boolean).map((key) => deleteObject(key).catch(() => {}))
  );
};

/**
 * Cover images are public marketing assets. They use the same storage provider
 * as everything else (local `uploads/thumbnails` in development, R2/S3 in
 * production) because Vercel's filesystem is read-only. The public asset route
 * in app.js streams them back at `/uploads/thumbnails/<file>`.
 */
export const storePublicThumbnail = async (file) => {
  const validation = validateUploadedFile(file, 'thumbnail');
  if (!validation.ok) {
    throw new UploadError(validation.error);
  }

  const { meta } = validation;
  const fileName = `thumbnail-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${extensionOf(meta.originalName)}`;

  await saveBuffer(`thumbnails/${fileName}`, file.buffer, { contentType: meta.mimeType });
  return fileName;
};

export const deletePublicThumbnail = async (fileName) => {
  if (!fileName) return;
  try {
    await deleteObject(`thumbnails/${path.basename(fileName)}`);
  } catch {
    // Missing thumbnails are not an error.
  }
};

export const serializeFile = (file, { includeStorage = false } = {}) => {
  if (!file) return null;
  const plain = file.toJSON ? file.toJSON() : file;
  const result = {
    id: plain.id,
    projectId: plain.projectId,
    fileName: plain.fileName,
    originalName: plain.originalName || plain.fileName,
    category: plain.category || 'documentation',
    fileType: plain.fileType,
    mimeType: plain.mimeType || null,
    fileSize: plain.fileSize || null,
    uploadStatus: plain.uploadStatus || 'completed',
    isCurrent: plain.isCurrent === true || plain.isCurrent === 1 || plain.isCurrent === '1',
    supersededAt: plain.supersededAt || null,
    createdAt: plain.createdAt,
    downloadUrl: `/api/files/${plain.id}/download`
  };

  if (includeStorage) {
    result.storageKey = plain.storageKey || plain.filePath;
    result.storageProvider = plain.storageProvider || getStorageProvider();
  }

  return result;
};
