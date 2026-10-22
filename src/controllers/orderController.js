import { validationResult } from 'express-validator';
import { Op } from 'sequelize';
import {
  Order,
  OrderItem,
  Project,
  ProjectCategory,
  ProjectDocumentFile,
  User
} from '../models/index.js';
import {
  resolveItemPrice,
  entitledCategories,
  normalizeStatus
} from '../services/projectService.js';
import { serializeFile } from '../services/projectFileService.js';

const projectInclude = {
  model: Project,
  as: 'project',
  include: [
    { model: ProjectCategory, as: 'category' },
    {
      model: ProjectDocumentFile,
      as: 'documentFiles',
      attributes: [
        'id', 'projectId', 'fileName', 'originalName', 'category', 'fileType',
        'mimeType', 'fileSize', 'uploadStatus', 'isCurrent', 'createdAt'
      ]
    }
  ]
};

const loadProjectWithFiles = (projectId) =>
  Project.findByPk(projectId, {
    include: [{
      model: ProjectDocumentFile,
      as: 'documentFiles',
      attributes: ['id', 'category', 'isCurrent', 'uploadStatus']
    }]
  });

const fileAvailability = (project) => {
  const files = project.documentFiles || [];
  return {
    hasDocumentationFile:
      files.some((file) => file.category === 'documentation' && file.isCurrent) ||
      Boolean(project.documentationFile),
    hasInstaller:
      files.some((file) => file.category === 'software' && file.isCurrent) ||
      Boolean(project.softwareFile)
  };
};

/**
 * Add the files a customer is entitled to for each purchased item. Only files
 * covered by that item's purchase are returned.
 */
const decorateOrder = (order, { includeStorage = false } = {}) => {
  if (!order) return order;
  const plain = order.toJSON ? order.toJSON() : { ...order };

  plain.items = (plain.items || []).map((item) => {
    if (!item.project) return item;

    const project = item.project;
    const files = (project.documentFiles || [])
      .filter((file) => file.isCurrent !== false && file.uploadStatus !== 'failed')
      .map((file) => serializeFile(file, { includeStorage }));

    const categories = entitledCategories(project, item.itemType);
    const downloadableFiles = files.filter((file) => categories.includes(file.category));

    return {
      ...item,
      project: { ...project, documentFiles: files, files },
      entitledCategories: categories,
      downloadableFiles
    };
  });

  return plain;
};

export const createOrder = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { items } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'Order items required' });
    }

    let totalAmount = 0;
    const orderItems = [];

    for (const item of items) {
      const project = await loadProjectWithFiles(item.projectId);
      if (!project) {
        return res.status(404).json({ message: `Project ${item.projectId} not found` });
      }

      // Drafts, resources under review and archived resources cannot be bought.
      if (normalizeStatus(project.status) !== 'published') {
        return res.status(400).json({ message: 'This project is not available for purchase' });
      }

      const availability = fileAvailability(project);
      const resolved = resolveItemPrice(project, item.itemType, availability);

      if (!resolved.ok) {
        return res.status(400).json({ message: resolved.error });
      }

      totalAmount += resolved.price;
      orderItems.push({
        projectId: project.id,
        itemType: item.itemType,
        price: resolved.price
      });
    }

    const order = await Order.create({
      userId: req.user.id,
      totalAmount,
      status: 'pending'
    });

    for (const item of orderItems) {
      await OrderItem.create({
        orderId: order.id,
        projectId: item.projectId,
        itemType: item.itemType,
        price: item.price
      });
    }

    const createdOrder = await Order.findByPk(order.id, {
      include: [{ model: OrderItem, as: 'items', include: [projectInclude] }]
    });

    res.status(201).json({
      message: 'Order created successfully',
      order: decorateOrder(createdOrder)
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ message: 'Server error creating order' });
  }
};

export const processPayment = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { paymentMethod, transactionId } = req.body;

    const order = await Order.findByPk(orderId, {
      include: [{ model: OrderItem, as: 'items' }]
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({ message: 'Order already processed' });
    }

    order.status = 'completed';
    order.paymentMethod = paymentMethod || 'mock_payment';
    order.transactionId = transactionId || `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await order.save();

    const updatedOrder = await Order.findByPk(order.id, {
      include: [{ model: OrderItem, as: 'items', include: [projectInclude] }]
    });

    res.json({
      message: 'Payment processed successfully',
      order: decorateOrder(updatedOrder)
    });
  } catch (error) {
    console.error('Process payment error:', error);
    res.status(500).json({ message: 'Server error processing payment' });
  }
};

export const getUserOrders = async (req, res) => {
  try {
    const orders = await Order.findAll({
      where: { userId: req.user.id },
      include: [{ model: OrderItem, as: 'items', include: [projectInclude] }],
      order: [['createdAt', 'DESC']]
    });

    res.json({ orders: orders.map((order) => decorateOrder(order)) });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', startDate, endDate, status } = req.query;

    const where = {};
    if (status && ['pending', 'completed', 'failed'].includes(status)) {
      where.status = status;
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt[Op.lte] = end;
      }
    }

    const include = [
      {
        model: OrderItem,
        as: 'items',
        required: false,
        include: [{ ...projectInclude, required: false }]
      },
      {
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email', 'profileImage'],
        required: false
      }
    ];

    const searchConditions = [];
    if (search) {
      const like = { [Op.like]: `%${search}%` };
      searchConditions.push(
        { transactionId: like },
        { '$user.name$': like },
        { '$user.email$': like },
        { '$items.project.title$': like }
      );
    }

    const finalWhere = searchConditions.length ? { ...where, [Op.or]: searchConditions } : where;

    const { count, rows } = await Order.findAndCountAll({
      where: finalWhere,
      include,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit, 10),
      offset: (parseInt(page, 10) - 1) * parseInt(limit, 10),
      distinct: true,
      subQuery: false
    });

    res.json({
      success: true,
      orders: rows.map((order) => decorateOrder(order, { includeStorage: true })),
      total: count
    });
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id, {
      include: [{ model: OrderItem, as: 'items', include: [projectInclude] }]
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ order: decorateOrder(order) });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
