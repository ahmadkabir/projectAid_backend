import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Ensure upload directory exists
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = 'uploads/';
    if (file.fieldname === 'documentation' || file.fieldname === 'documentationFile') {
      folder += 'documentation/';
    } else if (file.fieldname === 'software' || file.fieldname === 'softwareFile') {
      folder += 'software/';
    } else if (file.fieldname === 'thumbnail') {
      folder += 'thumbnails/';
    } else if (file.fieldname === 'avatar') {
      folder += 'avatars/';
    }
    
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // Normalize fieldname for consistent file naming
    const normalizedName = file.fieldname === 'documentationFile' ? 'documentation' : 
                          file.fieldname === 'softwareFile' ? 'software' : file.fieldname;
    cb(null, normalizedName + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = {
    documentation: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    documentationFile: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    software: ['application/zip', 'application/x-zip-compressed', 'application/x-rar-compressed'],
    softwareFile: ['application/zip', 'application/x-zip-compressed', 'application/x-rar-compressed'],
    thumbnail: ['image/jpeg', 'image/png', 'image/jpg', 'image/gif'],
    avatar: ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp']
  };

  // Normalize fieldname for lookup
  const fieldName = file.fieldname === 'documentationFile' ? 'documentation' : 
                   file.fieldname === 'softwareFile' ? 'software' : file.fieldname;
  const fieldMimes = allowedMimes[fieldName] || allowedMimes[file.fieldname] || [];
  
  if (fieldMimes.length === 0 || fieldMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type for ${file.fieldname}. Allowed types: ${fieldMimes.join(', ')}`), false);
  }
};

export const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 52428800 // 50MB default
  },
  fileFilter: fileFilter
});

/**
 * Project file uploads are held in memory so they can be validated (extension,
 * declared type and magic bytes) before anything is written to object storage.
 * The per-purpose size limits are enforced again in fileValidation.js.
 */
const maxProjectFileSize = Math.max(
  parseInt(process.env.MAX_SOFTWARE_FILE_SIZE, 10) || 0,
  parseInt(process.env.MAX_DOCUMENTATION_FILE_SIZE, 10) || 0,
  parseInt(process.env.MAX_FILE_SIZE, 10) || 0,
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
