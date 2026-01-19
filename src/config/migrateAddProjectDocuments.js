import sequelize from './database.js';
import Sequelize from 'sequelize';
import '../models/index.js'; // Import all models and associations
import dotenv from 'dotenv';

dotenv.config();

/**
 * Migration Script: Create project_documents table
 * 
 * This script creates the project_documents table for storing AI-generated documents
 */
async function migrateAddProjectDocuments() {
  try {
    // Connect to database
    await sequelize.authenticate();
    console.log('✓ Database connection established.');

    const queryInterface = sequelize.getQueryInterface();

    // Check if table exists
    const tables = await queryInterface.showAllTables();
    
    if (tables.includes('project_documents')) {
      console.log('⊘ project_documents table already exists.');
    } else {
      console.log('Creating project_documents table...');
      
      await queryInterface.createTable('project_documents', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        projectId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'projects',
            key: 'id'
          },
          onDelete: 'CASCADE',
          field: 'projectId'
        },
        content: {
          type: Sequelize.TEXT('long'),
          allowNull: false,
          comment: 'Generated and edited document content'
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
        }
      });

      console.log('✓ project_documents table created.');
    }

    // Verify the migration
    const tableDescription = await queryInterface.describeTable('project_documents');
    console.log('\n📊 project_documents Table Structure:');
    console.log(`   id: ${tableDescription.id ? '✓ Exists' : '✗ Missing'}`);
    console.log(`   projectId: ${tableDescription.projectId ? '✓ Exists' : '✗ Missing'}`);
    console.log(`   content: ${tableDescription.content ? '✓ Exists' : '✗ Missing'}`);
    console.log(`   createdAt: ${tableDescription.createdAt ? '✓ Exists' : '✗ Missing'}`);
    console.log(`   updatedAt: ${tableDescription.updatedAt ? '✓ Exists' : '✗ Missing'}`);

    console.log('\n✅ Migration completed successfully!');
    console.log('   project_documents table is now available.');
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    await sequelize.close();
    process.exit(1);
  }
}

// Run migration
migrateAddProjectDocuments();
