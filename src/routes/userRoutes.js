import express from 'express';
import { body } from 'express-validator';
import {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getProfile,
  updateProfile,
  uploadProfileImage,
  changePassword
} from '../controllers/userController.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { avatarUpload } from '../utils/upload.js';

const router = express.Router();

// Self-service profile routes — declared before '/:id' so 'profile' is never
// treated as a user id. Any authenticated user may manage their own profile;
// role changes are intentionally not possible here (admin-only via PUT /:id).
router.get('/profile', authenticate, getProfile);

router.put(
  '/profile',
  authenticate,
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('email').optional().isEmail().withMessage('Valid email is required')
  ],
  updateProfile
);

router.put(
  '/profile/password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters')
  ],
  changePassword
);

router.put('/profile/avatar', authenticate, avatarUpload.single('avatar'), uploadProfileImage);

router.get('/', authenticate, authorize('admin'), getAllUsers);
router.get('/:id', authenticate, authorize('admin'), getUserById);

router.put(
  '/:id',
  authenticate,
  authorize('admin'),
  [
    body('name').optional().trim().notEmpty(),
    body('email').optional().isEmail(),
    body('role').optional().isIn(['student', 'admin'])
  ],
  updateUser
);

router.delete('/:id', authenticate, authorize('admin'), deleteUser);

export default router;
