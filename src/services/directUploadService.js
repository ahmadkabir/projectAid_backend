import {
  buildStorageKey,
  isKeyInNamespace,
  getSignedUploadUrl,
  readObjectPrefix,
  statObject,
  getStorageProvider
} from './storageService.js';
import {
  FILE_CATEGORIES,
  PURPOSE_BY_CATEGORY,
  UploadError,
  assertStorageReady,
  recordUploadedObject
} from './projectFileService.js';
import {
  FILE_RULES,
  formatBytes,
  validateFileBytes,
  validateUploadMetadata
} from './fileValidation.js';

/**
 * Direct-to-R2 uploads.
 *
 * 1. The admin asks for a ticket: the backend validates the declared metadata,
 *    builds an unguessable key and signs a short-lived PUT URL.
 * 2. The browser PUTs the bytes straight to R2 with progress, so large
 *    software archives never occupy the API server.
 * 3. The backend finalizes by verifying the object really exists, matches the
 *    declared size and starts with the expected file signature before the
 *    database record is made current.
 */

const assertCategory = (category) => {
  if (!FILE_CATEGORIES.includes(category)) {
    throw new UploadError(`Unsupported file category: ${category}`);
  }
};

/**
 * Step 1 — validate metadata and sign an upload URL.
 */
export const createUploadTicket = async ({
  projectId,
  category,
  originalName,
  mimeType,
  size
}) => {
  assertCategory(category);
  assertStorageReady();

  const purpose = PURPOSE_BY_CATEGORY[category];
  const validation = validateUploadMetadata({ originalName, mimeType, size }, purpose);
  if (!validation.ok) throw new UploadError(validation.error);

  const storageKey = buildStorageKey({
    category,
    projectId,
    originalName: validation.meta.originalName
  });

  const { url, headers, expiresIn } = await getSignedUploadUrl(storageKey, {
    contentType: validation.meta.mimeType
  });

  return {
    uploadUrl: url,
    storageKey,
    category,
    headers,
    expiresIn,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    maxSize: FILE_RULES[purpose].maxSize
  };
};

/**
 * Step 2 — verify the uploaded object then record it as the current file.
 * Returns the new record plus the effective (sniffed) metadata.
 */
export const finalizeUpload = async ({
  projectId,
  category,
  storageKey,
  originalName,
  mimeType,
  size,
  createdBy = null,
  transaction
}) => {
  assertCategory(category);
  assertStorageReady();

  if (!isKeyInNamespace(storageKey, { category, projectId })) {
    throw new UploadError('The upload key does not belong to this project');
  }

  const purpose = PURPOSE_BY_CATEGORY[category];
  const rule = FILE_RULES[purpose];
  const declared = validateUploadMetadata({ originalName, mimeType, size }, purpose);
  if (!declared.ok) throw new UploadError(declared.error);

  let head;
  try {
    head = await statObject(storageKey);
  } catch (error) {
    throw new UploadError(`Object storage is unavailable: ${error.message}`, 503);
  }
  if (!head?.exists) {
    throw new UploadError('The uploaded file could not be found. Upload it again.', 409);
  }

  if (Number(head.size) !== Number(declared.meta.size)) {
    throw new UploadError(
      `The uploaded file is ${formatBytes(Number(head.size))} but ${formatBytes(
        declared.meta.size
      )} was expected. Upload it again.`
    );
  }

  if (Number(head.size) > rule.maxSize) {
    throw new UploadError(`${rule.label} is too large (max ${formatBytes(rule.maxSize)})`);
  }

  if (Number(head.size) <= 0) {
    throw new UploadError(`${rule.label}: the uploaded file is empty`);
  }

  // Verify the real bytes, not just the browser supplied MIME type. A DOCX is
  // a ZIP, so read enough of the archive to see its WordprocessingML parts.
  let prefix;
  try {
    prefix = await readObjectPrefix(storageKey, 65536);
  } catch (error) {
    throw new UploadError(`The uploaded file could not be read back: ${error.message}`, 503);
  }
  const bytes = validateFileBytes(prefix, declared.meta, purpose);
  if (!bytes.ok) throw new UploadError(bytes.error);

  const record = await recordUploadedObject({
    projectId,
    category,
    originalName: bytes.meta.originalName,
    mimeType: bytes.meta.mimeType,
    fileType: bytes.meta.fileType,
    size: Number(head.size),
    storageKey,
    createdBy,
    transaction
  });

  return {
    record,
    meta: {
      ...bytes.meta,
      size: Number(head.size),
      provider: getStorageProvider()
    }
  };
};
