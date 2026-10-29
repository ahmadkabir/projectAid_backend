import '../config/env.js';
import fs from 'fs/promises';
import path from 'path';
import {
  uploadsRoot,
  saveBuffer,
  statObject,
  getStorageProvider,
  isStorageConfigured
} from '../services/storageService.js';

/**
 * Copy public thumbnails and avatars from the local `uploads/` folder to the
 * configured object store.
 *
 * On Vercel the deployment filesystem is read-only, so public images can no
 * longer be served from disk. Filenames do not change, which means no database
 * update is required: the API route keeps serving
 * `/uploads/thumbnails/<file>` and `/uploads/avatars/<file>`.
 *
 * Usage:
 *   npm run migrate:public-assets -- --dry-run
 *   npm run migrate:public-assets
 *   npm run migrate:public-assets -- --force   # re-upload existing objects
 */

const FOLDERS = ['thumbnails', 'avatars'];

const MIME_BY_EXTENSION = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif'
};

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const force = args.has('--force');

const run = async () => {
  if (getStorageProvider() !== 's3') {
    console.log('STORAGE_PROVIDER is not "s3"; there is nothing to migrate.');
    return;
  }
  if (!isStorageConfigured()) {
    throw new Error('Object storage is not fully configured (check the R2_* / STORAGE_S3_* variables).');
  }

  let uploaded = 0;
  let skipped = 0;

  for (const folder of FOLDERS) {
    const directory = path.join(uploadsRoot, folder);

    let entries = [];
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`[${folder}] no local folder, skipping.`);
        continue;
      }
      throw error;
    }

    for (const entry of entries) {
      if (!entry.isFile() || entry.name.startsWith('.')) continue;

      const key = `${folder}/${entry.name}`;
      const localPath = path.join(directory, entry.name);

      if (!force) {
        const existing = await statObject(key).catch(() => null);
        if (existing?.exists) {
          skipped += 1;
          continue;
        }
      }

      const buffer = await fs.readFile(localPath);
      const contentType = MIME_BY_EXTENSION[path.extname(entry.name).toLowerCase()] || 'application/octet-stream';

      if (dryRun) {
        console.log(`[dry-run] ${key} (${buffer.length} bytes)`);
        uploaded += 1;
        continue;
      }

      await saveBuffer(key, buffer, { contentType });
      uploaded += 1;
      console.log(`uploaded ${key} (${buffer.length} bytes)`);
    }
  }

  if (uploaded === 0 && skipped === 0) {
    console.log('No public assets found.');
  } else {
    console.log(`\nDone. Uploaded: ${uploaded}, already present: ${skipped}`);
  }
};

run().catch((error) => {
  console.error('Public asset migration failed:', error.message);
  process.exitCode = 1;
});
