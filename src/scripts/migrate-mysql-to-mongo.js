import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  connectMySQL,
  fetchAllData,
  closeMySQLConnection
} from '../utils/mysqlMigrationHelpers.js';
import {
  connectMongo,
  insertAllData,
  closeMongoConnection
} from '../utils/mongoMigrationHelpers.js';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env') });

const runMigration = async () => {
  try {
    console.log('🚀 Starting MySQL → MongoDB migration...');

    const mysqlConnection = await connectMySQL();
    const mongoConnection = await connectMongo();

    const mysqlData = await fetchAllData(mysqlConnection);

    await insertAllData(mysqlData);

    await closeMySQLConnection(mysqlConnection);
    await closeMongoConnection(mongoConnection);

    console.log('✅ Migration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

runMigration();
