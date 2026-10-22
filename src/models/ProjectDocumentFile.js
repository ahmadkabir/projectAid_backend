import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * Metadata for every file attached to a project (documentation, software
 * installer, user guide). The binary lives in the configured object storage
 * provider; this table only stores metadata plus the storage key.
 */
const ProjectDocumentFile = sequelize.define('ProjectDocumentFile', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  projectId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'projects',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  fileName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Stored file name (never trust the browser supplied name)'
  },
  originalName: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Sanitised name supplied by the uploader, for display only'
  },
  category: {
    type: DataTypes.ENUM('documentation', 'software', 'guide'),
    allowNull: false,
    defaultValue: 'documentation',
    comment: 'What the file is: project documentation, software installer or user guide'
  },
  fileType: {
    type: DataTypes.ENUM('pdf', 'doc', 'docx', 'zip', 'rar'),
    allowNull: false
  },
  filePath: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'Legacy/human readable path (uploads/...). Use storageKey for lookups'
  },
  storageKey: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'Key of the object in the configured storage provider'
  },
  storageProvider: {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'local'
  },
  mimeType: {
    type: DataTypes.STRING(150),
    allowNull: true
  },
  fileSize: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  checksum: {
    type: DataTypes.STRING(64),
    allowNull: true,
    comment: 'SHA-256 of the stored object'
  },
  uploadStatus: {
    type: DataTypes.ENUM('pending', 'completed', 'failed'),
    allowNull: false,
    defaultValue: 'completed'
  },
  isCurrent: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: 'False once the file has been replaced; kept for existing purchases'
  },
  supersededAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  archivedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  tableName: 'project_document_files',
  timestamps: true
});

export default ProjectDocumentFile;
