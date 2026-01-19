import { Op } from 'sequelize';
import { User, Project, Order, OrderItem, SupportRequest, ProjectCategory } from '../models/index.js';

const getDateRange = (dateRange) => {
  const now = new Date();
  let startDate;

  switch (dateRange) {
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = null;
  }

  return startDate ? { createdAt: { [Op.gte]: startDate } } : {};
};

export const getDashboard = async (req, res) => {
  try {
    const { dateRange = '7d' } = req.query;
    const dateFilter = getDateRange(dateRange);

    // Total counts
    const totalUsers = await User.count();
    const totalProjects = await Project.count({ where: { status: 'active' } });
    const totalOrders = await Order.count();
    
    // Revenue
    const completedOrders = await Order.findAll({
      where: { status: 'completed', ...dateFilter },
      include: [{ model: OrderItem, as: 'items' }]
    });
    
    const totalRevenue = completedOrders.reduce((sum, order) => {
      return sum + parseFloat(order.totalAmount || 0);
    }, 0);

    // Growth calculations (simplified - compare with previous period)
    const previousPeriodFilter = dateRange === '7d' 
      ? getDateRange('14d')
      : dateRange === '30d'
      ? getDateRange('60d')
      : {};

    const previousUsers = await User.count({ where: previousPeriodFilter });
    const previousOrders = await Order.count({ where: previousPeriodFilter });
    const previousRevenue = await Order.sum('totalAmount', {
      where: { status: 'completed', ...previousPeriodFilter }
    }) || 0;

    const userGrowth = totalUsers > 0 ? ((totalUsers - previousUsers) / Math.max(previousUsers, 1)) * 100 : 0;
    const orderGrowth = totalOrders > 0 ? ((totalOrders - previousOrders) / Math.max(previousOrders, 1)) * 100 : 0;
    const revenueGrowth = totalRevenue > 0 ? ((totalRevenue - previousRevenue) / Math.max(previousRevenue, 1)) * 100 : 0;

    // Revenue data for chart (last 7 days)
    const revenueData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));

      const dayOrders = await Order.sum('totalAmount', {
        where: {
          status: 'completed',
          createdAt: { [Op.between]: [dayStart, dayEnd] }
        }
      }) || 0;

      revenueData.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: parseFloat(dayOrders)
      });
    }

    // Orders data for chart
    const ordersData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));

      const totalDayOrders = await Order.count({
        where: { createdAt: { [Op.between]: [dayStart, dayEnd] } }
      });

      const completedDayOrders = await Order.count({
        where: {
          status: 'completed',
          createdAt: { [Op.between]: [dayStart, dayEnd] }
        }
      });

      ordersData.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        orders: totalDayOrders,
        completed: completedDayOrders
      });
    }

    // Top projects by purchases
    const orderItems = await OrderItem.findAll({
      include: [{
        model: Project,
        as: 'project',
        attributes: ['id', 'title']
      }]
    });

    const projectCounts = {};
    orderItems.forEach(item => {
      const projectId = item.projectId;
      if (!projectCounts[projectId]) {
        projectCounts[projectId] = {
          name: item.project?.title || 'Unknown',
          purchases: 0
        };
      }
      projectCounts[projectId].purchases++;
    });

    const topProjectsData = Object.values(projectCounts)
      .sort((a, b) => b.purchases - a.purchases)
      .slice(0, 5);

    // Recent orders
    const recentOrders = await Order.findAll({
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['name', 'email']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: 10
    });

    // Support stats
    const supportStats = {
      open: await SupportRequest.count({ where: { status: 'open' } }),
      inProgress: await SupportRequest.count({ where: { status: 'in_progress' } }),
      resolved: await SupportRequest.count({ where: { status: 'resolved' } }),
      closed: await SupportRequest.count({ where: { status: 'closed' } })
    };

    res.json({
      totalUsers,
      totalProjects,
      totalOrders,
      totalRevenue,
      userGrowth: Math.round(userGrowth * 10) / 10,
      orderGrowth: Math.round(orderGrowth * 10) / 10,
      revenueGrowth: Math.round(revenueGrowth * 10) / 10,
      projectGrowth: 0, // Can be calculated similarly
      revenueData,
      ordersData,
      topProjects: topProjectsData,
      recentOrders: recentOrders.map(order => ({
        id: order.id,
        user: order.user,
        totalAmount: order.totalAmount,
        status: order.status,
        createdAt: order.createdAt
      })),
      supportStats
    });
  } catch (error) {
    console.error('Dashboard analytics error:', error);
    res.status(500).json({ message: 'Server error fetching analytics' });
  }
};

export const getRevenue = async (req, res) => {
  try {
    const { dateRange = '30d' } = req.query;
    const dateFilter = getDateRange(dateRange);

    const revenue = await Order.sum('totalAmount', {
      where: { status: 'completed', ...dateFilter }
    }) || 0;

    res.json({ revenue: parseFloat(revenue) });
  } catch (error) {
    console.error('Revenue analytics error:', error);
    res.status(500).json({ message: 'Server error fetching revenue' });
  }
};

export const getOrders = async (req, res) => {
  try {
    const { dateRange = '30d' } = req.query;
    const dateFilter = getDateRange(dateRange);

    const orders = await Order.findAll({
      where: dateFilter,
      include: [{
        model: User,
        as: 'user',
        attributes: ['name', 'email']
      }],
      order: [['createdAt', 'DESC']]
    });

    res.json({ orders });
  } catch (error) {
    console.error('Orders analytics error:', error);
    res.status(500).json({ message: 'Server error fetching orders' });
  }
};

export const getProjects = async (req, res) => {
  try {
    const projects = await Project.findAll({
      include: [{
        model: OrderItem,
        as: 'orderItems'
      }]
    });

    const projectsWithCounts = projects.map(project => ({
      id: project.id,
      title: project.title,
      purchases: project.orderItems?.length || 0
    })).sort((a, b) => b.purchases - a.purchases);

    res.json({ projects: projectsWithCounts });
  } catch (error) {
    console.error('Projects analytics error:', error);
    res.status(500).json({ message: 'Server error fetching projects' });
  }
};

export const getSupport = async (req, res) => {
  try {
    const stats = {
      open: await SupportRequest.count({ where: { status: 'open' } }),
      inProgress: await SupportRequest.count({ where: { status: 'in_progress' } }),
      resolved: await SupportRequest.count({ where: { status: 'resolved' } }),
      closed: await SupportRequest.count({ where: { status: 'closed' } })
    };

    res.json({ stats });
  } catch (error) {
    console.error('Support analytics error:', error);
    res.status(500).json({ message: 'Server error fetching support stats' });
  }
};
