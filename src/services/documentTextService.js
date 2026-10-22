import fsp from 'fs/promises';
import path from 'path';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { currentFileFor } from './projectFileService.js';
import { readBuffer, localPathForKey } from './storageService.js';

/**
 * Text extraction for documentation previews.
 *
 * The preview page renders plain text, so files uploaded as PDF/DOCX need to be
 * converted to text before the restricted sample can be built. Results are
 * cached in memory (keyed by the storage object) — uploads always produce a new
 * key, so a replaced document can never serve stale text.
 */

const MAX_CACHE_ENTRIES = 20;
const MIN_USABLE_TEXT_LENGTH = 80;

const textCache = new Map();

const cacheGet = (key) => {
  if (!textCache.has(key)) return null;
  const value = textCache.get(key);
  // Refresh recency so the map behaves like a small LRU.
  textCache.delete(key);
  textCache.set(key, value);
  return value;
};

const cacheSet = (key, value) => {
  textCache.set(key, value);
  while (textCache.size > MAX_CACHE_ENTRIES) {
    textCache.delete(textCache.keys().next().value);
  }
};

const normalizeText = (raw) =>
  String(raw || '')
    .replace(/\u0000/g, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const extractFromBuffer = async (buffer, fileName) => {
  const ext = path.extname(String(fileName || '')).toLowerCase();

  if (ext === '.pdf') {
    const parsed = await pdfParse(buffer);
    return parsed.text;
  }

  if (ext === '.docx') {
    const parsed = await mammoth.extractRawText({ buffer });
    return parsed.value;
  }

  // Legacy binary .doc files have no supported text extractor.
  return null;
};

/**
 * Read the current documentation file for a project. Returns
 * `{ key, fileName, buffer }` or null when no file exists.
 */
const readCurrentDocumentation = async (project, currentDocFile) => {
  if (currentDocFile?.storageKey) {
    return {
      key: `storage:${currentDocFile.storageKey}`,
      fileName: currentDocFile.originalName || currentDocFile.fileName,
      buffer: await readBuffer(currentDocFile.storageKey)
    };
  }

  if (currentDocFile?.filePath) {
    return {
      key: `path:${currentDocFile.filePath}`,
      fileName: currentDocFile.originalName || currentDocFile.fileName,
      buffer: await fsp.readFile(localPathForKey(currentDocFile.filePath))
    };
  }

  if (project.documentationFile) {
    const legacyKey = `documentation/${project.documentationFile}`;
    return {
      key: `path:${legacyKey}`,
      fileName: project.documentationFile,
      buffer: await fsp.readFile(localPathForKey(legacyKey))
    };
  }

  return null;
};

/**
 * Extract plain text from an in-memory PDF/DOCX buffer.
 * Returns normalised text, or null when the format is unsupported.
 */
export const extractPlainText = async (buffer, fileName) => {
  const raw = await extractFromBuffer(buffer, fileName);
  const text = normalizeText(raw);
  return text || null;
};

/**
 * Extract the documentation text for a project.
 * Resolves to `{ text, source }` or null when no usable text is available.
 */
export const extractProjectDocumentationText = async (project, options = {}) => {
  if (!project) return null;

  try {
    const currentDocFile = options.currentDocFile !== undefined
      ? options.currentDocFile
      : await currentFileFor(project.id, 'documentation');

    const source = await readCurrentDocumentation(project, currentDocFile);
    if (!source) return null;

    const cached = cacheGet(source.key);
    if (cached) return { text: cached, source: source.key };

    const raw = await extractFromBuffer(source.buffer, source.fileName);
    const text = normalizeText(raw);

    if (text.length < MIN_USABLE_TEXT_LENGTH) {
      return null;
    }

    cacheSet(source.key, text);
    return { text, source: source.key };
  } catch (error) {
    console.error(`Document text extraction failed for project ${project.id}:`, error.message);
    return null;
  }
};
