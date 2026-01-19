import sequelize from './database.js';
import Sequelize from 'sequelize';
import '../models/index.js'; // Import all models and associations
import dotenv from 'dotenv';

dotenv.config();

/**
 * Migration Script: Set all existing projects to "documentation"
 * 
 * This script bulk updates all projects where projectType is NULL
 * to set projectType = 'documentation'
 * 
 * Safe to run multiple times (idempotent)
 */
async function migrateSetAllDocumentation() {
  const transaction = await sequelize.transaction();
  
  try {
    // Connect to database
    await sequelize.authenticate();
    console.log('✓ Database connection established.');

    // Check current state
    const [beforeCount] = await sequelize.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN projectType IS NULL THEN 1 ELSE 0 END) as null_count,
        SUM(CASE WHEN projectType = 'documentation' THEN 1 ELSE 0 END) as documentation_count,
        SUM(CASE WHEN projectType = 'software' THEN 1 ELSE 0 END) as software_count
      FROM projects
    `, { transaction });

    const stats = beforeCount[0];
    console.log('\n📊 Current Project Statistics:');
    console.log(`   Total projects: ${stats.total}`);
    console.log(`   NULL projectType: ${stats.null_count}`);
    console.log(`   Already 'documentation': ${stats.documentation_count}`);
    console.log(`   Already 'software': ${stats.software_count}`);

    // Update all NULL projectType to 'documentation'
    console.log('\n🔄 Updating projects with NULL projectType to "documentation"...');
    
    const [updateResult] = await sequelize.query(`
      UPDATE projects
      SET projectType = 'documentation'
      WHERE projectType IS NULL
    `, { transaction });

    const affectedRows = updateResult.affectedRows || 0;
    console.log(`✓ Updated ${affectedRows} project(s) to 'documentation'.`);

    // Verify the update
    const [afterCount] = await sequelize.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN projectType IS NULL THEN 1 ELSE 0 END) as null_count,
        SUM(CASE WHEN projectType = 'documentation' THEN 1 ELSE 0 END) as documentation_count,
        SUM(CASE WHEN projectType = 'software' THEN 1 ELSE 0 END) as software_count
      FROM projects
    `, { transaction });

    const afterStats = afterCount[0];
    console.log('\n📊 Updated Project Statistics:');
    console.log(`   Total projects: ${afterStats.total}`);
    console.log(`   NULL projectType: ${afterStats.null_count}`);
    console.log(`   'documentation': ${afterStats.documentation_count}`);
    console.log(`   'software': ${afterStats.software_count}`);

    // Commit transaction
    await transaction.commit();
    console.log('\n✅ Migration completed successfully!');
    console.log('   All existing projects now have projectType = "documentation"');
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    // Rollback transaction on error
    await transaction.rollback();
    console.error('\n❌ Migration failed:', error.message);
    console.error('   Transaction rolled back. No changes were made.');
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

// Run migration
migrateSetAllDocumentation();
