import express from 'express';
import {
  getDashboard,
  getRevenue,
  getOrders,
  getProjects,
  getSupport
} from '../controllers/analyticsController.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = express.Router();

// All analytics routes are admin-only
router.use(authenticate);
router.use(authorize('admin'));

router.get('/dashboard', getDashboard);
router.get('/revenue', getRevenue);
router.get('/orders', getOrders);
router.get('/projects', getProjects);
router.get('/support', getSupport);

export default router;
