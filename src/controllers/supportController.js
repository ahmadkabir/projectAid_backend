import { validationResult } from 'express-validator';
import { SupportRequest, Project, User, Order } from '../models/index.js';

export const createSupportRequest = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { projectId, orderId, subject, message } = req.body;

    // Verify project exists
    const project = await Project.findByPk(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // If orderId provided, verify it belongs to user
    if (orderId) {
      const order = await Order.findByPk(orderId);
      if (!order || order.userId !== req.user.id) {
        return res.status(403).json({ message: 'Invalid order' });
      }
    }

    const supportRequest = await SupportRequest.create({
      userId: req.user.id,
      projectId,
      orderId: orderId || null,
      subject,
      message,
      status: 'open'
    });

    const createdRequest = await SupportRequest.findByPk(supportRequest.id, {
      include: [
        {
          model: Project,
          as: 'project',
          attributes: ['id', 'title']
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

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
    const supportRequests = await SupportRequest.findAll({
      where: { userId: req.user.id },
      include: [{
        model: Project,
        as: 'project',
        attributes: ['id', 'title', 'thumbnail']
      }],
      order: [['createdAt', 'DESC']]
    });

    res.json({ supportRequests });
  } catch (error) {
    console.error('Get support requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getAllSupportRequests = async (req, res) => {
  try {
    const supportRequests = await SupportRequest.findAll({
      include: [
        {
          model: Project,
          as: 'project',
          attributes: ['id', 'title']
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

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

    const supportRequest = await SupportRequest.findByPk(req.params.id);
    if (!supportRequest) {
      return res.status(404).json({ message: 'Support request not found' });
    }

    // Users can only update their own requests if status is open
    if (req.user.role !== 'admin') {
      if (supportRequest.userId !== req.user.id) {
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

    const updatedRequest = await SupportRequest.findByPk(supportRequest.id, {
      include: [
        {
          model: Project,
          as: 'project',
          attributes: ['id', 'title']
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

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
    const supportRequest = await SupportRequest.findByPk(req.params.id, {
      include: [
        {
          model: Project,
          as: 'project',
          include: [{
            model: ProjectCategory,
            as: 'category'
          }]
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    if (!supportRequest) {
      return res.status(404).json({ message: 'Support request not found' });
    }

    if (supportRequest.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ supportRequest });
  } catch (error) {
    console.error('Get support request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
