import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import Sequelize from 'sequelize';
import dotenv from 'dotenv';
import sequelize from './database.js';
import '../models/index.js';
import Project from '../models/Project.js';
import ProjectDocumentFile from '../models/ProjectDocumentFile.js';

dotenv.config();

/**
 * Migration: documentation + optional software resources.
 *
 * Adds, without dropping or recreating any table:
 *  - project lifecycle statuses (draft / pending_review / published / archived)
 *    while preserving existing rows (active -> published, inactive -> archived)
 *  - software metadata columns on `projects`
 *  - file metadata columns on `project_document_files` (storage key, type,
 *    size, checksum, upload status, current/superseded state)
 *  - one metadata row per legacy documentation/software file so every download
 *    can be authorised through the API
 *
 * Safe to run more than once.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '../..');
const uploadsRoot = path.resolve(backendRoot, process.env.UPLOAD_DIR || 'uploads');

const MIME_BY_TYPE = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  zip: 'application/zip',
  rar: 'application/vnd.rar'
};

const log = (message) => console.log(message);

const columnType = async (table, column) => {
  const [rows] = await sequelize.query(`SHOW COLUMNS FROM \`${table}\` LIKE '${column}'`);
  return rows[0]?.Type || null;
};

const hasColumn = async (table, column) => Boolean(await columnType(table, column));

const addColumnIfMissing = async (table, column, definition) => {
  if (await hasColumn(table, column)) {
    log(`   ⊘ ${table}.${column} already exists`);
    return;
  }
  await sequelize.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  log(`   ✓ added ${table}.${column}`);
};

const indexExists = async (table, indexName) => {
  const [rows] = await sequelize.query(`SHOW INDEX FROM \`${table}\` WHERE Key_name = '${indexName}'`);
  return rows.length > 0;
};

const indexExistsForColumn = async (table, column) => {
  const [rows] = await sequelize.query(`SHOW INDEX FROM \`${table}\` WHERE Column_name = '${column}'`);
  return rows.map((row) => row.Key_name);
};

const relativeKey = (absolutePath) =>
  path.relative(uploadsRoot, absolutePath).replace(/\\/g, '/');

const findLegacyFile = (projectId, fileName, category) => {
  if (!fileName) return null;
  const baseName = path.basename(fileName);
  const candidates = [
    `uploads/${category}/${baseName}`,
    `uploads/projects/${projectId}/documents/${baseName}`,
    `uploads/${baseName}`,
    `private/${category}/${projectId}/${baseName}`
  ];

  for (const candidate of candidates) {
    const absolute = path.resolve(backendRoot, candidate);
    if (fs.existsSync(absolute)) {
      return { key: relativeKey(absolute), absolute };
    }
  }
  return null;
};

const fileMetadata = (absolutePath, fileType) => {
  if (!absolutePath || !fs.existsSync(absolutePath)) {
    return { fileSize: null, checksum: null };
  }
  const buffer = fs.readFileSync(absolutePath);
  return {
    fileSize: buffer.length,
    checksum: crypto.createHash('sha256').update(buffer).digest('hex')
  };
};

async function extendProjectStatus() {
  const type = await columnType('projects', 'status');
  if (type && type.includes("'published'")) {
    log('   ⊘ projects.status already supports lifecycle states');
  } else {
    log('   → migrating statuses (active -> published, inactive -> archived)');
    // Widen the enum first so both the old and new values are valid, otherwise
    // MySQL truncates the new value before the data migration can run.
    await sequelize.query(
      "ALTER TABLE `projects` MODIFY COLUMN `status` ENUM('active','inactive','draft','pending_review','published','archived') NULL DEFAULT 'draft'"
    );
    await sequelize.query("UPDATE `projects` SET `status` = 'published' WHERE `status` = 'active'");
    await sequelize.query("UPDATE `projects` SET `status` = 'archived' WHERE `status` = 'inactive'");
    await sequelize.query("UPDATE `projects` SET `status` = 'draft' WHERE `status` IS NULL OR `status` = ''");
    await sequelize.query(
      "ALTER TABLE `projects` MODIFY COLUMN `status` ENUM('draft','pending_review','published','archived') NOT NULL DEFAULT 'draft'"
    );
    log('   ✓ projects.status migrated');
  }
}

async function backfillSoftware() {
  const [rows] = await sequelize.query(`
    SELECT id, title, softwareFile, softwarePrice, fullProjectPrice, projectType, softwareStatus,
           softwareName, softwareSaleMode
    FROM projects
    WHERE softwareFile IS NOT NULL OR softwarePrice > 0 OR fullProjectPrice > 0
  `);

  let updated = 0;
  for (const row of rows) {
    const hasSoftware = Boolean(row.softwareFile) || Number(row.softwarePrice) > 0 || Number(row.fullProjectPrice) > 0;
    if (!hasSoftware) continue;

    await Project.update(
      {
        projectType: 'software',
        softwareStatus: row.softwareStatus || 'active',
        softwareName: row.softwareName || `${row.title} Software`,
        softwareSaleMode: row.softwareSaleMode || (Number(row.softwarePrice) > 0 ? 'separate' : 'included')
      },
      { where: { id: row.id } }
    );
    updated += 1;
  }

  await sequelize.query("UPDATE `projects` SET `projectType` = 'documentation' WHERE `projectType` IS NULL");

  // Permission was never recorded for imported software. Defaulting to "not
  // permitted" is the safe reading and keeps those records editable.
  const [permissionResult] = await sequelize.query(
    "UPDATE `projects` SET `softwareRedistributionAllowed` = 0 WHERE `softwareStatus` = 'active' AND `softwareRedistributionAllowed` IS NULL"
  );
  log(`   ✓ redistribution permission defaulted for ${permissionResult.affectedRows || 0} software project(s)`);
  log(`   ✓ software metadata backfilled for ${updated} project(s)`);
}

async function backfillLegacyFiles() {
  const projects = await Project.findAll({ attributes: ['id', 'title', 'documentationFile', 'softwareFile'] });
  let created = 0;
  let enriched = 0;

  for (const project of projects) {
    const legacy = [
      { fileName: project.documentationFile, category: 'documentation' },
      { fileName: project.softwareFile, category: 'software' }
    ].filter((entry) => entry.fileName);

    for (const entry of legacy) {
      const baseName = path.basename(entry.fileName);
      const existing = await ProjectDocumentFile.findOne({
        where: { projectId: project.id, category: entry.category, fileName: baseName }
      });
      if (existing) continue;

      const found = findLegacyFile(project.id, baseName, entry.category);
      const extension = path.extname(baseName).replace('.', '').toLowerCase();
      const fileType = ['pdf', 'doc', 'docx', 'zip', 'rar'].includes(extension)
        ? extension
        : entry.category === 'software'
          ? 'zip'
          : 'pdf';
      const meta = fileMetadata(found?.absolute, fileType);

      await ProjectDocumentFile.create({
        projectId: project.id,
        fileName: baseName,
        originalName: baseName,
        category: entry.category,
        fileType,
        filePath: found?.key ? `uploads/${found.key}` : `uploads/${entry.category}/${baseName}`,
        storageKey: found?.key || `${entry.category}/${baseName}`,
        storageProvider: 'local',
        mimeType: MIME_BY_TYPE[fileType],
        fileSize: meta.fileSize,
        checksum: meta.checksum,
        uploadStatus: 'completed',
        isCurrent: true,
        createdBy: null
      });
      created += 1;
    }
  }

  // Enrich metadata for rows that predate the storage columns.
  const [rows] = await sequelize.query(`
    SELECT id, filePath, storageKey, fileType, fileSize, mimeType, checksum, originalName
    FROM project_document_files
  `);

  for (const row of rows) {
    const storageKey = row.storageKey || (row.filePath ? row.filePath.replace(/^uploads\//, '') : null);
    if (!storageKey) continue;

    const absolute = row.filePath
      ? path.resolve(backendRoot, row.filePath)
      : path.resolve(uploadsRoot, storageKey);
    const meta = fileMetadata(absolute, row.fileType);
    const updates = {};

    if (!row.storageKey) updates.storageKey = storageKey;
    if (!row.originalName) updates.originalName = path.basename(storageKey);
    if (!row.mimeType) updates.mimeType = MIME_BY_TYPE[row.fileType] || null;
    if (!row.fileSize && meta.fileSize) updates.fileSize = meta.fileSize;
    if (!row.checksum && meta.checksum) updates.checksum = meta.checksum;

    if (Object.keys(updates).length > 0) {
      await ProjectDocumentFile.update(updates, { where: { id: row.id } });
      enriched += 1;
    }
  }

  log(`   ✓ created ${created} legacy file record(s), enriched ${enriched} existing record(s)`);
}

async function migrate() {
  try {
    await sequelize.authenticate();
    log('✓ Database connection established.');

    // ---- projects ---------------------------------------------------------
    log('\n1. projects table');
    await addColumnIfMissing('projects', 'softwareName', 'VARCHAR(255) NULL AFTER `institution`');
    await addColumnIfMissing('projects', 'softwareVersion', 'VARCHAR(64) NULL AFTER `softwareName`');
    await addColumnIfMissing('projects', 'softwareDescription', 'TEXT NULL AFTER `softwareVersion`');
    await addColumnIfMissing('projects', 'softwareOperatingSystem', 'TEXT NULL AFTER `softwareDescription`');
    await addColumnIfMissing('projects', 'softwareRequirements', 'TEXT NULL AFTER `softwareOperatingSystem`');
    await addColumnIfMissing('projects', 'softwareLicense', 'TEXT NULL AFTER `softwareRequirements`');
    await addColumnIfMissing('projects', 'softwareRedistributionAllowed', 'TINYINT(1) NULL AFTER `softwareLicense`');
    await addColumnIfMissing(
      'projects',
      'softwareSaleMode',
      "ENUM('included','separate') NULL AFTER `softwareRedistributionAllowed`"
    );
    await addColumnIfMissing(
      'projects',
      'softwareStatus',
      "ENUM('active','archived') NULL AFTER `softwareSaleMode`"
    );
    await extendProjectStatus();

    // ---- project_document_files ------------------------------------------
    log('\n2. project_document_files table');
    await addColumnIfMissing(
      'project_document_files',
      'category',
      "ENUM('documentation','software','guide') NOT NULL DEFAULT 'documentation' AFTER `projectId`"
    );
    await addColumnIfMissing('project_document_files', 'originalName', 'VARCHAR(255) NULL AFTER `fileName`');
    await addColumnIfMissing('project_document_files', 'storageKey', 'VARCHAR(500) NULL AFTER `filePath`');
    await addColumnIfMissing(
      'project_document_files',
      'storageProvider',
      "VARCHAR(32) NOT NULL DEFAULT 'local' AFTER `storageKey`"
    );
    await addColumnIfMissing('project_document_files', 'mimeType', 'VARCHAR(150) NULL AFTER `storageProvider`');
    await addColumnIfMissing('project_document_files', 'fileSize', 'BIGINT NULL AFTER `mimeType`');
    await addColumnIfMissing('project_document_files', 'checksum', 'VARCHAR(64) NULL AFTER `fileSize`');
    await addColumnIfMissing(
      'project_document_files',
      'uploadStatus',
      "ENUM('pending','completed','failed') NOT NULL DEFAULT 'completed' AFTER `checksum`"
    );
    await addColumnIfMissing(
      'project_document_files',
      'isCurrent',
      'TINYINT(1) NOT NULL DEFAULT 1 AFTER `uploadStatus`'
    );
    await addColumnIfMissing('project_document_files', 'supersededAt', 'DATETIME NULL AFTER `isCurrent`');
    await addColumnIfMissing('project_document_files', 'archivedAt', 'DATETIME NULL AFTER `supersededAt`');

    const fileType = await columnType('project_document_files', 'fileType');
    if (fileType && (!fileType.includes("'zip'") || !fileType.includes("'doc'"))) {
      await sequelize.query(
        "ALTER TABLE `project_document_files` MODIFY COLUMN `fileType` ENUM('pdf','doc','docx','zip','rar') NOT NULL"
      );
      log('   ✓ fileType enum extended for software installers');
    } else {
      log('   ⊘ fileType enum already supports archives');
    }

    // ---- indexes ----------------------------------------------------------
    if (!(await indexExists('project_document_files', 'idx_project_files_lookup'))) {
      await sequelize.query(
        'CREATE INDEX `idx_project_files_lookup` ON `project_document_files` (`projectId`, `category`, `isCurrent`)'
      );
      log('   ✓ index idx_project_files_lookup created');
    } else {
      log('   ⊘ index idx_project_files_lookup already exists');
    }
    if (!(await indexExists('project_document_files', 'idx_project_files_storage_key'))) {
      await sequelize.query(
        'CREATE INDEX `idx_project_files_storage_key` ON `project_document_files` (`storageKey`)'
      );
      log('   ✓ index idx_project_files_storage_key created');
    } else {
      log('   ⊘ index idx_project_files_storage_key already exists');
    }

    // ---- data -------------------------------------------------------------
    log('\n3. data migration');
    await backfillSoftware();
    await backfillLegacyFiles();

    // ---- verification -----------------------------------------------------
    const [[projects]] = await sequelize.query(`
      SELECT
        COUNT(*) AS total,
        SUM(status = 'published') AS published,
        SUM(status = 'draft') AS draft,
        SUM(status = 'archived') AS archived,
        SUM(softwareStatus = 'active') AS with_software
      FROM projects
    `);
    const [[files]] = await sequelize.query(`
      SELECT COUNT(*) AS total,
             SUM(category = 'software') AS software_files,
             SUM(isCurrent = 1) AS current_files
      FROM project_document_files
    `);

    log('\n📊 Result');
    log(`   projects: ${projects.total} (published ${projects.published || 0}, draft ${projects.draft || 0}, archived ${projects.archived || 0})`);
    log(`   projects with active software: ${projects.with_software || 0}`);
    log(`   project files: ${files.total} (current ${files.current_files || 0}, software ${files.software_files || 0})`);
    log('\n✅ Migration completed successfully.');

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    await sequelize.close().catch(() => {});
    process.exit(1);
  }
}

migrate();
