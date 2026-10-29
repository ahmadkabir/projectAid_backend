import multer from 'multer';

/**
 * Upload handling.
 *
 * Nothing is written to disk here: Vercel's deployment filesystem is read-only
 * and only `/tmp` is writable. Project files are buffered and sent to the
 * configured storage provider (local `uploads/` in development, R2/S3 in
 * production); avatars use the same path.
 */

const allowedMimes = {
  documentation: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ],
  documentationFile: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ],
  software: ['application/zip', 'application/x-zip-compressed', 'application/x-rar-compressed'],
  softwareFile: ['application/zip', 'application/x-zip-compressed', 'application/x-rar-compressed'],
  thumbnail: ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'],
  avatar: ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp']
};

const makeFileFilter = (fallbackField) => (req, file, cb) => {
  const normalized =
    file.fieldname === 'documentationFile' ? 'documentation'
      : file.fieldname === 'softwareFile' ? 'software'
        : file.fieldname;

  const fieldMimes = allowedMimes[normalized] || allowedMimes[file.fieldname] || allowedMimes[fallbackField] || [];

  if (fieldMimes.length === 0 || fieldMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type for ${file.fieldname}. Allowed types: ${fieldMimes.join(', ')}`), false);
  }
};

const maxFileSize = parseInt(process.env.MAX_FILE_SIZE, 10) || 52428800;

/**
 * Project file uploads are held in memory so they can be validated (extension,
 * declared type and magic bytes) before anything is written to object storage.
 * The per-purpose size limits are enforced again in fileValidation.js.
 */
const maxProjectFileSize = Math.max(
  parseInt(process.env.MAX_SOFTWARE_FILE_SIZE, 10) || 0,
  parseInt(process.env.MAX_DOCUMENTATION_FILE_SIZE, 10) || 0,
  maxFileSize,
  52428800
);

export const projectFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxProjectFileSize,
    files: 8,
    fields: 40
  }
});

/**
 * Avatars are small images. The limit stays below Vercel's 4.5 MB payload cap
 * so the request reaches this handler instead of failing at the edge.
 */
const maxAvatarFileSize = Math.min(
  parseInt(process.env.MAX_IMAGE_SIZE, 10) || 4 * 1024 * 1024,
  4 * 1024 * 1024
);

export const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxAvatarFileSize,
    files: 1
  },
  fileFilter: makeFileFilter('avatar')
});
