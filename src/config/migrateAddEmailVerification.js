import sequelize from './database.js';
import Sequelize from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

// Deterministic migration: uses describeTable/addColumn instead of
// sequelize.sync({ alter: true }), which fails on this schema due to a
// pre-existing foreign-key drift on order_items.
async function migrateAddEmailVerification() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established.');

    const queryInterface = sequelize.getQueryInterface();
    const tableDescription = await queryInterface.describeTable('users');

    const columns = [
      ['emailVerified', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether the user confirmed their email address'
      }],
      ['verificationToken', {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'SHA-256 hash of the raw verification token'
      }],
      ['verificationTokenExpires', {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Expiry of the verification token'
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

    // One-time backfill: users created BEFORE this feature never had a chance
    // to verify, so mark them as verified. Run only once — re-running later
    // would also verify accounts that registered but never confirmed.
    console.log('\nBackfilling existing users as verified (one-time)...');
    const [results] = await sequelize.query(
      'UPDATE users SET emailVerified = TRUE WHERE emailVerified = FALSE OR emailVerified IS NULL'
    );
    console.log(`✓ Marked ${results.affectedRows || 0} existing user(s) as verified.`);

    console.log('\n✅ Migration completed successfully!');
    console.log('Note: New registrations start with emailVerified = FALSE until they confirm via email.');
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

migrateAddEmailVerification();
