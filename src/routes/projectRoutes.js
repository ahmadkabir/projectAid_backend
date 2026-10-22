import express from 'express';
import { body } from 'express-validator';
import {
  getAllProjects,
  getProjectById,
  getDocumentPreview,
  getDocumentPreviewPdf,
  createProject,
  updateProject,
  updateProjectStatus,
  uploadProjectDocumentation,
  uploadProjectSoftware,
  archiveProjectSoftware,
  getProjectFileList,
  presignProjectFileUpload,
  completeProjectFileUpload,
  deleteProject,
  getAllCategories,
  createCategory
} from '../controllers/projectController.js';
import { authenticate, authorize, optionalAuthenticate } from '../middlewares/auth.js';
import { projectFileUpload } from '../utils/upload.js';

const router = express.Router();

const STATUS_VALUES = [
  'draft',
  'pending_review',
  'published',
  'archived',
  // Legacy values still accepted; normalised by the controller.
  'active',
  'inactive'
];

const uploadFields = projectFileUpload.fields([
  { name: 'documentation', maxCount: 1 },
  { name: 'documentationFile', maxCount: 1 },
  { name: 'softwareInstaller', maxCount: 1 },
  { name: 'software', maxCount: 1 },
  { name: 'softwareFile', maxCount: 1 },
  { name: 'softwareGuide', maxCount: 1 },
  { name: 'userGuide', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 }
]);

const documentationFields = projectFileUpload.fields([
  { name: 'documentation', maxCount: 1 },
  { name: 'documentationFile', maxCount: 1 }
]);

const softwareFields = projectFileUpload.fields([
  { name: 'softwareInstaller', maxCount: 1 },
  { name: 'software', maxCount: 1 },
  { name: 'softwareFile', maxCount: 1 },
  { name: 'softwareGuide', maxCount: 1 },
  { name: 'userGuide', maxCount: 1 }
]);

// Public routes. optionalAuthenticate lets administrators see their drafts in
// the same catalogue endpoint while visitors only ever get published rows.
router.get('/', optionalAuthenticate, getAllProjects);
router.get('/categories', getAllCategories);
router.get('/:id/document-preview', getDocumentPreview);
// Same content rendered as a watermarked PDF (page numbers in the footer).
router.get('/:id/document-preview.pdf', getDocumentPreviewPdf);

// Public route: the project page is viewable by visitors, but the controller
// only reveals published projects to non-admins (everything else 404s).
router.get('/:id', optionalAuthenticate, getProjectById);

// Admin routes
router.post(
  '/',
  authenticate,
  authorize('admin'),
  uploadFields,
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('course').optional().isInt().withMessage('Valid course ID is required'),
    body('categoryId').optional().isInt().withMessage('Valid category ID is required'),
    body('level').isIn(['ND', 'HND', 'BSc', 'MSc']).withMessage('Level must be ND, HND, BSc, or MSc'),
    body('institution').optional().trim().isLength({ max: 255 }).withMessage('Institution name must be less than 255 characters'),
    body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('documentationPrice').optional().isFloat({ min: 0 }),
    body('softwarePrice').optional().isFloat({ min: 0 }),
    body('fullProjectPrice').optional().isFloat({ min: 0 }),
    body('softwareSaleMode').optional().isIn(['included', 'separate']),
    body('status').optional().isIn(STATUS_VALUES)
  ],
  createProject
);

router.put(
  '/:id',
  authenticate,
  authorize('admin'),
  uploadFields,
  [
    body('title').optional().trim().notEmpty(),
    body('description').optional().trim().notEmpty(),
    body('categoryId').optional().isInt(),
    body('level').optional().isIn(['ND', 'HND', 'BSc', 'MSc']).withMessage('Level must be ND, HND, BSc, or MSc'),
    body('institution').optional().trim().isLength({ max: 255 }).withMessage('Institution name must be less than 255 characters'),
    body('documentationPrice').optional().isFloat({ min: 0 }),
    body('softwarePrice').optional().isFloat({ min: 0 }),
    body('fullProjectPrice').optional().isFloat({ min: 0 }),
    body('softwareSaleMode').optional().isIn(['included', 'separate']),
    body('status').optional().isIn(STATUS_VALUES)
  ],
  updateProject
);

router.patch(
  '/:id/status',
  authenticate,
  authorize('admin'),
  [
    body('status').notEmpty().isIn(STATUS_VALUES).withMessage('Invalid project status')
  ],
  updateProjectStatus
);

router.post(
  '/:id/documentation',
  authenticate,
  authorize('admin'),
  documentationFields,
  uploadProjectDocumentation
);

router.post(
  '/:id/software',
  authenticate,
  authorize('admin'),
  softwareFields,
  uploadProjectSoftware
);

router.delete('/:id/software', authenticate, authorize('admin'), archiveProjectSoftware);

// Direct-to-object-storage uploads (Cloudflare R2). Only metadata crosses the
// API; the file bytes go straight from the browser to R2 with a presigned URL.
router.post(
  '/:id/files/presign',
  authenticate,
  authorize('admin'),
  [
    body('category').isIn(['documentation', 'software', 'guide']).withMessage('Invalid upload category'),
    body('fileName').trim().notEmpty().withMessage('A file name is required'),
    body('size').isInt({ min: 1 }).withMessage('A valid file size is required'),
    body('mimeType').optional().isString()
  ],
  presignProjectFileUpload
);

router.post(
  '/:id/files/complete',
  authenticate,
  authorize('admin'),
  [
    body('category').isIn(['documentation', 'software', 'guide']).withMessage('Invalid upload category'),
    body('storageKey').trim().notEmpty().withMessage('A storage key is required'),
    body('fileName').trim().notEmpty().withMessage('A file name is required'),
    body('size').isInt({ min: 1 }).withMessage('A valid file size is required'),
    body('mimeType').optional().isString()
  ],
  completeProjectFileUpload
);

router.get('/:id/files', authenticate, authorize('admin'), getProjectFileList);

router.delete('/:id', authenticate, authorize('admin'), deleteProject);

router.post(
  '/categories',
  authenticate,
  authorize('admin'),
  [body('name').trim().notEmpty().withMessage('Category name is required')],
  createCategory
);

export default router;
