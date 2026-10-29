import sequelize, { connectionOptions, dbConfig, describeDatabaseTarget } from './database.js';
import Sequelize from 'sequelize';
import '../models/index.js'; // Import all models and associations
import dotenv from 'dotenv';

dotenv.config();

async function migrate() {
  try {
    console.log(`Target: ${describeDatabaseTarget()}`);
    console.log('');

    // First, connect without specifying database to create it if it doesn't exist.
    // The admin connection needs the same TLS settings as the application one.
    const adminSequelize = new Sequelize(
      '',
      dbConfig.username,
      dbConfig.password,
      { ...connectionOptions, logging: false }
    );

    const dbName = dbConfig.database;

    // Managed providers may not grant CREATE DATABASE; that is fine as long as
    // the database already exists, which the next step will confirm.
    try {
      await adminSequelize.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
      console.log(`Database '${dbName}' checked/created.`);
    } catch (error) {
      console.warn(`Could not run CREATE DATABASE (continuing if '${dbName}' already exists): ${error.message}`);
    } finally {
      await adminSequelize.close().catch(() => {});
    }

    // Now connect to the actual database
    await sequelize.authenticate();
    console.log('Database connection established.');

    // Sync all models (this will add new columns if they don't exist)
    await sequelize.sync({ alter: true });
    console.log('Database tables synchronized successfully.');

    const queryInterface = sequelize.getQueryInterface();
    const tables = await queryInterface.showAllTables();
    console.log(`Tables present: ${tables.length}`);
    console.log('');

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
