import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Sequelize from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

const parseIntOrDefault = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

/**
 * Aiven (and most managed MySQL providers) require TLS. Their CA is a private
 * project CA, so the system trust store alone is not enough: the downloaded
 * ca.pem must be supplied through DB_SSL_CA.
 *
 * DB_SSL_CA may be an absolute path, a path relative to the backend root, or
 * the PEM contents themselves (useful for hosts that only allow env vars).
 */
const resolveCertificate = (value) => {
  if (!value) return null;
  if (value.includes('BEGIN CERTIFICATE')) return Buffer.from(value);

  const certificatePath = path.isAbsolute(value) ? value : path.resolve(backendRoot, value);
  if (!fs.existsSync(certificatePath)) {
    throw new Error(
      `DB_SSL_CA points to "${value}" but no certificate exists at ${certificatePath}.\n` +
        'Download the CA certificate (Aiven console -> service -> Overview -> CA Certificate)\n' +
        `and save it to ${certificatePath}, or set DB_SSL_CA to the correct path.\n` +
        'Do not commit the certificate if it is project-specific; keep it out of version control.'
    );
  }

  return fs.readFileSync(certificatePath);
};

const sslEnabled = parseBoolean(process.env.DB_SSL, false);

// A broken TLS configuration is a startup error, not a request-time surprise:
// report it without a stack trace so the fix is obvious.
const failConfiguration = (message) => {
  console.error('\n❌ Database TLS configuration error\n');
  console.error(message);
  console.error('');
  process.exit(1);
};

export const sslOptions = (() => {
  if (!sslEnabled) return null;

  const rejectUnauthorized = parseBoolean(process.env.DB_SSL_REJECT_UNAUTHORIZED, true);

  let ca = null;
  if (process.env.DB_SSL_CA) {
    try {
      ca = resolveCertificate(process.env.DB_SSL_CA);
    } catch (error) {
      // With verification disabled the CA is not needed; keep it as a warning
      // so the connection can still be diagnosed (e.g. before the CA download).
      if (rejectUnauthorized) failConfiguration(error.message);
      console.warn(`[db] ${error.message}\n[db] Continuing without a CA because DB_SSL_REJECT_UNAUTHORIZED=false.`);
    }
  }

  if (!ca && rejectUnauthorized) {
    console.warn(
      '[db] DB_SSL is enabled without DB_SSL_CA. Managed providers such as Aiven use a ' +
        'private CA, so the TLS handshake will fail until the CA certificate is supplied.'
    );
  }

  return {
    ...(ca ? { ca } : {}),
    rejectUnauthorized,
    minVersion: 'TLSv1.2'
  };
})();

export const dbConfig = {
  database: process.env.DB_NAME || 'ProjectAid',
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  host: process.env.DB_HOST || 'localhost',
  port: parseIntOrDefault(process.env.DB_PORT, 3306),
  dialect: process.env.DB_DIALECT || 'mysql'
};

/** Redacted description of the configured target, safe to log. */
export const describeDatabaseTarget = () => {
  const sslState = !sslEnabled
    ? 'disabled'
    : sslOptions?.ca
      ? 'enabled (CA verified)'
      : `enabled (rejectUnauthorized=${sslOptions?.rejectUnauthorized})`;

  return `${dbConfig.host}:${dbConfig.port}/${dbConfig.database} as ${dbConfig.username} | TLS: ${sslState}`;
};

export const connectionOptions = {
  host: dbConfig.host,
  port: dbConfig.port,
  dialect: dbConfig.dialect,
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: parseIntOrDefault(process.env.DB_POOL_MAX, 5),
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  ...(sslOptions
    ? {
        dialectOptions: {
          ssl: sslOptions,
          // Managed databases are reached over the public internet; fail fast
          // instead of hanging when the host is unreachable.
          connectTimeout: parseIntOrDefault(process.env.DB_CONNECT_TIMEOUT, 20000)
        }
      }
    : {})
};

const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  connectionOptions
);

export default sequelize;
