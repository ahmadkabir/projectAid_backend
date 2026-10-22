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
    defaultValue: 0.00,
    comment: 'Price of the software when it is sold separately (0 when included)'
  },
  fullProjectPrice: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
    comment: 'Optional bundled price for documentation + separately sold software'
  },
  documentationFile: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Legacy: file name of the current documentation file. Metadata lives in project_document_files'
  },
  softwareFile: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Legacy: file name of the current software installer. Metadata lives in project_document_files'
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
    type: DataTypes.ENUM('draft', 'pending_review', 'published', 'archived'),
    defaultValue: 'draft',
    allowNull: false,
    comment: 'Lifecycle state: draft, pending_review, published or archived'
  },
  projectType: {
    type: DataTypes.ENUM('documentation', 'software'),
    allowNull: true,
    comment: 'documentation = documentation only, software = documentation plus accompanying software'
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Documentation price (mirrors documentationPrice)'
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
  },
  // --- Accompanying software ------------------------------------------------
  softwareName: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  softwareVersion: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  softwareDescription: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  softwareOperatingSystem: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Supported operating system(s)'
  },
  softwareRequirements: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'System requirements'
  },
  softwareLicense: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Licence terms for the software'
  },
  softwareRedistributionAllowed: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    comment: 'Whether the supplier permits the buyer to redistribute the software'
  },
  softwareSaleMode: {
    type: DataTypes.ENUM('included', 'separate'),
    allowNull: true,
    comment: 'included = software comes with the documentation purchase, separate = sold on its own'
  },
  softwareStatus: {
    type: DataTypes.ENUM('active', 'archived'),
    allowNull: true,
    comment: 'null = no software, active = available, archived = removed from sale'
  }
}, {
  tableName: 'projects',
  timestamps: true
});

export default Project;
