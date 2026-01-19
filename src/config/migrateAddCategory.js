import sequelize from './database.js';
import Sequelize from 'sequelize';
import '../models/index.js'; // Import all models and associations
import dotenv from 'dotenv';

dotenv.config();

async function migrateAddCategory() {
  try {
    // Connect to database
    await sequelize.authenticate();
    console.log('Database connection established.');

    // Use sync with alter to add missing columns automatically
    console.log('Synchronizing database schema...');
    await sequelize.sync({ alter: true });
    console.log('✓ Database schema synchronized.');

    const queryInterface = sequelize.getQueryInterface();

    // Check if columns exist
    const tableDescription = await queryInterface.describeTable('projects');
    
    if (!tableDescription.projectType) {
      console.log('Adding projectType column to projects table...');
      await queryInterface.addColumn('projects', 'projectType', {
        type: Sequelize.ENUM('documentation', 'software'),
        allowNull: true,
        comment: 'Project type: documentation or software'
      });
      console.log('✓ projectType column added.');
    } else {
      console.log('⊘ projectType column already exists.');
    }

    if (!tableDescription.price) {
      console.log('Adding price column to projects table...');
      await queryInterface.addColumn('projects', 'price', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Single price field (replaces documentationPrice/softwarePrice/fullProjectPrice)'
      });
      console.log('✓ Price column added.');
    } else {
      console.log('⊘ Price column already exists.');
    }

    // Migrate existing data: Set projectType based on existing prices
    console.log('\nMigrating existing project data...');
    try {
      const [results] = await sequelize.query(`
        UPDATE projects 
        SET projectType = CASE 
          WHEN softwarePrice > 0 OR fullProjectPrice > 0 THEN 'software'
          WHEN documentationPrice > 0 THEN 'documentation'
          ELSE 'documentation'
        END,
        price = CASE
          WHEN documentationPrice > 0 THEN documentationPrice
          WHEN softwarePrice > 0 THEN softwarePrice
          WHEN fullProjectPrice > 0 THEN fullProjectPrice
          ELSE 0
        END
        WHERE projectType IS NULL OR price IS NULL;
      `);
      console.log(`✓ Migrated ${results.affectedRows || 0} existing projects.`);
    } catch (migrationError) {
      console.warn('⚠ Data migration skipped (columns may not exist yet):', migrationError.message);
    }

    console.log('\n✅ Migration completed successfully!');
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error.message);
    console.error('\n💡 Alternative: Run the SQL commands manually from MIGRATION_SQL.sql');
    process.exit(1);
  }
}

migrateAddCategory();
