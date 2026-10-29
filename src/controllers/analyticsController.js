import { User, Project, Order, SupportRequest } from '../models/index.js';

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

  return startDate ? { createdAt: { $gte: startDate } } : {};
};

export const getDashboard = async (req, res) => {
  try {
    const { dateRange = '7d' } = req.query;
    const dateFilter = getDateRange(dateRange);

    // Total counts
    const totalUsers = await User.countDocuments();
    const totalProjects = await Project.countDocuments({
      status: { $in: ['published', 'active'] }
    });
    const totalOrders = await Order.countDocuments();

    // Revenue
    const completedOrders = await Order.find({
      status: 'completed',
      ...dateFilter
    });

    const totalRevenue = completedOrders.reduce((sum, order) => {
      return sum + parseFloat(order.totalAmount || 0);
    }, 0);

    // Growth calculations (compare with previous period)
    const previousPeriodFilter =
      dateRange === '7d'
        ? getDateRange('14d')
        : dateRange === '30d'
        ? getDateRange('60d')
        : {};

    const previousUsers = await User.countDocuments(previousPeriodFilter);
    const previousOrders = await Order.countDocuments(previousPeriodFilter);
    const previousCompletedOrders = await Order.find({
      status: 'completed',
      ...previousPeriodFilter
    });
    const previousRevenue = previousCompletedOrders.reduce((sum, o) => sum + parseFloat(o.totalAmount || 0), 0);

    const userGrowth = totalUsers > 0 ? ((totalUsers - previousUsers) / Math.max(previousUsers, 1)) * 100 : 0;
    const orderGrowth = totalOrders > 0 ? ((totalOrders - previousOrders) / Math.max(previousOrders, 1)) * 100 : 0;
    const revenueGrowth = totalRevenue > 0 ? ((totalRevenue - previousRevenue) / Math.max(previousRevenue, 1)) * 100 : 0;

    // Revenue & orders data for chart (last 7 days)
    const revenueData = [];
    const ordersData = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));

      const dayFilter = { createdAt: { $gte: dayStart, $lte: dayEnd } };

      const [dayTotalOrders, dayCompletedOrders] = await Promise.all([
        Order.countDocuments(dayFilter),
        Order.find({ status: 'completed', ...dayFilter })
      ]);

      const dayRevenue = dayCompletedOrders.reduce((sum, o) => sum + parseFloat(o.totalAmount || 0), 0);

      const dateLabel = dayStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      revenueData.push({
        date: dateLabel,
        revenue: dayRevenue
      });

      ordersData.push({
        date: dateLabel,
        orders: dayTotalOrders,
        completed: dayCompletedOrders.length
      });
    }

    // Top projects by completed purchases
    const allCompletedOrders = await Order.find({ status: 'completed' })
      .populate('items.project', 'id title');

    const projectCounts = {};
    for (const order of allCompletedOrders) {
      for (const item of order.items || []) {
        if (!item.project) continue;
        const pId = item.project._id?.toString() || item.project.id?.toString();
        if (!projectCounts[pId]) {
          projectCounts[pId] = {
            name: item.project.title || 'Unknown',
            purchases: 0
          };
        }
        projectCounts[pId].purchases++;
      }
    }

    const topProjectsData = Object.values(projectCounts)
      .sort((a, b) => b.purchases - a.purchases)
      .slice(0, 5);

    // Recent orders
    const recentOrders = await Order.find()
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(10);

    // Support stats
    const [openSupport, inProgressSupport, resolvedSupport, closedSupport] = await Promise.all([
      SupportRequest.countDocuments({ status: 'open' }),
      SupportRequest.countDocuments({ status: 'in_progress' }),
      SupportRequest.countDocuments({ status: 'resolved' }),
      SupportRequest.countDocuments({ status: 'closed' })
    ]);

    const supportStats = {
      open: openSupport,
      inProgress: inProgressSupport,
      resolved: resolvedSupport,
      closed: closedSupport
    };

    res.json({
      totalUsers,
      totalProjects,
      totalOrders,
      totalRevenue,
      userGrowth: Math.round(userGrowth * 10) / 10,
      orderGrowth: Math.round(orderGrowth * 10) / 10,
      revenueGrowth: Math.round(revenueGrowth * 10) / 10,
      projectGrowth: 0,
      revenueData,
      ordersData,
      topProjects: topProjectsData,
      recentOrders: recentOrders.map((order) => ({
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

    const completed = await Order.find({ status: 'completed', ...dateFilter });
    const revenue = completed.reduce((sum, o) => sum + parseFloat(o.totalAmount || 0), 0);

    res.json({ revenue });
  } catch (error) {
    console.error('Revenue analytics error:', error);
    res.status(500).json({ message: 'Server error fetching revenue' });
  }
};

export const getOrders = async (req, res) => {
  try {
    const { dateRange = '30d' } = req.query;
    const dateFilter = getDateRange(dateRange);

    const orders = await Order.find(dateFilter)
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    res.json({ orders });
  } catch (error) {
    console.error('Orders analytics error:', error);
    res.status(500).json({ message: 'Server error fetching orders' });
  }
};

export const getProjects = async (req, res) => {
  try {
    const completedOrders = await Order.find({ status: 'completed' });
    const counts = {};

    for (const order of completedOrders) {
      for (const item of order.items || []) {
        const pId = item.project?._id?.toString() || (item.project ? String(item.project) : null);
        if (pId) {
          counts[pId] = (counts[pId] || 0) + (item.projectIdLegacy ? 0 : 0) + 1;
        }
      }
    }

    const projects = await Project.find().select('id title legacyId');
    const projectsWithCounts = projects.map((p) => {
      const pId = p._id.toString();
      const legacyIdStr = p.legacyId ? String(p.legacyId) : null;
      const purchases = (counts[pId] || 0) + (legacyIdStr && counts[legacyIdStr] ? counts[legacyIdStr] : 0);
      return {
        id: p.id,
        title: p.title,
        purchases
      };
    }).sort((a, b) => b.purchases - a.purchases);

    res.json({ projects: projectsWithCounts });
  } catch (error) {
    console.error('Projects analytics error:', error);
    res.status(500).json({ message: 'Server error fetching projects' });
  }
};

export const getSupport = async (req, res) => {
  try {
    const [open, inProgress, resolved, closed] = await Promise.all([
      SupportRequest.countDocuments({ status: 'open' }),
      SupportRequest.countDocuments({ status: 'in_progress' }),
      SupportRequest.countDocuments({ status: 'resolved' }),
      SupportRequest.countDocuments({ status: 'closed' })
    ]);

    const stats = {
      open,
      inProgress,
      resolved,
      closed
    };

    res.json({ stats });
  } catch (error) {
    console.error('Support analytics error:', error);
    res.status(500).json({ message: 'Server error fetching support stats' });
  }
};
