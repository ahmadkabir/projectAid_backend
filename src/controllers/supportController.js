import mongoose from 'mongoose';
import { validationResult } from 'express-validator';
import { SupportRequest, Project, User, Order } from '../models/index.js';

export const createSupportRequest = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { projectId, orderId, subject, message } = req.body;

    const project = await Project.findByIdOrLegacy(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    let resolvedOrder = null;
    if (orderId) {
      resolvedOrder = await Order.findByIdOrLegacy(orderId);
      const orderUserId = resolvedOrder?.user?._id?.toString() || resolvedOrder?.user?.toString();
      const currentUserId = req.user._id?.toString() || req.user.id?.toString();
      if (!resolvedOrder || orderUserId !== currentUserId) {
        return res.status(403).json({ message: 'Invalid order' });
      }
    }

    const supportRequest = await SupportRequest.create({
      user: req.user._id || req.user.id,
      project: project._id,
      order: resolvedOrder?._id || null,
      subject,
      message,
      status: 'open'
    });

    const createdRequest = await SupportRequest.findById(supportRequest._id)
      .populate('project', 'id title')
      .populate('user', 'id name email');

    res.status(201).json({
      message: 'Support request created successfully',
      supportRequest: createdRequest
    });
  } catch (error) {
    console.error('Create support request error:', error);
    res.status(500).json({ message: 'Server error creating support request' });
  }
};

export const getUserSupportRequests = async (req, res) => {
  try {
    const currentUserId = req.user._id || req.user.id;
    const supportRequests = await SupportRequest.find({
      $or: [
        { user: currentUserId },
        ...(mongoose.Types.ObjectId.isValid(currentUserId) ? [{ user: new mongoose.Types.ObjectId(currentUserId) }] : [])
      ]
    })
      .populate('project', 'id title thumbnail')
      .sort({ createdAt: -1 });

    res.json({ supportRequests });
  } catch (error) {
    console.error('Get support requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getAllSupportRequests = async (req, res) => {
  try {
    const supportRequests = await SupportRequest.find()
      .populate('project', 'id title')
      .populate('user', 'id name email')
      .sort({ createdAt: -1 });

    res.json({ supportRequests });
  } catch (error) {
    console.error('Get all support requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateSupportRequest = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const supportRequest = await SupportRequest.findByIdOrLegacy(req.params.id);
    if (!supportRequest) {
      return res.status(404).json({ message: 'Support request not found' });
    }

    const requestUserId = supportRequest.user?._id?.toString() || supportRequest.user?.toString();
    const currentUserId = req.user._id?.toString() || req.user.id?.toString();

    // Users can only update their own requests if status is open
    if (req.user.role !== 'admin') {
      if (requestUserId !== currentUserId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      if (supportRequest.status !== 'open') {
        return res.status(400).json({ message: 'Cannot update closed request' });
      }
    }

    const { status, adminResponse } = req.body;

    if (status) {
      supportRequest.status = status;
    }

    if (adminResponse && req.user.role === 'admin') {
      supportRequest.adminResponse = adminResponse;
    }

    await supportRequest.save();

    const updatedRequest = await SupportRequest.findById(supportRequest._id)
      .populate('project', 'id title')
      .populate('user', 'id name email');

    res.json({
      message: 'Support request updated successfully',
      supportRequest: updatedRequest
    });
  } catch (error) {
    console.error('Update support request error:', error);
    res.status(500).json({ message: 'Server error updating support request' });
  }
};

export const getSupportRequestById = async (req, res) => {
  try {
    const supportRequest = await SupportRequest.findByIdOrLegacy(req.params.id)
      .populate({
        path: 'project',
        populate: { path: 'category' }
      })
      .populate('user', 'id name email');

    if (!supportRequest) {
      return res.status(404).json({ message: 'Support request not found' });
    }

    const requestUserId = supportRequest.user?._id?.toString() || supportRequest.user?.toString();
    const currentUserId = req.user._id?.toString() || req.user.id?.toString();

    if (requestUserId !== currentUserId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ supportRequest });
  } catch (error) {
    console.error('Get support request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
