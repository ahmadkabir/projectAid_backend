import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import Project from './Project.js';

const ProjectDocument = sequelize.define('ProjectDocument', {
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
  content: {
    type: DataTypes.TEXT('long'),
    allowNull: false,
    comment: 'Generated and edited document content'
  }
}, {
  tableName: 'project_documents',
  timestamps: true
});

// Define association
ProjectDocument.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });
Project.hasOne(ProjectDocument, { foreignKey: 'projectId', as: 'document' });

export default ProjectDocument;
