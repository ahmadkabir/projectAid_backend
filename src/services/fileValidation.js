import path from 'path';

/**
 * Backend file validation.
 *
 * Nothing supplied by the browser is trusted: the extension is checked against
 * an allowlist, the declared MIME type must be plausible for that purpose, and
 * the actual bytes are sniffed for a known signature. Executables are always
 * rejected.
 */

const KB = 1024;
const MB = 1024 * KB;

const envSize = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

export const MAX_DOCUMENTATION_SIZE = envSize('MAX_DOCUMENTATION_FILE_SIZE', 25 * MB);
export const MAX_SOFTWARE_SIZE = envSize('MAX_SOFTWARE_FILE_SIZE', 50 * MB);
export const MAX_GUIDE_SIZE = envSize('MAX_GUIDE_FILE_SIZE', 10 * MB);
export const MAX_IMAGE_SIZE = envSize('MAX_IMAGE_SIZE', 5 * MB);

const DOC_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];
const ARCHIVE_MIMES = [
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/vnd.rar',
  'application/octet-stream'
];
const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

export const FILE_RULES = {
  documentation: {
    label: 'Project documentation',
    extensions: ['.pdf', '.doc', '.docx'],
    mimeTypes: DOC_MIMES,
    maxSize: MAX_DOCUMENTATION_SIZE
  },
  software: {
    label: 'Software installer',
    extensions: ['.zip', '.rar'],
    mimeTypes: ARCHIVE_MIMES,
    maxSize: MAX_SOFTWARE_SIZE
  },
  guide: {
    label: 'User guide',
    extensions: ['.pdf', '.doc', '.docx'],
    mimeTypes: DOC_MIMES,
    maxSize: MAX_GUIDE_SIZE
  },
  thumbnail: {
    label: 'Cover image',
    extensions: ['.jpg', '.jpeg', '.png', '.webp'],
    mimeTypes: IMAGE_MIMES,
    maxSize: MAX_IMAGE_SIZE
  }
};

/** Which sniffed kinds are acceptable for each extension. */
const EXTENSION_KINDS = {
  '.pdf': ['pdf'],
  '.doc': ['doc'],
  '.docx': ['docx'],
  '.zip': ['zip', 'docx'], // a DOCX is a ZIP; accept it as a software archive too
  '.rar': ['rar'],
  '.jpg': ['jpeg'],
  '.jpeg': ['jpeg'],
  '.png': ['png'],
  '.webp': ['webp']
};

const DETECTED_MIME = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  zip: 'application/zip',
  rar: 'application/vnd.rar',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp'
};

const FILE_TYPES = {
  pdf: 'pdf',
  doc: 'doc',
  docx: 'docx',
  zip: 'zip',
  rar: 'rar'
};

const FILE_TYPES_BY_EXTENSION = {
  '.pdf': 'pdf',
  '.doc': 'doc',
  '.docx': 'docx',
  '.zip': 'zip',
  '.rar': 'rar'
};

/** Normalise a browser supplied name without ever using it as a path. */
const cleanOriginalName = (originalName) =>
  String(originalName || '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/]+/g, '-')
    .slice(0, 255);

export const sniffKind = (buffer) => {
  if (!buffer || buffer.length < 4) return 'unknown';

  const startsWith = (bytes) => bytes.every((byte, index) => buffer[index] === byte);

  if (startsWith([0x25, 0x50, 0x44, 0x46])) return 'pdf'; // %PDF
  if (startsWith([0x50, 0x4b, 0x03, 0x04]) || startsWith([0x50, 0x4b, 0x05, 0x06])) {
    // A DOCX is a ZIP container that holds WordprocessingML parts.
    if (buffer.includes(Buffer.from('word/')) || buffer.includes(Buffer.from('[Content_Types].xml'))) {
      return 'docx';
    }
    return 'zip';
  }
  if (startsWith([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07])) return 'rar';
  if (startsWith([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return 'doc';
  if (startsWith([0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP') {
    return 'webp';
  }
  if (startsWith([0x4d, 0x5a])) return 'executable'; // MZ
  if (startsWith([0x7f, 0x45, 0x4c, 0x46])) return 'executable'; // ELF
  if (startsWith([0x7b, 0x5c, 0x72, 0x74])) return 'executable'; // RTF-ish script container
  return 'unknown';
};

export const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  if (bytes < KB) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / KB).toFixed(1)} KB`;
  return `${(bytes / MB).toFixed(1)} MB`;
};

/**
 * Validate the metadata declared before a direct (presigned) upload. No bytes
 * are available yet, so only the name, size and declared MIME type are checked;
 * `validateFileBytes` still verifies the real content when the upload lands.
 *
 * @returns {{ok: boolean, error?: string, meta?: object}}
 */
export const validateUploadMetadata = (input, purpose) => {
  const rule = FILE_RULES[purpose];
  if (!rule) {
    return { ok: false, error: `Unknown upload purpose: ${purpose}` };
  }

  const originalName = String(input?.originalName || '');
  if (!originalName) {
    return { ok: false, error: `${rule.label}: a file name is required` };
  }
  if (originalName.includes('\u0000') || /[\\/]/.test(originalName)) {
    return { ok: false, error: `${rule.label}: invalid file name` };
  }

  const extension = path.extname(originalName).toLowerCase();
  if (!rule.extensions.includes(extension)) {
    return {
      ok: false,
      error: `${rule.label} must be one of: ${rule.extensions.join(', ')}`
    };
  }

  const size = Number(input?.size);
  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, error: `${rule.label}: the uploaded file is empty` };
  }

  if (size > rule.maxSize) {
    return {
      ok: false,
      error: `${rule.label} is too large (max ${formatBytes(rule.maxSize)})`
    };
  }

  const declaredMime = String(input?.mimeType || '').toLowerCase();
  if (declaredMime && !rule.mimeTypes.includes(declaredMime)) {
    return {
      ok: false,
      error: `${rule.label}: unsupported content type (${declaredMime})`
    };
  }

  return {
    ok: true,
    meta: {
      extension,
      mimeType: declaredMime || 'application/octet-stream',
      fileType: FILE_TYPES_BY_EXTENSION[extension] || extension.replace('.', ''),
      originalName: cleanOriginalName(originalName),
      size
    }
  };
};

/**
 * Verify that a (possibly partial, header-sized) buffer really looks like the
 * declared extension. Used on finalize of a direct upload.
 */
export const validateFileBytes = (buffer, meta, purpose) => {
  const rule = FILE_RULES[purpose];
  if (!rule) {
    return { ok: false, error: `Unknown upload purpose: ${purpose}` };
  }
  if (!buffer || buffer.length < 4) {
    return { ok: false, error: `${rule.label}: the uploaded file is empty` };
  }

  const kind = sniffKind(buffer);
  if (kind === 'executable') {
    return { ok: false, error: `${rule.label}: executable files are not allowed` };
  }

  const allowedKinds = EXTENSION_KINDS[meta?.extension] || [];
  if (!allowedKinds.includes(kind)) {
    return {
      ok: false,
      error: `${rule.label}: the file content does not match a ${meta?.extension || 'declared'} file`
    };
  }

  return {
    ok: true,
    meta: {
      ...meta,
      kind,
      mimeType: DETECTED_MIME[kind] || meta?.mimeType || 'application/octet-stream',
      fileType: FILE_TYPES[kind] || meta?.fileType
    }
  };
};

/**
 * Validate an uploaded file for a purpose.
 * @returns {{ok: boolean, error?: string, meta?: object}}
 */
export const validateUploadedFile = (file, purpose) => {
  const rule = FILE_RULES[purpose];
  if (!rule) {
    return { ok: false, error: `Unknown upload purpose: ${purpose}` };
  }
  if (!file || !file.buffer) {
    return { ok: false, error: `${rule.label} is required` };
  }

  const metadata = validateUploadMetadata(
    {
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size
    },
    purpose
  );
  if (!metadata.ok) return metadata;

  const bytes = validateFileBytes(file.buffer, metadata.meta, purpose);
  if (!bytes.ok) return bytes;

  return {
    ok: true,
    meta: {
      ...metadata.meta,
      kind: bytes.meta.kind,
      mimeType: bytes.meta.mimeType,
      fileType: bytes.meta.fileType
    }
  };
};
