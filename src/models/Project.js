import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import ProjectCategory from './ProjectCategory.js';

const Project = sequelize.define('Project', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  categoryId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'project_categories',
      key: 'id'
    }
  },
  documentationPrice: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00
  },
  softwarePrice: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00
  },
  fullProjectPrice: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00
  },
  documentationFile: {
    type: DataTypes.STRING,
    allowNull: true
  },
  softwareFile: {
    type: DataTypes.STRING,
    allowNull: true
  },
  thumbnail: {
    type: DataTypes.STRING,
    allowNull: true
  },
  summary: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Short overview of the project'
  },
  objective: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Project goals and objectives'
  },
  features: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Key features and deliverables (JSON or text)'
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active'
  },
  projectType: {
    type: DataTypes.ENUM('documentation', 'software'),
    allowNull: true,
    comment: 'Project type: documentation or software'
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Single price field (replaces documentationPrice/softwarePrice/fullProjectPrice)'
  },
  level: {
    type: DataTypes.ENUM('ND', 'HND', 'BSc', 'MSc'),
    allowNull: true,
    comment: 'Academic level: ND, HND, BSc, or MSc'
  },
  institution: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Institution name (e.g., Federal Polytechnic, Kano)'
  }
}, {
  tableName: 'projects',
  timestamps: true
});

export default Project;
