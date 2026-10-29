import sequelize, { dbConfig, describeDatabaseTarget } from './database.js';
import '../models/index.js'; // Import all models and associations
import dotenv from 'dotenv';

dotenv.config();

/**
 * Connectivity check for the configured database.
 *
 * Usage: npm run db:check
 *
 * Reports the server version, whether the session is actually encrypted, and
 * the tables/row counts that exist. It only reads, so it is safe to run against
 * a managed database such as Aiven before and after migrating.
 */
const INTERESTING_TABLES = [
  'users',
  'project_categories',
  'projects',
  'project_documents',
  'project_document_files',
  'orders',
  'order_items',
  'support_requests'
];

async function checkDatabase() {
  console.log(`Target: ${describeDatabaseTarget()}`);
  console.log('');

  const startedAt = Date.now();
  await sequelize.authenticate();
  console.log(`✓ Connected and authenticated in ${Date.now() - startedAt} ms`);

  const [[server]] = await sequelize.query(
    'SELECT VERSION() AS version, DATABASE() AS db, CURRENT_USER() AS user'
  );
  console.log(`  server version : ${server.version}`);
  console.log(`  database       : ${server.db}`);
  console.log(`  user           : ${server.user}`);

  // @@require_secure_transport is MySQL 8+/managed-server only; older local
  // installs and MariaDB do not expose it, so probe it separately.
  let requiresTls = null;
  try {
    const [[row]] = await sequelize.query('SELECT @@require_secure_transport AS requiresTls');
    requiresTls = row?.requiresTls;
  } catch {
    requiresTls = null;
  }
  console.log(
    `  requires TLS   : ${requiresTls === null ? 'unknown (server variable unavailable)' : requiresTls ? 'yes' : 'no'}`
  );

  const [cipherRows] = await sequelize.query("SHOW STATUS LIKE 'Ssl_cipher'");
  const cipher = cipherRows?.[0]?.Value;
  console.log(`  session cipher : ${cipher || 'NONE (unencrypted!)'}`);

  const queryInterface = sequelize.getQueryInterface();
  const tables = await queryInterface.showAllTables();
  console.log(`\n  tables found   : ${tables.length}`);

  if (tables.length === 0) {
    console.log('  (schema has not been created yet — run: npm run migrate)');
  } else {
    for (const table of INTERESTING_TABLES) {
      if (!tables.includes(table)) {
        console.log(`  ${table.padEnd(24)} : missing`);
        continue;
      }
      const [[{ count }]] = await sequelize.query(
        `SELECT COUNT(*) AS count FROM \`${table}\``
      );
      console.log(`  ${table.padEnd(24)} : ${count} rows`);
    }
  }

  const missing = INTERESTING_TABLES.filter((table) => !tables.includes(table));
  console.log('');
  if (tables.length > 0 && missing.length > 0) {
    console.log(`⚠ Missing expected tables: ${missing.join(', ')}`);
    console.log('  Run the migration scripts, e.g. npm run migrate');
    process.exitCode = 1;
  } else {
    console.log('✅ Database connection check passed.');
  }
}

checkDatabase()
  .catch((error) => {
    console.error('\n❌ Database connection check failed.');
    console.error(error.message);
    if (error.original) console.error(`  driver: ${error.original.code || ''} ${error.original.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close().catch(() => {});
  });
