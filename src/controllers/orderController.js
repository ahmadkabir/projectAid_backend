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
import {
  isPaystackConfigured,
  paystackCurrency,
  amountToKobo,
  generatePaymentReference,
  initializeTransaction,
  verifyTransaction,
  verifyWebhookSignature
} from '../services/paystackService.js';

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

const findOrderForResponse = (orderId) =>
  Order.findByPk(orderId, {
    include: [{ model: OrderItem, as: 'items', include: [projectInclude] }]
  });

/**
 * Complete an order exactly once. The conditional update means both the
 * callback verification and the webhook can race safely.
 */
const markOrderPaid = async (order, reference) => {
  await Order.update(
    {
      status: 'completed',
      paymentMethod: 'paystack',
      transactionId: reference
    },
    { where: { id: order.id, status: 'pending' } }
  );

  return findOrderForResponse(order.id);
};

const paymentCallbackUrl = () =>
  process.env.PAYSTACK_CALLBACK_URL ||
  `${(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')}/payment/callback`;

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
    // The mock endpoint lets a client mark its own order as paid. It must
    // never be available in a real deployment; tests opt in explicitly.
    if (process.env.PAYMENTS_MOCK_ENABLED !== 'true') {
      return res.status(403).json({
        message: 'Mock payments are disabled. Use Paystack checkout.'
      });
    }

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

/**
 * Start a Paystack transaction for a pending order. The amount always comes
 * from the stored order, never from the client.
 */
export const initializePayment = async (req, res) => {
  try {
    if (!isPaystackConfigured()) {
      return res.status(503).json({ message: 'Payment provider is not configured' });
    }

    const order = await Order.findByPk(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.userId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (order.status === 'completed') {
      return res.status(400).json({ message: 'Order is already paid' });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({ message: 'Order cannot be paid' });
    }

    const amountKobo = amountToKobo(order.totalAmount);
    const reference = generatePaymentReference(order.id);

    const transaction = await initializeTransaction({
      email: req.user.email,
      amountKobo,
      reference,
      callbackUrl: paymentCallbackUrl(),
      currency: paystackCurrency(),
      metadata: {
        orderId: String(order.id),
        userId: String(order.userId)
      }
    });

    order.paymentMethod = 'paystack';
    order.transactionId = transaction.reference || reference;
    await order.save();

    res.json({
      message: 'Payment initialized',
      authorizationUrl: transaction.authorization_url,
      accessCode: transaction.access_code,
      reference: transaction.reference || reference
    });
  } catch (error) {
    console.error('Initialize payment error:', error);
    res.status(error.status || 500).json({
      message: error.status ? error.message : 'Unable to initialize payment'
    });
  }
};

/**
 * Verify a Paystack transaction after the customer returns from checkout.
 */
export const verifyPayment = async (req, res) => {
  try {
    const reference = String(req.query.reference || '').trim();

    if (!reference) {
      return res.status(400).json({ message: 'Payment reference is required' });
    }

    const order = await Order.findOne({
      where: { transactionId: reference, userId: req.user.id }
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found for this payment reference' });
    }

    if (order.status === 'completed') {
      const completedOrder = await findOrderForResponse(order.id);
      return res.json({
        message: 'Payment already verified',
        paymentStatus: 'success',
        order: decorateOrder(completedOrder)
      });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({ message: 'Order cannot be verified' });
    }

    const transaction = await verifyTransaction(reference);

    if (!transaction || transaction.status !== 'success') {
      return res.status(400).json({
        message: 'Payment was not successful',
        paymentStatus: transaction?.status || 'failed'
      });
    }

    if (transaction.reference !== reference) {
      console.error('Paystack reference mismatch:', {
        orderId: order.id,
        expected: reference,
        received: transaction.reference
      });
      return res.status(400).json({ message: 'Payment reference does not match' });
    }

    if (Number(transaction.amount) !== amountToKobo(order.totalAmount)) {
      console.error('Paystack amount mismatch:', {
        orderId: order.id,
        expected: amountToKobo(order.totalAmount),
        received: transaction.amount
      });
      return res.status(400).json({ message: 'Payment amount does not match the order' });
    }

    if (String(transaction.currency || '').toUpperCase() !== paystackCurrency()) {
      return res.status(400).json({ message: 'Payment currency does not match' });
    }

    if (
      transaction.metadata?.orderId &&
      String(transaction.metadata.orderId) !== String(order.id)
    ) {
      return res.status(400).json({ message: 'Payment does not belong to this order' });
    }

    const updatedOrder = await markOrderPaid(order, transaction.reference);

    res.json({
      message: 'Payment verified successfully',
      paymentStatus: 'success',
      order: decorateOrder(updatedOrder)
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(error.status || 500).json({
      message: error.status ? error.message : 'Unable to verify payment'
    });
  }
};

/**
 * Paystack webhook. The route receives the raw body so the HMAC signature can
 * be checked before the event is trusted.
 */
export const paystackWebhook = async (req, res) => {
  const signature = req.get('x-paystack-signature');

  if (!verifyWebhookSignature(req.body, signature)) {
    return res.status(401).json({ message: 'Invalid webhook signature' });
  }

  let event;
  try {
    const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body || '');
    event = JSON.parse(raw);
  } catch {
    return res.status(400).json({ message: 'Invalid webhook payload' });
  }

  // Acknowledge every valid event; only charge.success changes entitlements.
  if (event.event !== 'charge.success') {
    return res.json({ received: true });
  }

  const data = event.data || {};

  try {
    if (!data.reference) {
      console.error('Paystack webhook missing reference');
      return res.json({ received: true });
    }

    let order = null;
    if (data.metadata?.orderId) {
      order = await Order.findByPk(data.metadata.orderId);
    }
    if (!order) {
      order = await Order.findOne({ where: { transactionId: data.reference } });
    }

    if (!order) {
      console.error('Paystack webhook order not found:', data.reference);
      return res.json({ received: true });
    }

    if (order.status === 'completed') {
      return res.json({ received: true, alreadyProcessed: true });
    }

    if (
      data.metadata?.userId &&
      String(data.metadata.userId) !== String(order.userId)
    ) {
      console.error('Paystack webhook user mismatch:', { orderId: order.id });
      return res.json({ received: true });
    }

    if (Number(data.amount) !== amountToKobo(order.totalAmount)) {
      console.error('Paystack webhook amount mismatch:', {
        orderId: order.id,
        expected: amountToKobo(order.totalAmount),
        received: data.amount
      });
      return res.json({ received: true });
    }

    if (String(data.currency || '').toUpperCase() !== paystackCurrency()) {
      console.error('Paystack webhook currency mismatch:', {
        orderId: order.id,
        received: data.currency
      });
      return res.json({ received: true });
    }

    await markOrderPaid(order, data.reference);
    console.log(`Paystack payment confirmed for order ${order.id}`);

    res.json({ received: true });
  } catch (error) {
    console.error('Paystack webhook error:', error);
    res.status(500).json({ message: 'Webhook processing failed' });
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
