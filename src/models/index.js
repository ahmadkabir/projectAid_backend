import User from './User.js';
import ProjectCategory from './ProjectCategory.js';
import Project from './Project.js';
import Order from './Order.js';
import OrderItem from './OrderItem.js';
import SupportRequest from './SupportRequest.js';
import ProjectDocument from './ProjectDocument.js';
import ProjectDocumentFile from './ProjectDocumentFile.js';

// Define associations
Order.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(Order, { foreignKey: 'userId', as: 'orders' });

Project.belongsTo(ProjectCategory, { foreignKey: 'categoryId', as: 'category' });
ProjectCategory.hasMany(Project, { foreignKey: 'categoryId', as: 'projects' });

OrderItem.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });
OrderItem.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });
Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items' });
Project.hasMany(OrderItem, { foreignKey: 'projectId', as: 'orderItems' });

SupportRequest.belongsTo(User, { foreignKey: 'userId', as: 'user' });
SupportRequest.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });
SupportRequest.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });
User.hasMany(SupportRequest, { foreignKey: 'userId', as: 'supportRequests' });
Project.hasMany(SupportRequest, { foreignKey: 'projectId', as: 'supportRequests' });
Order.hasMany(SupportRequest, { foreignKey: 'orderId', as: 'supportRequests' });

ProjectDocumentFile.belongsTo(Project, { foreignKey: 'projectId', as: 'documentProject' });
Project.hasMany(ProjectDocumentFile, { foreignKey: 'projectId', as: 'documentFiles' });

ProjectDocumentFile.belongsTo(User, { foreignKey: 'createdBy', as: 'createdByUser' });

export {
  User,
  ProjectCategory,
  Project,
  Order,
  OrderItem,
  SupportRequest,
  ProjectDocument,
  ProjectDocumentFile
};
