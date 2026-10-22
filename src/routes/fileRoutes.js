import express from 'express';
import { downloadProjectFile, getWatermarkedPdf } from '../controllers/fileController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// Authentication is required and entitlement is checked inside the controllers.
router.get('/:id/download', authenticate, downloadProjectFile);
router.get('/:id/pdf', authenticate, getWatermarkedPdf);

export default router;
