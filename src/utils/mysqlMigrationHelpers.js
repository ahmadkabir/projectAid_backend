import mysql from 'mysql2/promise';

export const connectMySQL = async () => {
  const {
    DB_HOST,
    DB_PORT = 3306,
    DB_NAME,
    DB_USERNAME,
    DB_PASSWORD
  } = process.env;

  if (!DB_HOST || !DB_NAME || !DB_USERNAME) {
    throw new Error('Missing MySQL environment variables. Please set DB_HOST, DB_NAME, DB_USERNAME, and DB_PASSWORD');
  }

  const connection = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USERNAME,
    password: DB_PASSWORD,
    database: DB_NAME,
    multipleStatements: false
  });

  console.log('✅ Connected to MySQL');
  return connection;
};

export const closeMySQLConnection = async (connection) => {
  if (connection) {
    await connection.end();
    console.log('🔌 MySQL connection closed');
  }
};

const TABLES = [
  'users',
  'project_categories',
  'projects',
  'orders',
  'order_items',
  'support_requests',
  'project_documents',
  'project_document_files'
];

const normalizeTimestamp = (value) => {
  if (!value) return null;
  return new Date(value).toISOString();
};

const mapRowWithTimestamps = (row) => {
  const mapped = { ...row };
  if ('createdAt' in mapped) mapped.createdAt = normalizeTimestamp(mapped.createdAt);
  if ('updatedAt' in mapped) mapped.updatedAt = normalizeTimestamp(mapped.updatedAt);
  return mapped;
};

export const fetchAllData = async (connection) => {
  const data = {};

  for (const table of TABLES) {
    console.log(`📥 Fetching data from ${table}...`);
    const [rows] = await connection.query(`SELECT * FROM ${table}`);
    data[table] = rows.map(mapRowWithTimestamps);
    console.log(`   → ${rows.length} rows fetched`);
  }

  return data;
};
