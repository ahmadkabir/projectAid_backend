import { validationResult } from 'express-validator';
import { Order, OrderItem, Project, ProjectCategory } from '../models/index.js';

export const createOrder = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { items } = req.body; // items: [{ projectId, itemType }]

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'Order items required' });
    }

    let totalAmount = 0;
    const orderItems = [];

    // Calculate total and validate items
    for (const item of items) {
      const project = await Project.findByPk(item.projectId);
      if (!project) {
        return res.status(404).json({ message: `Project ${item.projectId} not found` });
      }

      let price = 0;
      if (item.itemType === 'documentation') {
        price = parseFloat(project.documentationPrice);
      } else if (item.itemType === 'software') {
        price = parseFloat(project.softwarePrice);
      } else if (item.itemType === 'full') {
        price = parseFloat(project.fullProjectPrice);
      }

      if (price <= 0) {
        return res.status(400).json({ message: `Invalid price for ${item.itemType} of project ${item.projectId}` });
      }

      totalAmount += price;
      orderItems.push({ projectId: item.projectId, itemType: item.itemType, price });
    }

    // Create order
    const order = await Order.create({
      userId: req.user.id,
      totalAmount,
      status: 'pending'
    });

    // Create order items
    for (const item of orderItems) {
      await OrderItem.create({
        orderId: order.id,
        projectId: item.projectId,
        itemType: item.itemType,
        price: item.price
      });
    }

    const createdOrder = await Order.findByPk(order.id, {
      include: [{
        model: OrderItem,
        as: 'items',
        include: [{
          model: Project,
          as: 'project',
          include: [{
            model: ProjectCategory,
            as: 'category'
          }]
        }]
      }]
    });

    res.status(201).json({
      message: 'Order created successfully',
      order: createdOrder
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ message: 'Server error creating order' });
  }
};

export const processPayment = async (req, res) => {
  try {
    const orderId = req.params.id; // Get order ID from URL parameter
    const { paymentMethod, transactionId } = req.body;

    const order = await Order.findByPk(orderId, {
      include: [{
        model: OrderItem,
        as: 'items'
      }]
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

    // Mock payment processing - in production, integrate with payment gateway
    // For MVP, we'll simulate successful payment
    order.status = 'completed';
    order.paymentMethod = paymentMethod || 'mock_payment';
    order.transactionId = transactionId || `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await order.save();

    const updatedOrder = await Order.findByPk(order.id, {
      include: [{
        model: OrderItem,
        as: 'items',
        include: [{
          model: Project,
          as: 'project',
          include: [{
            model: ProjectCategory,
            as: 'category'
          }]
        }]
      }]
    });

    res.json({
      message: 'Payment processed successfully',
      order: updatedOrder
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
      include: [{
        model: OrderItem,
        as: 'items',
        include: [{
          model: Project,
          as: 'project',
          include: [{
            model: ProjectCategory,
            as: 'category'
          }]
        }]
      }],
      order: [['createdAt', 'DESC']]
    });

    res.json({ orders });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.findAll({
      include: [{
        model: OrderItem,
        as: 'items',
        include: [{
          model: Project,
          as: 'project',
          include: [{
            model: ProjectCategory,
            as: 'category'
          }]
        }]
      }],
      order: [['createdAt', 'DESC']]
    });

    res.json({ orders });
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id, {
      include: [{
        model: OrderItem,
        as: 'items',
        include: [{
          model: Project,
          as: 'project',
          include: [{
            model: ProjectCategory,
            as: 'category'
          }]
        }]
      }]
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ order });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
