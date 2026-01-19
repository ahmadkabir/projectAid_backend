import sequelize from './database.js';
import Sequelize from 'sequelize';
import '../models/index.js'; // Import all models and associations
import dotenv from 'dotenv';

dotenv.config();

async function migrate() {
  try {
    // First, connect without specifying database to create it if it doesn't exist
    const adminSequelize = new Sequelize(
      '',
      process.env.DB_USERNAME || 'root',
      process.env.DB_PASSWORD || '',
      {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        dialect: process.env.DB_DIALECT || 'mysql',
        logging: false
      }
    );

    const dbName = process.env.DB_NAME || 'ProjectAid';
    
    // Create database if it doesn't exist
    await adminSequelize.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
    console.log(`Database '${dbName}' checked/created.`);
    await adminSequelize.close();

    // Now connect to the actual database
    await sequelize.authenticate();
    console.log('Database connection established.');

    // Sync all models (this will add new columns if they don't exist)
    await sequelize.sync({ alter: true });
    console.log('Database tables synchronized successfully.');
    console.log('\nNote: New fields (summary, objective, features) have been added to the projects table.');

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
