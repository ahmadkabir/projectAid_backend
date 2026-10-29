/**
 * MongoDB connection check script.
 * Verifies connection according to DATABASE_MODE (local or online).
 *
 *   npm run db:check-mongo
 *   DATABASE_MODE=local npm run db:check-mongo
 *   DATABASE_MODE=online npm run db:check-mongo
 */
import mongoose, { connectDatabase, disconnectDatabase, getDatabaseTarget } from './mongo.js';

try {
  const target = getDatabaseTarget();
  console.log(`\n🔍 Checking ${target.mode.toUpperCase()} MongoDB connection...`);
  console.log(`Target: ${target.redactedUri}`);

  await connectDatabase();

  const connection = mongoose.connection;
  const admin = connection.db.admin();

  let serverVersion = 'unknown';
  try {
    const info = await admin.command({ buildInfo: 1 });
    serverVersion = info.version || serverVersion;
  } catch {
    try {
      const hello = await admin.command({ hello: 1 });
      serverVersion = `wire protocol v${hello.maxWireVersion}`;
    } catch {
      /* version stays unknown */
    }
  }

  const collections = await connection.db.listCollections().toArray();

  console.log('\n📊 Database Status:');
  console.log(`Mode:        ${target.mode.toUpperCase()}`);
  console.log(`Database:    ${connection.name}`);
  console.log(`Server:      ${serverVersion}`);
  console.log(`Mongoose:    ${mongoose.version}`);
  console.log(`Collections: ${collections.length}`);

  if (collections.length === 0) {
    console.log('\nThe database is currently empty.');
  } else {
    const summary = [];
    for (const collection of [...collections].sort((a, b) => a.name.localeCompare(b.name))) {
      const count = await connection.db
        .collection(collection.name)
        .countDocuments()
        .catch(() => null);
      summary.push(count === null ? collection.name : `${collection.name} (${count})`);
    }
    console.log(`             ${summary.join(', ')}`);
  }

  console.log('\n✅ MongoDB connection check passed successfully!\n');
  await disconnectDatabase();
  process.exit(0);
} catch (error) {
  await disconnectDatabase().catch(() => {});
  console.error('\n❌ MongoDB check failed:', error.message);
  process.exit(1);
}
