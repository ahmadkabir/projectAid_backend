import { validationResult } from 'express-validator';
import path from 'path';
import crypto from 'crypto';
import { User, Order, SupportRequest } from '../models/index.js';
import { saveBuffer, deleteObject } from '../services/storageService.js';

const AVATAR_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const EXTENSION_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp'
};

// Profile of the authenticated user (never includes the password hash)
export const getProfile = async (req, res) => {
  try {
    const user = await User.findByIdOrLegacy(req.user.id).select('-password');
    res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email } = req.body;

    if (email) {
      const existingUser = await User.findOne({ email: String(email).trim().toLowerCase() });
      if (existingUser && existingUser.id !== req.user.id) {
        return res.status(400).json({ message: 'That email is already in use' });
      }
    }

    const user = await User.findByIdOrLegacy(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (name) user.name = name;
    if (email) user.email = String(email).trim().toLowerCase();
    await user.save();

    const updatedUser = await User.findById(user._id).select('-password');

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error updating profile' });
  }
};

export const uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload an image file (JPEG, PNG, GIF or WebP)' });
    }

    const user = await User.findByIdOrLegacy(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const suppliedExtension = path.extname(req.file.originalname || '').toLowerCase();
    const extension = AVATAR_EXTENSIONS.includes(suppliedExtension)
      ? suppliedExtension
      : EXTENSION_BY_MIME[req.file.mimetype] || '.jpg';

    // The filename is random and the old file is only removed after the new
    // record is saved, so a failed request never leaves a broken avatar.
    const fileName = `avatar-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${extension}`;
    const storageKey = `avatars/${fileName}`;
    const previousImage = user.profileImage;

    await saveBuffer(storageKey, req.file.buffer, { contentType: req.file.mimetype });

    try {
      user.profileImage = fileName;
      await user.save();
    } catch (error) {
      await deleteObject(storageKey).catch(() => {});
      throw error;
    }

    if (previousImage && previousImage !== fileName) {
      await deleteObject(`avatars/${path.basename(previousImage)}`).catch((error) => {
        console.error('Failed to remove old avatar:', error.message);
      });
    }

    const updatedUser = await User.findById(user._id).select('-password');

    res.json({
      message: 'Profile image updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Upload profile image error:', error);
    res.status(500).json({ message: 'Server error uploading profile image' });
  }
};

export const changePassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;

    const user = await User.findByIdOrLegacy(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error changing password' });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getUserById = async (req, res) => {
  try {
    const user = await User.findByIdOrLegacy(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userObj = user.toJSON();

    const [orders, supportRequests] = await Promise.all([
      Order.find({ user: user._id }).sort({ createdAt: -1 }).limit(10),
      SupportRequest.find({ user: user._id }).sort({ createdAt: -1 }).limit(10)
    ]);

    userObj.orders = orders;
    userObj.supportRequests = supportRequests;

    res.json({ user: userObj });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateUser = async (req, res) => {
  try {
    const user = await User.findByIdOrLegacy(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { name, email, role } = req.body;

    if (name) user.name = name;
    if (email) user.email = String(email).trim().toLowerCase();
    if (role && req.user.role === 'admin') {
      user.role = role;
    }

    await user.save();

    const updatedUser = await User.findById(user._id).select('-password');

    res.json({
      message: 'User updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Server error updating user' });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdOrLegacy(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.id === req.user.id) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    await User.deleteOne({ _id: user._id });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error deleting user' });
  }
};
