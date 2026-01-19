import { Router } from 'express';
import { body } from 'express-validator';
import {
  generateDocument,
  getDocument,
  saveDocument,
  saveDocumentFile
} from '../controllers/documentController.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

// All routes require admin authentication
router.post(
  '/projects/:id/generate-doc',
  authenticate,
  authorize('admin'),
  generateDocument
);

router.get(
  '/projects/:id/document',
  authenticate,
  authorize('admin'),
  getDocument
);

router.put(
  '/projects/:id/document',
  authenticate,
  authorize('admin'),
  [
    body('content').notEmpty().withMessage('Content is required')
  ],
  saveDocument
);

router.post(
  '/projects/:id/save-document',
  authenticate,
  authorize('admin'),
  [
    body('content').notEmpty().withMessage('Content is required'),
    body('format').isIn(['pdf', 'docx']).withMessage('Format must be pdf or docx')
  ],
  saveDocumentFile
);

export default router;
