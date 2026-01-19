import express from 'express';
import { body } from 'express-validator';
import {
  createOrder,
  processPayment,
  getUserOrders,
  getAllOrders,
  getOrderById
} from '../controllers/orderController.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = express.Router();

router.post(
  '/',
  authenticate,
  [
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.projectId').isInt().withMessage('Valid project ID is required'),
    body('items.*.itemType').isIn(['documentation', 'software', 'full']).withMessage('Valid item type is required')
  ],
  createOrder
);

router.post(
  '/:id/payment',
  authenticate,
  [
    body('paymentMethod').optional().trim(),
    body('transactionId').optional().trim()
  ],
  processPayment
);

router.get('/', authenticate, getUserOrders);
router.get('/all', authenticate, authorize('admin'), getAllOrders);
router.get('/:id', authenticate, getOrderById);

export default router;
