import path from 'path';
import { readBuffer } from '../services/storageService.js';

/**
 * Public thumbnails and avatars.
 *
 * These assets used to be written to `uploads/` and served by express.static.
 * Vercel ignores express.static and the deployment filesystem is read-only, so
 * they now live in the configured storage provider (local disk in development,
 * R2/S3 in production) and are streamed through this route.
 *
 * The URL shape is unchanged (`/uploads/thumbnails/<file>`), so the frontend
 * needs no changes.
 */

const MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif'
};

const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;

const isMissing = (error) =>
  error?.code === 'ENOENT' ||
  error?.name === 'NoSuchKey' ||
  error?.name === 'NotFound' ||
  error?.$metadata?.httpStatusCode === 404 ||
  error?.cause?.$metadata?.httpStatusCode === 404;

export const servePublicAsset = (folder) => async (req, res) => {
  const fileName = path.basename(String(req.params.file || ''));

  if (!SAFE_NAME.test(fileName) || fileName.includes('..')) {
    return res.status(404).json({ message: 'File not found' });
  }

  try {
    const buffer = await readBuffer(`${folder}/${fileName}`);

    res.setHeader(
      'Content-Type',
      MIME_TYPES[path.extname(fileName).toLowerCase()] || 'application/octet-stream'
    );
    // Names include a timestamp + random suffix, so they never change.
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.send(buffer);
  } catch (error) {
    if (isMissing(error)) {
      return res.status(404).json({ message: 'File not found' });
    }
    console.error(`Public asset ${folder}/${fileName} failed:`, error.message);
    return res.status(500).json({ message: 'Unable to load file' });
  }
};

export default { servePublicAsset };
