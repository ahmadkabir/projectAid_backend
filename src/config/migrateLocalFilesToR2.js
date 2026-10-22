import 'dotenv/config';
import fsp from 'fs/promises';
import sequelize from './database.js';
import '../models/index.js';
import ProjectDocumentFile from '../models/ProjectDocumentFile.js';
import {
  getStorageProvider,
  isStorageConfigured,
  localPathForKey,
  saveBuffer,
  readBuffer,
  statObject,
  checksumOf,
  __private as storagePrivate
} from '../services/storageService.js';

const { normalizeLocalKey } = storagePrivate;

/**
 * Migration: copy locally stored project files into the configured R2 bucket.
 *
 * Invariants:
 *  - Local files are NEVER deleted. They stay as a rollback copy.
 *  - An object is only recorded after it has been read back from R2 and its
 *    size (and, by default, its SHA-256) matches the local source.
 *  - Same storage key is reused, so existing FileDocument/filePath references
 *    and legacy rows keep working.
 *  - Safe to re-run: rows already on s3 are skipped.
 *
 * Usage:
 *   node src/config/migrateLocalFilesToR2.js --dry-run
 *   node src/config/migrateLocalFilesToR2.js --limit=50
 *   node src/config/migrateLocalFilesToR2.js --no-verify
 */

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const VERIFY = !args.has('--no-verify');
const LIMIT = (() => {
  const raw = process.argv.find((arg) => arg.startsWith('--limit='));
  const value = raw ? Number(raw.split('=')[1]) : NaN;
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
})();

const log = (...parts) => console.log(...parts);

async function main() {
  const provider = getStorageProvider();
  log(`Storage provider: ${provider}`);

  if (provider !== 's3') {
    log('Nothing to do: set STORAGE_PROVIDER=s3 (or configure R2_* variables) first.');
    process.exitCode = 1;
    return;
  }
  if (!isStorageConfigured()) {
    log('Object storage is not configured. Fill in the R2_* / STORAGE_S3_* variables.');
    process.exitCode = 1;
    return;
  }
  if (DRY_RUN) log('DRY RUN — no objects or rows will be modified.');

  await sequelize.authenticate();
  log('Database connected.');

  const options = {
    order: [['id', 'ASC']]
  };
  if (LIMIT) options.limit = LIMIT;

  const files = await ProjectDocumentFile.findAll(options);
  log(`Found ${files.length} file record(s).\n`);

  const summary = { migrated: 0, alreadyMigrated: 0, missingLocal: 0, skipped: 0, failed: 0 };

  for (const file of files) {
    const label = `#${file.id} ${file.category} ${file.originalName || file.fileName}`;

    if (file.storageProvider === 's3' && file.storageKey) {
      const head = await statObject(file.storageKey).catch(() => null);
      if (head?.exists) {
        summary.alreadyMigrated += 1;
        log(`skip   ${label} — already in R2`);
        continue;
      }
      log(`warn   ${label} — marked s3 but object is missing; re-uploading local copy`);
    }

    const key = normalizeLocalKey(file.storageKey || file.filePath);
    if (!key) {
      summary.skipped += 1;
      log(`skip   ${label} — no storage key`);
      continue;
    }

    let buffer;
    try {
      buffer = await fsp.readFile(localPathForKey(key));
    } catch {
      summary.missingLocal += 1;
      log(`skip   ${label} — local source not found (${key})`);
      continue;
    }

    if (DRY_RUN) {
      summary.migrated += 1;
      log(`plan   ${label} — would upload ${buffer.length} bytes to ${key}`);
      continue;
    }

    try {
      await saveBuffer(key, buffer, { contentType: file.mimeType || undefined });

      if (VERIFY) {
        const head = await statObject(key);
        if (!head?.exists || Number(head.size) !== buffer.length) {
          throw new Error(`R2 size mismatch (local ${buffer.length}, remote ${head?.size ?? 'missing'})`);
        }
        const remote = await readBuffer(key);
        if (checksumOf(remote) !== checksumOf(buffer)) {
          throw new Error('R2 checksum mismatch after upload');
        }
      }

      await file.update({
        storageKey: key,
        storageProvider: 's3',
        filePath: file.filePath || `uploads/${key}`,
        fileSize: buffer.length,
        checksum: checksumOf(buffer)
      });

      summary.migrated += 1;
      log(`ok     ${label} — ${buffer.length} bytes${VERIFY ? ' (verified)' : ''}`);
    } catch (error) {
      summary.failed += 1;
      console.error(`fail   ${label} — ${error.message}`);
    }
  }

  log('\nSummary:');
  log(`  migrated:        ${summary.migrated}`);
  log(`  already in R2:   ${summary.alreadyMigrated}`);
  log(`  local missing:   ${summary.missingLocal}`);
  log(`  skipped:         ${summary.skipped}`);
  log(`  failed:          ${summary.failed}`);
  log('\nLocal files were kept. Delete them manually only after verifying downloads.');

  if (summary.failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close().catch(() => {});
  });
