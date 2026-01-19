import express from 'express';
import { body } from 'express-validator';
import {
  createSupportRequest,
  getUserSupportRequests,
  getAllSupportRequests,
  updateSupportRequest,
  getSupportRequestById
} from '../controllers/supportController.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = express.Router();

router.post(
  '/',
  authenticate,
  [
    body('projectId').isInt().withMessage('Valid project ID is required'),
    body('subject').trim().notEmpty().withMessage('Subject is required'),
    body('message').trim().notEmpty().withMessage('Message is required'),
    body('orderId').optional().isInt()
  ],
  createSupportRequest
);

router.get('/', authenticate, getUserSupportRequests);
router.get('/all', authenticate, authorize('admin'), getAllSupportRequests);
router.get('/:id', authenticate, getSupportRequestById);

router.put(
  '/:id',
  authenticate,
  [
    body('status').optional().isIn(['open', 'in_progress', 'resolved', 'closed']),
    body('adminResponse').optional().trim()
  ],
  updateSupportRequest
);

export default router;
