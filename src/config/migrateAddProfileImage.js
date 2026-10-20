import sequelize from './database.js';
import Sequelize from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

// Deterministic migration: uses describeTable/addColumn instead of
// sequelize.sync({ alter: true }), which fails on this schema due to a
// pre-existing foreign-key drift on order_items.
async function migrateAddProfileImage() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established.');

    const queryInterface = sequelize.getQueryInterface();
    const tableDescription = await queryInterface.describeTable('users');

    const columns = [
      ['profileImage', {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Filename of the avatar inside uploads/avatars/'
      }]
    ];

    for (const [name, definition] of columns) {
      if (!tableDescription[name]) {
        console.log(`Adding ${name} column to users table...`);
        await queryInterface.addColumn('users', name, definition);
        console.log(`✓ ${name} column added.`);
      } else {
        console.log(`⊘ ${name} column already exists.`);
      }
    }

    console.log('\n✅ Migration completed successfully!');
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

migrateAddProfileImage();
