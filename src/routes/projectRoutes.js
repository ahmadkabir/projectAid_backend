import express from 'express';
import { body, query } from 'express-validator';
import {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  getAllCategories,
  createCategory
} from '../controllers/projectController.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { upload } from '../utils/upload.js';

const router = express.Router();

// Public routes
router.get('/', getAllProjects);
router.get('/categories', getAllCategories);
router.get('/:id', getProjectById);

// Admin routes
router.post(
  '/',
  authenticate,
  authorize('admin'),
  upload.fields([
    { name: 'documentation', maxCount: 1 },
    { name: 'documentationFile', maxCount: 1 }, // Support both field names
    { name: 'software', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
  ]),
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('course').optional().isInt().withMessage('Valid course ID is required'), // New field name
    body('categoryId').optional().isInt().withMessage('Valid category ID is required'), // Legacy field name
    body('category').isIn(['documentation', 'software']).withMessage('Category must be "documentation" or "software"'),
    body('level').isIn(['ND', 'HND', 'BSc', 'MSc']).withMessage('Level must be ND, HND, BSc, or MSc'),
    body('institution').optional().trim().isLength({ max: 255 }).withMessage('Institution name must be less than 255 characters'),
    body('price').isFloat({ min: 0.01 }).withMessage('Price must be greater than 0'),
    body('status').optional().isIn(['active', 'inactive']),
    // Legacy fields for backward compatibility
    body('documentationPrice').optional().isFloat({ min: 0 }),
    body('softwarePrice').optional().isFloat({ min: 0 }),
    body('fullProjectPrice').optional().isFloat({ min: 0 })
  ],
  createProject
);

router.put(
  '/:id',
  authenticate,
  authorize('admin'),
  upload.fields([
    { name: 'documentation', maxCount: 1 },
    { name: 'documentationFile', maxCount: 1 }, // Support both field names
    { name: 'software', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
  ]),
  [
    body('title').optional().trim().notEmpty(),
    body('description').optional().trim().notEmpty(),
    body('categoryId').optional().isInt(),
    body('level').optional().isIn(['ND', 'HND', 'BSc', 'MSc']).withMessage('Level must be ND, HND, BSc, or MSc'),
    body('institution').optional().trim().isLength({ max: 255 }).withMessage('Institution name must be less than 255 characters'),
    body('documentationPrice').optional().isFloat({ min: 0 }),
    body('softwarePrice').optional().isFloat({ min: 0 }),
    body('fullProjectPrice').optional().isFloat({ min: 0 })
  ],
  updateProject
);

router.delete('/:id', authenticate, authorize('admin'), deleteProject);

router.post(
  '/categories',
  authenticate,
  authorize('admin'),
  [
    body('name').trim().notEmpty().withMessage('Category name is required')
  ],
  createCategory
);

export default router;
