import express from 'express';
import rateLimit from 'express-rate-limit';
import { body } from 'express-validator';
import { register, login, getMe, verifyEmail, resendVerification } from '../controllers/authController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// Strict limit on verification resends (per IP)
const resendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many verification emails requested. Please try again later.'
});

router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ],
  register
);

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  login
);

router.get('/me', authenticate, getMe);

router.post(
  '/verify-email',
  [
    body('token').trim().notEmpty().withMessage('Verification token is required')
  ],
  verifyEmail
);

router.post(
  '/resend-verification',
  resendLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required')
  ],
  resendVerification
);

export default router;
