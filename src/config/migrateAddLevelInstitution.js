import sequelize from './database.js';
import Sequelize from 'sequelize';
import '../models/index.js'; // Import all models and associations
import dotenv from 'dotenv';

dotenv.config();

/**
 * Migration Script: Add level and institution columns to projects table
 * 
 * This script adds:
 * - level (ENUM: 'ND', 'HND', 'BSc', 'MSc')
 * - institution (VARCHAR(255), nullable)
 * 
 * Safe to run multiple times (idempotent)
 */
async function migrateAddLevelInstitution() {
  try {
    // Connect to database
    await sequelize.authenticate();
    console.log('✓ Database connection established.');

    const queryInterface = sequelize.getQueryInterface();

    // Check if columns exist
    const tableDescription = await queryInterface.describeTable('projects');
    
    // Add level column if it doesn't exist
    if (!tableDescription.level) {
      console.log('Adding level column to projects table...');
      try {
        // Use raw SQL for ENUM creation to ensure compatibility
        await sequelize.query(`
          ALTER TABLE \`projects\` 
          ADD COLUMN \`level\` ENUM('ND', 'HND', 'BSc', 'MSc') NULL 
          COMMENT 'Academic level: ND, HND, BSc, or MSc' 
          AFTER \`price\`
        `);
        console.log('✓ Level column added.');
      } catch (error) {
        if (error.message.includes('Duplicate column') || error.message.includes('already exists')) {
          console.log('⊘ Level column already exists (detected via error).');
        } else {
          throw error;
        }
      }
    } else {
      console.log('⊘ Level column already exists.');
    }

    // Add institution column if it doesn't exist
    if (!tableDescription.institution) {
      console.log('Adding institution column to projects table...');
      try {
        await sequelize.query(`
          ALTER TABLE \`projects\` 
          ADD COLUMN \`institution\` VARCHAR(255) NULL 
          COMMENT 'Institution name (e.g., Federal Polytechnic, Kano)' 
          AFTER \`level\`
        `);
        console.log('✓ Institution column added.');
      } catch (error) {
        if (error.message.includes('Duplicate column') || error.message.includes('already exists')) {
          console.log('⊘ Institution column already exists (detected via error).');
        } else {
          throw error;
        }
      }
    } else {
      console.log('⊘ Institution column already exists.');
    }

    // Verify the migration
    const updatedTableDescription = await queryInterface.describeTable('projects');
    console.log('\n📊 Updated Projects Table Structure:');
    console.log(`   level column: ${updatedTableDescription.level ? '✓ Exists' : '✗ Missing'}`);
    console.log(`   institution column: ${updatedTableDescription.institution ? '✓ Exists' : '✗ Missing'}`);

    console.log('\n✅ Migration completed successfully!');
    console.log('   Level and Institution columns are now available in the projects table.');
    
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
migrateAddLevelInstitution();
