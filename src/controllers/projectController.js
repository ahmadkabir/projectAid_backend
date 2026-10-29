import { validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { startDbTransaction } from '../config/mongo.js';
import {
  Project,
  ProjectCategory,
  Order,
  OrderItem,
  SupportRequest,
  ProjectDocument,
  ProjectDocumentFile,
  User
} from '../models/index.js';
import {
  storeProjectFile,
  listProjectFiles,
  serializeFile,
  cleanupUploadedObjects,
  UploadError,
  storePublicThumbnail,
  deletePublicThumbnail,
  currentFileFor
} from '../services/projectFileService.js';
import { validateUploadedFile } from '../services/fileValidation.js';
import {
  normalizeStatus,
  canTransition,
  validateProjectForStatus,
  getPurchaseOptions,
  hasActiveSoftware,
  saleModeOf,
  toNumber
} from '../services/projectService.js';
import { deleteObject, getStorageProvider } from '../services/storageService.js';
import { extractProjectDocumentationText } from '../services/documentTextService.js';
import { buildPdfFromText } from '../services/watermarkedPdfService.js';
import { createUploadTicket, finalizeUpload } from '../services/directUploadService.js';
import { streamBuffer } from '../utils/http.js';

const VALID_LEVELS = ['ND', 'HND', 'BSc', 'MSc'];

const parseBoolean = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'boolean') return value;
  const normalised = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalised)) return true;
  if (['false', '0', 'no', 'off'].includes(normalised)) return false;
  return null;
};

const hasField = (body, field) => Object.prototype.hasOwnProperty.call(body, field);

const firstFile = (files, names) => {
  for (const name of names) {
    if (files?.[name]?.[0]) return files[name][0];
  }
  return null;
};

const DOCUMENTATION_FIELDS = ['documentationFile', 'documentation'];
const SOFTWARE_FIELDS = ['softwareInstaller', 'softwareFile', 'software'];
const GUIDE_FIELDS = ['softwareGuide', 'userGuide', 'guide'];

const uploadedFileNames = (files) => ({
  documentation: firstFile(files, DOCUMENTATION_FIELDS),
  software: firstFile(files, SOFTWARE_FIELDS),
  guide: firstFile(files, GUIDE_FIELDS),
  thumbnail: firstFile(files, ['thumbnail'])
});

const assertUpload = (file, purpose) => {
  if (!file) return null;
  const result = validateUploadedFile(file, purpose);
  if (!result.ok) throw new UploadError(result.error);
  return result.meta;
};

/**
 * Ensure a project has a usable documentation file. Falls back to the legacy
 * `documentationFile` column so projects created before the metadata table was
 * introduced keep working.
 */
const documentationAvailable = async (projectId, legacyFileName, options = {}) => {
  if (legacyFileName) return true;
  const file = await currentFileFor(projectId, 'documentation', options);
  return Boolean(file);
};

const softwareAvailable = async (projectId, legacyFileName, options = {}) => {
  if (legacyFileName) return true;
  const file = await currentFileFor(projectId, 'software', options);
  return Boolean(file);
};

/**
 * Shape a project for API responses. Preserves all existing fields and adds the
 * derived documentation/software information the UI needs.
 */
const serializeProject = (project, { includeSuperseded = false, includeStorage = false } = {}) => {
  if (!project) return null;

  const plain = project.toJSON ? project.toJSON() : { ...project };
  if (!plain.projectType) plain.projectType = 'documentation';

  const allFiles = (plain.documentFiles || []).map((file) => serializeFile(file, { includeStorage }));
  const currentFiles = allFiles.filter((file) => file.isCurrent);
  const files = includeSuperseded ? allFiles : currentFiles;

  const documentationFiles = currentFiles.filter((file) => file.category === 'documentation');
  const softwareFiles = currentFiles.filter((file) => file.category === 'software');
  const guideFiles = currentFiles.filter((file) => file.category === 'guide');

  const hasDocumentation = documentationFiles.length > 0 || Boolean(plain.documentationFile);
  const hasInstaller = softwareFiles.length > 0 || Boolean(plain.softwareFile);
  const softwareEnabled = hasActiveSoftware(plain);

  const result = {
    ...plain,
    documentFiles: files,
    files,
    documentationFiles,
    softwareFiles,
    guideFiles,
    hasDocumentation,
    hasInstaller,
    hasSoftware: softwareEnabled,
    softwareReady: hasInstaller,
    softwarePending: softwareEnabled && !hasInstaller,
    softwareSaleMode: saleModeOf(plain),
    purchaseOptions: getPurchaseOptions(plain, { hasDocumentationFile: hasDocumentation, hasInstaller }),
    isPublished: normalizeStatus(plain.status) === 'published'
  };

  delete result.documentFilesRaw;
  return result;
};

const fetchProjectWithFiles = async (id) => {
  const project = await Project.findByIdOrLegacy(id).populate('category');
  if (!project) return null;

  const projectDoc = project.toJSON ? project.toJSON() : { ...project };

  const files = await ProjectDocumentFile.find({
    $or: [
      { project: project._id },
      ...(project.legacyId ? [{ projectIdLegacy: project.legacyId }] : [])
    ]
  }).sort({ createdAt: -1 });

  projectDoc.documentFiles = files.map((f) => (f.toJSON ? f.toJSON() : f));
  return projectDoc;
};

const respondWithProject = async (res, projectId, statusCode, message, options = {}) => {
  const project = await fetchProjectWithFiles(projectId);
  return res.status(statusCode).json({
    ...(message ? { message } : {}),
    project: serializeProject(project, {
      includeSuperseded: options.includeSuperseded,
      includeStorage: options.includeStorage
    })
  });
};

const uploadErrorResponse = (res, error) => {
  if (error instanceof UploadError) {
    return res.status(error.status || 400).json({ message: error.message });
  }
  if (error?.name === 'MulterError') {
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? 'The uploaded file is larger than the allowed limit'
      : `Upload failed: ${error.message}`;
    return res.status(400).json({ message });
  }
  return null;
};

const resolveCourse = async (courseId) => {
  const course = await ProjectCategory.findByIdOrLegacy(courseId);
  return course || null;
};

/**
 * Build the canonical project fields from a request body.
 */
const applyProjectFields = (project, body, { creating = false } = {}) => {
  if (creating || hasField(body, 'title')) project.title = String(body.title || '').trim();
  if (creating || hasField(body, 'description')) project.description = String(body.description || '').trim();

  const courseId = body.course || body.categoryId;
  if (courseId !== undefined && courseId !== null && courseId !== '') {
    if (mongoose.Types.ObjectId.isValid(courseId)) {
      project.category = courseId;
    } else {
      project.categoryIdLegacy = parseInt(courseId, 10);
    }
  }

  if (creating || hasField(body, 'level')) project.level = body.level || null;
  if (creating || hasField(body, 'institution')) project.institution = body.institution || null;
  if (hasField(body, 'summary')) project.summary = body.summary || null;
  if (hasField(body, 'objective')) project.objective = body.objective || null;
  if (hasField(body, 'features')) project.features = body.features || null;

  const status = normalizeStatus(body.status);
  if (status) project.status = status;

  if (hasField(body, 'price') || hasField(body, 'documentationPrice') || creating) {
    const docPrice = toNumber(body.price ?? body.documentationPrice);
    project.price = docPrice;
    project.documentationPrice = docPrice;
  }

  const choice = parseBoolean(body.hasSoftware ?? body.softwareAvailable);

  if (choice === false || parseBoolean(body.removeSoftware) === true) {
    project.softwareStatus = 'archived';
  } else if (choice === true) {
    project.softwareStatus = 'active';
  }

  if (hasField(body, 'softwareName')) project.softwareName = body.softwareName || null;
  if (hasField(body, 'softwareVersion')) project.softwareVersion = body.softwareVersion || null;
  if (hasField(body, 'softwareDescription')) project.softwareDescription = body.softwareDescription || null;
  if (hasField(body, 'softwareOperatingSystem')) project.softwareOperatingSystem = body.softwareOperatingSystem || null;
  if (hasField(body, 'softwareRequirements')) project.softwareRequirements = body.softwareRequirements || null;
  if (hasField(body, 'softwareLicense')) project.softwareLicense = body.softwareLicense || null;

  if (hasField(body, 'softwareRedistributionAllowed')) {
    project.softwareRedistributionAllowed = parseBoolean(body.softwareRedistributionAllowed);
  }

  if (hasField(body, 'softwareSaleMode')) {
    project.softwareSaleMode = body.softwareSaleMode === 'separate' ? 'separate' : 'included';
  }

  return project;
};

/** Keep derived columns consistent after every mutation. */
const syncDerivedFields = (project, body = {}) => {
  const enabled = hasActiveSoftware(project);
  const mode = enabled ? saleModeOf(project) : null;

  project.projectType = enabled ? 'software' : 'documentation';

  if (enabled) {
    if (!project.softwareStatus) project.softwareStatus = 'active';
    if (!project.softwareSaleMode && mode) project.softwareSaleMode = mode;
    if (!project.softwareName) project.softwareName = `${project.title} Software`;
  }

  if (mode !== 'separate') {
    if (hasActiveSoftware(project)) project.softwarePrice = 0;
    project.fullProjectPrice = 0;
  } else {
    if (hasField(body, 'softwarePrice')) project.softwarePrice = toNumber(body.softwarePrice);
    if (hasField(body, 'fullProjectPrice')) project.fullProjectPrice = toNumber(body.fullProjectPrice);
    project.softwarePrice = toNumber(project.softwarePrice);
    project.fullProjectPrice = toNumber(project.fullProjectPrice);
  }

  project.price = toNumber(project.documentationPrice ?? project.price);
  project.documentationPrice = project.price;
  if (project.status === null || project.status === undefined) project.status = 'draft';
};

const validateForStatus = async (project, status, { session, hasDocumentationFile, hasInstaller } = {}) => {
  const data = project.toJSON ? project.toJSON() : project;
  const docAvailable = hasDocumentationFile ?? await documentationAvailable(project.id, data.documentationFile, { session });
  const installerAvailable = hasInstaller ?? await softwareAvailable(project.id, data.softwareFile, { session });

  return validateProjectForStatus({
    data: { ...data, documentationPrice: toNumber(data.documentationPrice ?? data.price) },
    status,
    hasDocumentationFile: docAvailable,
    hasInstaller: installerAvailable,
    softwareEnabled: hasActiveSoftware(data)
  });
};

export const getAllProjects = async (req, res) => {
  try {
    const {
      category,
      search = '',
      status = 'all',
      type,
      projectType,
      startDate,
      endDate,
      page,
      limit
    } = req.query;

    const isAdmin = req.user?.role === 'admin';
    const query = {};
    const requestedStatus = normalizeStatus(status);

    if (isAdmin && status === 'all') {
      query.status = { $ne: 'archived' };
    } else if (isAdmin && requestedStatus) {
      query.status = requestedStatus;
    } else {
      query.status = { $in: ['published', 'active'] };
    }

    if (category && category !== 'all') {
      if (mongoose.Types.ObjectId.isValid(category)) {
        query.category = category;
      } else if (!Number.isNaN(Number(category))) {
        query.$or = [{ categoryIdLegacy: Number(category) }, { category: category }];
      } else {
        query.category = category;
      }
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const requestedType = (type || projectType)?.toLowerCase()?.trim();
    if (requestedType) {
      if (requestedType === 'documentation') {
        query.$and = query.$and || [];
        query.$and.push({
          $or: [
            { projectType: 'documentation' },
            { projectType: null },
            { softwareStatus: 'archived' }
          ]
        });
      } else if (requestedType === 'software') {
        query.softwareStatus = 'active';
      } else {
        return res.json({ success: true, projects: [], total: 0 });
      }
    }

    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const matchingCats = await ProjectCategory.find({ name: regex }).select('_id');
      const catIds = matchingCats.map((c) => c._id);

      const searchOr = [
        { title: regex },
        { description: regex },
        { category: { $in: catIds } }
      ];
      query.$and = query.$and || [];
      query.$and.push({ $or: searchOr });
    }

    const pageNumber = page ? parseInt(page, 10) : null;
    const pageSize = limit ? parseInt(limit, 10) : 10;
    const shouldPaginate = Number.isInteger(pageNumber) && pageNumber > 0;

    let projects;
    let total = 0;
    let pagination;

    if (shouldPaginate) {
      const skip = (pageNumber - 1) * pageSize;
      total = await Project.countDocuments(query);
      projects = await Project.find(query)
        .populate('category')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize);
      pagination = { page: pageNumber, pageSize, total };
    } else {
      projects = await Project.find(query)
        .populate('category')
        .sort({ createdAt: -1 });
      total = projects.length;
    }

    res.json({
      success: true,
      projects: projects.map((project) => serializeProject(project)),
      total,
      ...(pagination ? { pagination } : {})
    });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getProjectById = async (req, res) => {
  try {
    const isAdmin = req.user?.role === 'admin';
    const project = await fetchProjectWithFiles(req.params.id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (!isAdmin && normalizeStatus(project.status) !== 'published') {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.json({
      project: serializeProject(project, {
        includeSuperseded: isAdmin,
        includeStorage: isAdmin
      })
    });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const FREE_SAMPLE_LENGTH = 2200;
const MIN_SAMPLE_LENGTH = 400;
const SHORT_DOC_SAMPLE_RATIO = 0.55;
const MAX_LOCKED_SECTIONS = 30;

const SECTION_TITLE_PATTERNS = [
  /^\*\*(.+?)\*\*\s*$/,
  /^#{1,4}\s+(.+)$/,
  /^(CHAPTER\b.+)$/i
];

const buildSample = (content) => {
  if (content.length <= FREE_SAMPLE_LENGTH) {
    const limit = Math.max(MIN_SAMPLE_LENGTH, Math.floor(content.length * SHORT_DOC_SAMPLE_RATIO));
    if (content.length <= limit) {
      return { sample: content, sampleEnd: content.length };
    }

    const window = content.slice(0, limit);
    const lastBreak = window.lastIndexOf('\n\n');
    const cut = lastBreak > MIN_SAMPLE_LENGTH / 2 ? lastBreak : limit;

    return { sample: window.slice(0, cut).trimEnd(), sampleEnd: cut };
  }

  const window = content.slice(0, FREE_SAMPLE_LENGTH);
  const lastBreak = window.lastIndexOf('\n\n');

  if (lastBreak < FREE_SAMPLE_LENGTH / 2) {
    return { sample: window.trimEnd(), sampleEnd: window.length };
  }

  return { sample: window.slice(0, lastBreak).trimEnd(), sampleEnd: lastBreak };
};

const buildLockedSections = (content, sampleEnd) => {
  const sections = [];
  const seen = new Set();

  for (const line of content.slice(sampleEnd).split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    for (const pattern of SECTION_TITLE_PATTERNS) {
      const match = trimmed.match(pattern);
      if (!match) continue;

      const title = match[1].replace(/\*/g, '').trim();
      if (title.length < 3 || title.length > 100) continue;
      if (seen.has(title)) continue;

      seen.add(title);
      sections.push(title);
      break;
    }

    if (sections.length >= MAX_LOCKED_SECTIONS) break;
  }

  return sections;
};

const resolveDocumentPreview = async (req) => {
  const project = await fetchProjectWithFiles(req.params.id);
  if (!project) {
    return { error: { status: 404, message: 'Project not found' } };
  }

  let userId = null;
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    try {
      userId = jwt.verify(token, process.env.JWT_SECRET).userId;
    } catch {
      userId = null;
    }
  }

  const user = userId ? await User.findByIdOrLegacy(userId) : null;
  const isAdmin = user?.role === 'admin';

  if (!isAdmin && normalizeStatus(project.status) !== 'published') {
    return { error: { status: 404, message: 'Project not found' } };
  }

  const wantsFull = String(req.query.full || '') === '1';
  let unlocked = isAdmin && wantsFull;

  if (userId && !unlocked) {
    const userFilters = [{ user: userId }];
    if (mongoose.Types.ObjectId.isValid(userId)) {
      userFilters.push({ user: new mongoose.Types.ObjectId(userId) });
    }

    const completedOrder = await Order.findOne({
      $or: userFilters,
      status: 'completed',
      items: {
        $elemMatch: {
          $or: [
            { project: project._id || project.id },
            ...(project.legacyId ? [{ projectIdLegacy: project.legacyId }] : [])
          ],
          itemType: { $in: ['documentation', 'full'] }
        }
      }
    });
    unlocked = Boolean(completedOrder);
  }

  let document = await ProjectDocument.findOne({
    $or: [
      { project: project._id || project.id },
      ...(project.legacyId ? [{ projectIdLegacy: project.legacyId }] : [])
    ]
  });

  if (!document) {
    const extracted = await extractProjectDocumentationText(project);
    if (extracted) document = { content: extracted.text };
  }

  return {
    project,
    user,
    isAdmin,
    unlocked,
    wantsFull,
    document,
    projectData: serializeProject(project)
  };
};

export const getDocumentPreview = async (req, res) => {
  try {
    const resolved = await resolveDocumentPreview(req);
    if (resolved.error) {
      return res.status(resolved.error.status).json({ message: resolved.error.message });
    }

    const { project, unlocked, document, projectData } = resolved;

    const payload = {
      project: {
        id: projectData.id,
        title: projectData.title,
        level: projectData.level,
        institution: projectData.institution,
        documentationPrice: projectData.documentationPrice,
        price: projectData.price,
        documentationFile: projectData.documentationFile,
        hasDocumentation: projectData.hasDocumentation,
        hasSoftware: projectData.hasSoftware,
        category: projectData.category
      },
      available: Boolean(document),
      unlocked,
      sample: '',
      lockedSections: []
    };

    if (!document?.content) {
      return res.json(payload);
    }

    const content = String(document.content);

    if (unlocked) {
      payload.sample = content;
      payload.lockedSections = [];
      return res.json(payload);
    }

    const { sample, sampleEnd } = buildSample(content);
    payload.sample = sample;
    payload.lockedSections = buildLockedSections(content, sampleEnd);

    return res.json(payload);
  } catch (error) {
    console.error('Document preview error:', error);
    return res.status(500).json({ message: 'Server error reading document preview' });
  }
};

export const getDocumentPreviewPdf = async (req, res) => {
  try {
    const resolved = await resolveDocumentPreview(req);
    if (resolved.error) {
      return res.status(resolved.error.status).json({ message: resolved.error.message });
    }

    const { project, user, isAdmin, unlocked, document } = resolved;

    if (!document?.content) {
      return res.status(404).json({ message: 'No document available to render' });
    }

    const content = String(document.content);
    let renderText = content;
    let watermarkText = 'ProjectAid Preview';

    if (unlocked) {
      const buyerName = user?.name || 'Authorized Buyer';
      const buyerEmail = user?.email || '';
      watermarkText = `ProjectAid | Licensed to ${buyerName} | ${buyerEmail}`.trim();
    } else {
      const { sample } = buildSample(content);
      const notice =
        '\n\n[ --- PREVIEW ENDS HERE --- Full document unlocked after purchase at ProjectAid --- ]';
      renderText = `${sample}${notice}`;
    }

    const dateStr = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    const pdfBuffer = await buildPdfFromText({
      title: project.title,
      text: renderText,
      watermark: watermarkText,
      footer: `ProjectAid - ${unlocked ? 'Purchased Documentation' : 'Sample Preview'} - ${dateStr}`
    });

    const baseName = (project.title || 'project')
      .replace(/[^\w\s-]+/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 80);
    const downloadName = `${baseName || 'project'}_preview.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${downloadName}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');

    // Stream so previews larger than Vercel's 4.5 MB buffered response cap are
    // delivered successfully.
    return streamBuffer(res, pdfBuffer);
  } catch (error) {
    console.error('Document preview PDF error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ message: 'Server error rendering preview PDF' });
    }
    return undefined;
  }
};

export const createProject = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  let transaction;
  const uploadedKeys = [];
  let thumbnailName = null;

  try {
    const body = req.body;
    const uploads = uploadedFileNames(req.files);

    assertUpload(uploads.documentation, 'documentation');
    assertUpload(uploads.software, 'software');
    assertUpload(uploads.guide, 'guide');
    assertUpload(uploads.thumbnail, 'thumbnail');

    if (hasField(body, 'level') && body.level && !VALID_LEVELS.includes(body.level)) {
      return res.status(400).json({ message: 'Invalid level. Must be ND, HND, BSc, or MSc' });
    }

    const courseId = body.course || body.categoryId;
    if (courseId) {
      const course = await resolveCourse(courseId);
      if (!course) return res.status(400).json({ message: 'Invalid course selected' });
    }

    const project = new Project();
    applyProjectFields(project, body, { creating: true });

    if (uploads.software || uploads.guide) {
      project.softwareStatus = 'active';
      if (!project.softwareSaleMode) project.softwareSaleMode = 'included';
    }

    syncDerivedFields(project, body);

    const validationErrors = validateProjectForStatus({
      data: { ...project.toJSON(), documentationPrice: project.documentationPrice },
      status: normalizeStatus(project.status) || 'draft',
      hasDocumentationFile: Boolean(uploads.documentation),
      hasInstaller: Boolean(uploads.software),
      softwareEnabled: hasActiveSoftware(project)
    });

    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: validationErrors[0],
        errors: validationErrors
      });
    }

    if (uploads.thumbnail) {
      thumbnailName = await storePublicThumbnail(uploads.thumbnail);
    }

    transaction = await startDbTransaction();

    await project.save({ session: transaction.session });

    if (uploads.documentation) {
      const record = await storeProjectFile({
        projectId: project._id || project.id,
        category: 'documentation',
        file: uploads.documentation,
        createdBy: req.user?.id,
        session: transaction.session
      });
      uploadedKeys.push(record.storageKey);
      project.documentationFile = record.fileName;
    }

    if (uploads.software) {
      const record = await storeProjectFile({
        projectId: project._id || project.id,
        category: 'software',
        file: uploads.software,
        createdBy: req.user?.id,
        session: transaction.session
      });
      uploadedKeys.push(record.storageKey);
      project.softwareFile = record.fileName;
    }

    if (uploads.guide) {
      const record = await storeProjectFile({
        projectId: project._id || project.id,
        category: 'guide',
        file: uploads.guide,
        createdBy: req.user?.id,
        session: transaction.session
      });
      uploadedKeys.push(record.storageKey);
    }

    if (thumbnailName) project.thumbnail = thumbnailName;

    await project.save({ session: transaction.session });
    await transaction.commit();
    transaction = null;

    return await respondWithProject(res, project._id || project.id, 201, 'Project created successfully', {
      includeSuperseded: true,
      includeStorage: true
    });
  } catch (error) {
    if (transaction) await transaction.rollback().catch(() => {});
    await cleanupUploadedObjects(uploadedKeys);
    if (thumbnailName) await deletePublicThumbnail(thumbnailName);

    const uploadResponse = uploadErrorResponse(res, error);
    if (uploadResponse) return uploadResponse;

    console.error('Create project error:', error);
    return res.status(500).json({ message: 'Server error creating project', error: error.message });
  }
};

export const updateProject = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  let transaction;
  const uploadedKeys = [];
  let thumbnailName = null;

  try {
    const project = await Project.findByIdOrLegacy(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const body = req.body;
    const uploads = uploadedFileNames(req.files);

    assertUpload(uploads.documentation, 'documentation');
    assertUpload(uploads.software, 'software');
    assertUpload(uploads.guide, 'guide');
    assertUpload(uploads.thumbnail, 'thumbnail');

    if (hasField(body, 'level') && body.level && !VALID_LEVELS.includes(body.level)) {
      return res.status(400).json({ message: 'Invalid level. Must be ND, HND, BSc, or MSc' });
    }

    const courseId = body.course || body.categoryId;
    if ((courseId || hasField(body, 'categoryId')) && courseId) {
      const course = await resolveCourse(courseId);
      if (!course) return res.status(400).json({ message: 'Invalid course selected' });
    }

    const requestedStatus = normalizeStatus(body.status);
    if (requestedStatus && requestedStatus !== normalizeStatus(project.status) && !canTransition(project.status, requestedStatus)) {
      return res.status(400).json({
        message: `Cannot move a project from ${project.status} to ${requestedStatus}`
      });
    }

    const previousThumbnail = project.thumbnail;

    applyProjectFields(project, body);

    if (uploads.software || uploads.guide) {
      project.softwareStatus = 'active';
      if (!project.softwareSaleMode) project.softwareSaleMode = 'included';
    }

    syncDerivedFields(project, body);

    const docWillExist = Boolean(uploads.documentation) || await documentationAvailable(project.id, project.documentationFile);
    const installerWillExist = Boolean(uploads.software) || await softwareAvailable(project.id, project.softwareFile);

    const statusChanged = requestedStatus && requestedStatus !== normalizeStatus(project.status);
    const publicationSensitive =
      statusChanged ||
      (requestedStatus === 'published' &&
        (hasField(body, 'hasSoftware') || Boolean(uploads.software) || Boolean(uploads.guide)));

    if (publicationSensitive) {
      const validationErrors = validateProjectForStatus({
        data: { ...project.toJSON(), documentationPrice: project.documentationPrice },
        status: normalizeStatus(project.status) || 'draft',
        hasDocumentationFile: docWillExist,
        hasInstaller: installerWillExist,
        softwareEnabled: hasActiveSoftware(project)
      });

      if (validationErrors.length > 0) {
        return res.status(400).json({ message: validationErrors[0], errors: validationErrors });
      }
    } else if (
      (hasField(body, 'price') || hasField(body, 'documentationPrice')) &&
      toNumber(project.documentationPrice) <= 0 &&
      !hasActiveSoftware(project)
    ) {
      return res.status(400).json({ message: 'Documentation price must be greater than 0' });
    }

    if (uploads.thumbnail) {
      thumbnailName = await storePublicThumbnail(uploads.thumbnail);
    }

    transaction = await startDbTransaction();

    if (uploads.documentation) {
      const record = await storeProjectFile({
        projectId: project._id || project.id,
        category: 'documentation',
        file: uploads.documentation,
        createdBy: req.user?.id,
        session: transaction.session
      });
      uploadedKeys.push(record.storageKey);
      project.documentationFile = record.fileName;
    }

    if (uploads.software) {
      const record = await storeProjectFile({
        projectId: project._id || project.id,
        category: 'software',
        file: uploads.software,
        createdBy: req.user?.id,
        session: transaction.session
      });
      uploadedKeys.push(record.storageKey);
      project.softwareFile = record.fileName;
    }

    if (uploads.guide) {
      const record = await storeProjectFile({
        projectId: project._id || project.id,
        category: 'guide',
        file: uploads.guide,
        createdBy: req.user?.id,
        session: transaction.session
      });
      uploadedKeys.push(record.storageKey);
    }

    if (thumbnailName) project.thumbnail = thumbnailName;

    await project.save({ session: transaction.session });
    await transaction.commit();
    transaction = null;

    if (thumbnailName && previousThumbnail) {
      await deletePublicThumbnail(previousThumbnail);
    }

    return await respondWithProject(res, project._id || project.id, 200, 'Project updated successfully', {
      includeSuperseded: true,
      includeStorage: true
    });
  } catch (error) {
    if (transaction) await transaction.rollback().catch(() => {});
    await cleanupUploadedObjects(uploadedKeys);
    if (thumbnailName) await deletePublicThumbnail(thumbnailName);

    const uploadResponse = uploadErrorResponse(res, error);
    if (uploadResponse) return uploadResponse;

    console.error('Update project error:', error);
    return res.status(500).json({ message: 'Server error updating project', error: error.message });
  }
};

export const updateProjectStatus = async (req, res) => {
  try {
    const requested = normalizeStatus(req.body.status);
    if (!requested) {
      return res.status(400).json({
        message: `Invalid status. Use one of: ${['draft', 'pending_review', 'published', 'archived'].join(', ')}`
      });
    }

    const project = await Project.findByIdOrLegacy(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (!canTransition(project.status, requested)) {
      return res.status(400).json({
        message: `Cannot move a project from ${project.status} to ${requested}`
      });
    }

    if (requested === 'pending_review' || requested === 'published') {
      const errorsForStatus = await validateForStatus(project, requested);
      if (errorsForStatus.length > 0) {
        return res.status(400).json({ message: errorsForStatus[0], errors: errorsForStatus });
      }
    }

    project.status = requested;
    await project.save();

    return await respondWithProject(res, project._id || project.id, 200, `Project ${requested.replace('_', ' ')}`, {
      includeSuperseded: true,
      includeStorage: true
    });
  } catch (error) {
    console.error('Update project status error:', error);
    return res.status(500).json({ message: 'Server error updating project status' });
  }
};

const DIRECT_UPLOAD_CATEGORIES = ['documentation', 'software', 'guide'];

export const presignProjectFileUpload = async (req, res) => {
  try {
    const project = await Project.findByIdOrLegacy(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const category = String(req.body.category || '').trim();
    if (!DIRECT_UPLOAD_CATEGORIES.includes(category)) {
      return res.status(400).json({ message: 'Invalid upload category' });
    }

    if (category !== 'documentation' && !hasActiveSoftware(project)) {
      return res.status(400).json({
        message: 'Enable software for this project before uploading an installer or guide'
      });
    }

    if (getStorageProvider() !== 's3') {
      return res.json({
        success: true,
        upload: { mode: 'multipart', category }
      });
    }

    const upload = await createUploadTicket({
      projectId: project.id,
      category,
      originalName: req.body.fileName || req.body.originalName,
      mimeType: req.body.mimeType,
      size: req.body.size ?? req.body.fileSize
    });

    return res.json({ success: true, upload: { ...upload, mode: 'direct' } });
  } catch (error) {
    const uploadResponse = uploadErrorResponse(res, error);
    if (uploadResponse) return uploadResponse;

    console.error('Presign upload error:', error);
    return res.status(500).json({ message: 'Server error preparing upload' });
  }
};

export const completeProjectFileUpload = async (req, res) => {
  let transaction;

  try {
    const project = await Project.findByIdOrLegacy(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const category = String(req.body.category || '').trim();
    if (!DIRECT_UPLOAD_CATEGORIES.includes(category)) {
      return res.status(400).json({ message: 'Invalid upload category' });
    }

    if (getStorageProvider() !== 's3') {
      return res.status(400).json({
        message: 'Direct uploads are not enabled. Use the multipart upload endpoint instead.'
      });
    }

    if (category !== 'documentation' && !hasActiveSoftware(project)) {
      return res.status(400).json({
        message: 'Enable software for this project before uploading an installer or guide'
      });
    }

    transaction = await startDbTransaction();

    const { record } = await finalizeUpload({
      projectId: project.id,
      category,
      storageKey: req.body.storageKey,
      originalName: req.body.fileName || req.body.originalName,
      mimeType: req.body.mimeType,
      size: req.body.size ?? req.body.fileSize,
      createdBy: req.user?.id,
      session: transaction.session
    });

    if (category === 'documentation') project.documentationFile = record.fileName;
    if (category === 'software') {
      project.softwareFile = record.fileName;
      project.softwareStatus = 'active';
      if (!project.softwareSaleMode) project.softwareSaleMode = 'included';
    }

    await project.save({ session: transaction.session });
    await transaction.commit();
    transaction = null;

    return res.status(201).json({
      message:
        category === 'documentation'
          ? 'Documentation uploaded successfully'
          : category === 'software'
            ? 'Software installer uploaded successfully'
            : 'User guide uploaded successfully',
      file: serializeFile(record, { includeStorage: true })
    });
  } catch (error) {
    if (transaction) await transaction.rollback().catch(() => {});

    const uploadResponse = uploadErrorResponse(res, error);
    if (uploadResponse) return uploadResponse;

    console.error('Complete upload error:', error);
    return res.status(500).json({ message: 'Server error completing upload' });
  }
};

export const uploadProjectDocumentation = async (req, res) => {
  let transaction;
  const uploadedKeys = [];

  try {
    const project = await Project.findByIdOrLegacy(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const file = firstFile(req.files, DOCUMENTATION_FIELDS);
    assertUpload(file, 'documentation');
    if (!file) return res.status(400).json({ message: 'Documentation file is required' });

    transaction = await startDbTransaction();
    const record = await storeProjectFile({
      projectId: project._id || project.id,
      category: 'documentation',
      file,
      createdBy: req.user?.id,
      session: transaction.session
    });
    uploadedKeys.push(record.storageKey);

    project.documentationFile = record.fileName;
    await project.save({ session: transaction.session });
    await transaction.commit();
    transaction = null;

    const saved = await ProjectDocumentFile.findById(record._id);
    return res.status(201).json({
      message: 'Documentation uploaded successfully',
      file: serializeFile(saved, { includeStorage: true })
    });
  } catch (error) {
    if (transaction) await transaction.rollback().catch(() => {});
    await cleanupUploadedObjects(uploadedKeys);

    const uploadResponse = uploadErrorResponse(res, error);
    if (uploadResponse) return uploadResponse;

    console.error('Upload documentation error:', error);
    return res.status(500).json({ message: 'Server error uploading documentation' });
  }
};

export const uploadProjectSoftware = async (req, res) => {
  let transaction;
  const uploadedKeys = [];

  try {
    const project = await Project.findByIdOrLegacy(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const body = req.body;
    const uploads = uploadedFileNames(req.files);

    assertUpload(uploads.software, 'software');
    assertUpload(uploads.guide, 'guide');

    const hasExistingInstaller = await softwareAvailable(project.id, project.softwareFile);
    if (!uploads.software && !hasExistingInstaller) {
      return res.status(400).json({ message: 'A software installer is required when adding software' });
    }

    applyProjectFields(project, { ...body, hasSoftware: true });
    project.softwareStatus = 'active';

    if (!project.softwareName || !String(project.softwareName).trim()) {
      return res.status(400).json({ message: 'Software name is required' });
    }

    if (!project.softwareSaleMode) project.softwareSaleMode = 'included';
    syncDerivedFields(project, body);

    if (project.softwareSaleMode === 'separate' && toNumber(project.softwarePrice) <= 0) {
      return res.status(400).json({ message: 'Software price must be greater than 0 when sold separately' });
    }

    transaction = await startDbTransaction();

    if (uploads.software) {
      const record = await storeProjectFile({
        projectId: project._id || project.id,
        category: 'software',
        file: uploads.software,
        createdBy: req.user?.id,
        session: transaction.session
      });
      uploadedKeys.push(record.storageKey);
      project.softwareFile = record.fileName;
    }

    if (uploads.guide) {
      const record = await storeProjectFile({
        projectId: project._id || project.id,
        category: 'guide',
        file: uploads.guide,
        createdBy: req.user?.id,
        session: transaction.session
      });
      uploadedKeys.push(record.storageKey);
    }

    await project.save({ session: transaction.session });
    await transaction.commit();
    transaction = null;

    return await respondWithProject(res, project._id || project.id, 200, 'Software details saved successfully', {
      includeSuperseded: true,
      includeStorage: true
    });
  } catch (error) {
    if (transaction) await transaction.rollback().catch(() => {});
    await cleanupUploadedObjects(uploadedKeys);

    const uploadResponse = uploadErrorResponse(res, error);
    if (uploadResponse) return uploadResponse;

    console.error('Upload software error:', error);
    return res.status(500).json({ message: 'Server error saving software' });
  }
};

export const archiveProjectSoftware = async (req, res) => {
  try {
    const project = await Project.findByIdOrLegacy(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (!hasActiveSoftware(project) && project.softwareStatus !== 'archived') {
      return res.status(400).json({ message: 'This project has no active software to archive' });
    }

    project.softwareStatus = 'archived';
    project.projectType = 'documentation';
    await project.save();

    return await respondWithProject(res, project._id || project.id, 200, 'Software archived successfully', {
      includeSuperseded: true,
      includeStorage: true
    });
  } catch (error) {
    console.error('Archive software error:', error);
    return res.status(500).json({ message: 'Server error archiving software' });
  }
};

export const getProjectFileList = async (req, res) => {
  try {
    const project = await Project.findByIdOrLegacy(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const includeSuperseded = req.query.includeSuperseded !== 'false';
    const files = await listProjectFiles(project._id || project.id, { includeSuperseded });

    res.json({
      success: true,
      files: files.map((file) => serializeFile(file, { includeStorage: true }))
    });
  } catch (error) {
    console.error('List project files error:', error);
    res.status(500).json({ message: 'Server error listing files' });
  }
};

export const deleteProject = async (req, res) => {
  try {
    const project = await Project.findByIdOrLegacy(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const targetProjectIds = [
      project._id,
      project.id,
      ...(project.legacyId ? [project.legacyId] : [])
    ];

    const [orderItemsCount, supportRequestsCount, files] = await Promise.all([
      Order.countDocuments({
        'items.project': { $in: targetProjectIds }
      }),
      SupportRequest.countDocuments({
        project: { $in: targetProjectIds }
      }),
      ProjectDocumentFile.find({
        $or: [
          { project: project._id },
          ...(project.legacyId ? [{ projectIdLegacy: project.legacyId }] : [])
        ]
      })
    ]);

    if (orderItemsCount > 0 || supportRequestsCount > 0) {
      return res.status(400).json({
        message: 'Cannot delete project. This project has associated orders or support requests. Archive it instead.',
        details: {
          orderItems: orderItemsCount,
          supportRequests: supportRequestsCount
        }
      });
    }

    const storageKeys = files.map((file) => file.storageKey).filter(Boolean);
    const thumbnail = project.thumbnail;

    await Promise.all([
      ProjectDocumentFile.deleteMany({
        $or: [
          { project: project._id },
          ...(project.legacyId ? [{ projectIdLegacy: project.legacyId }] : [])
        ]
      }),
      ProjectDocument.deleteMany({
        $or: [
          { project: project._id },
          ...(project.legacyId ? [{ projectIdLegacy: project.legacyId }] : [])
        ]
      }),
      Project.deleteOne({ _id: project._id })
    ]);

    await Promise.all(storageKeys.map((key) => deleteObject(key).catch(() => {})));
    if (thumbnail) await deletePublicThumbnail(thumbnail);

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ message: 'Server error deleting project', error: error.message });
  }
};

export const getAllCategories = async (req, res) => {
  try {
    const categories = await ProjectCategory.find().sort({ name: 1 });
    res.json({ categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createCategory = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description } = req.body;
    const category = await ProjectCategory.create({ name, description });

    res.status(201).json({ message: 'Category created successfully', category });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ message: 'Server error creating category' });
  }
};
