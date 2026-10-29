import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Parses integers with a safe fallback.
 */
const parseIntOrDefault = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

/**
 * Hides passwords and credentials from connection strings for safe logging.
 */
export const redactUri = (uri = '') =>
  uri.replace(/\/\/([^:/@]+):([^@]*)@/, '//$1:***@');

/**
 * Formats driver errors into actionable hints.
 */
export const hintForMongoError = (message = '') => {
  const text = message.toLowerCase();

  if (text.includes('bad auth') || text.includes('authentication failed')) {
    return (
      'The MongoDB credentials were rejected.\n' +
      '  • Check the username/password in your connection string (URL-encode special characters like @ -> %40).\n' +
      '  • If the user belongs to another auth database, add ?authSource=<db> to the URI.'
    );
  }
  if (text.includes('econnrefused')) {
    return (
      'Nothing accepted the connection.\n' +
      '  • If DATABASE_MODE=local, verify your local MongoDB daemon is running (default port 27017).\n' +
      '  • Check host and port in MONGODB_LOCAL_URI.'
    );
  }
  if (text.includes('enotfound') || text.includes('querysrv')) {
    return (
      'The cluster host could not be resolved.\n' +
      '  • Verify cluster hostname in MONGODB_URI.\n' +
      '  • For mongodb+srv:// confirm that DNS SRV records can be resolved on your network.'
    );
  }
  if (text.includes('server selection') || text.includes('etimedout')) {
    return (
      'The MongoDB server was unreachable (connection timed out).\n' +
      '  • For online MongoDB (Atlas), ensure your IP is added to Network Access / IP Allowlist.\n' +
      '  • Check corporate firewalls or VPNs that might block outbound port 27017.'
    );
  }
  if (text.includes('ssl') || text.includes('tls') || text.includes('certificate')) {
    return 'TLS handshake failed. Ensure SSL/TLS settings match your MongoDB server configuration.';
  }
  return null;
};

/**
 * Resolves the active connection target based on DATABASE_MODE.
 */
export const getDatabaseTarget = () => {
  const mode = (process.env.DATABASE_MODE || 'online').trim().toLowerCase();

  let uri = '';
  let dbName = (process.env.MONGODB_DB || '').trim() || undefined;

  if (mode === 'local') {
    uri = (process.env.MONGODB_LOCAL_URI || 'mongodb://127.0.0.1:27017/projectaid').trim();
  } else if (mode === 'online') {
    uri = (process.env.MONGODB_URI || '').trim();
  } else {
    throw new Error(
      `Invalid DATABASE_MODE="${mode}". Allowed values are "local" or "online".`
    );
  }

  if (!uri) {
    const varName = mode === 'local' ? 'MONGODB_LOCAL_URI' : 'MONGODB_URI';
    throw new Error(
      `DATABASE_MODE is set to "${mode}", but ${varName} is not configured in your environment.`
    );
  }

  if (!/^mongodb(\+srv)?:\/\//.test(uri)) {
    throw new Error(
      `The configured MongoDB URI does not start with mongodb:// or mongodb+srv://: ${redactUri(uri)}`
    );
  }

  return {
    mode,
    uri,
    dbName,
    redactedUri: redactUri(uri)
  };
};

/**
 * Checks whether the current MongoDB connection supports multi-document transactions.
 * Transactions require a replica set or mongos cluster; standalone single instances do not support them.
 */
let supportsTransactions = false;

export const hasTransactionSupport = () => supportsTransactions;

/**
 * Connect to MongoDB based on DATABASE_MODE.
 */
export const connectDatabase = async () => {
  // Serverless instances are reused: never open a second pool for the same
  // process when a healthy connection already exists.
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const target = getDatabaseTarget();

  const connectOptions = {
    ...(target.dbName ? { dbName: target.dbName } : {}),
    serverSelectionTimeoutMS: parseIntOrDefault(process.env.MONGODB_CONNECT_TIMEOUT, 10000),
    maxPoolSize: parseIntOrDefault(process.env.MONGODB_POOL_MAX, 10)
  };

  try {
    const conn = await mongoose.connect(target.uri, connectOptions);
    const connection = mongoose.connection;
    const admin = connection.db.admin();

    // Ping to ensure credentials and connection are alive
    await admin.command({ ping: 1 });

    // Check replica set status for transaction support
    try {
      const hello = await admin.command({ hello: 1 });
      supportsTransactions = Boolean(hello.setName || hello.msg === 'isdbgrid');
    } catch {
      supportsTransactions = false;
    }

    console.log(
      `✅ Connected to ${target.mode.toUpperCase()} MongoDB: ${target.redactedUri} [Database: ${connection.name}]` +
      ` (Transactions: ${supportsTransactions ? 'supported' : 'standalone/unsupported'})`
    );

    return conn;
  } catch (error) {
    const detail = error?.message || String(error);
    const hint = hintForMongoError(detail);
    console.error(`\n❌ Failed to connect to ${target.mode.toUpperCase()} MongoDB (${target.redactedUri})`);
    console.error(`Error: ${detail}`);
    if (hint) console.error(`\nHint:\n${hint}\n`);
    throw error;
  }
};

/**
 * Disconnects from MongoDB.
 */
export const disconnectDatabase = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
};

/**
 * Runs a callback inside a MongoDB transaction if replica set transactions
 * are supported, or executes it directly on standalone MongoDB instances.
 */
export const withTransaction = async (callback) => {
  if (!supportsTransactions) {
    return callback(null);
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const result = await callback(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Starts a database transaction if supported, returning an object with session,
 * commit(), and rollback(). On standalone instances, returns no-op methods so
 * code paths work identically across both environments.
 */
export const startDbTransaction = async () => {
  if (!supportsTransactions) {
    return {
      session: null,
      commit: async () => {},
      rollback: async () => {}
    };
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  return {
    session,
    commit: async () => {
      try {
        await session.commitTransaction();
      } finally {
        session.endSession();
      }
    },
    rollback: async () => {
      try {
        await session.abortTransaction().catch(() => {});
      } finally {
        session.endSession();
      }
    }
  };
};

export default mongoose;

