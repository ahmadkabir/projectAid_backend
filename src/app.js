import './config/env.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/authRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import supportRoutes from './routes/supportRoutes.js';
import userRoutes from './routes/userRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import documentRoutes from './routes/documentRoutes.js';
import fileRoutes from './routes/fileRoutes.js';
import { paystackWebhook } from './controllers/orderController.js';
import { connectDatabase, hintForMongoError } from './config/mongo.js';
import { servePublicAsset } from './utils/publicAssets.js';

const app = express();

// Vercel (and most hosts) terminate TLS in front of the app. Without this,
// express-rate-limit sees the proxy IP for every visitor and X-Forwarded-For
// validation fails.
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration. FRONTEND_URL may be a single origin or a comma-separated
// list (production domain + Vercel preview deployments).
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5001'
]
  .filter(Boolean)
  .flatMap((value) => String(value).split(','))
  .map((value) => value.trim().replace(/\/$/, ''))
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser tools (no Origin header) and known frontend origins.
    if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ''))) {
      return callback(null, true);
    }
    callback(null, false);
  },
  credentials: true
}));

// Public marketing assets. Served from local disk in development and from
// R2/S3 in production (express.static is ignored on Vercel).
app.get('/uploads/thumbnails/:file', servePublicAsset('thumbnails'));
app.get('/uploads/avatars/:file', servePublicAsset('avatars'));

// Health check — intentionally does not touch the database so it can be used
// as an uptime probe even while the database is restarting.
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'ProjectAid API is running' });
});

/**
 * Connect lazily and at most once per serverless instance.
 *
 * A Vercel Function may be reused for many requests (Fluid compute), so the
 * connection is cached on the module. Concurrent cold-start requests share the
 * same promise instead of opening several pools.
 */
let databasePromise = null;

/**
 * A short, non-sensitive code that tells the caller (and us) which class of
 * database failure happened. Never include the connection string or password.
 */
const databaseErrorCode = (error) => {
  const message = String(error?.message || '');

  if (/not configured in your environment/i.test(message)) return 'MISSING_ENV';
  if (/Invalid DATABASE_MODE/i.test(message)) return 'INVALID_DATABASE_MODE';
  if (/does not start with mongodb/i.test(message)) return 'INVALID_MONGODB_URI';
  if (/bad auth|authentication failed/i.test(message)) return 'AUTH_FAILED';
  if (/enotfound|querysrv/i.test(message)) return 'DNS_LOOKUP_FAILED';
  if (/econnrefused/i.test(message)) return 'CONNECTION_REFUSED';
  if (/server selection|etimedout/i.test(message)) return 'CONNECTION_TIMEOUT';
  if (/ssl|tls|certificate/i.test(message)) return 'TLS_FAILED';

  return error?.code || error?.cause?.code || error?.name || 'UNKNOWN';
};

const ensureDatabase = async (req, res, next) => {
  try {
    if (!databasePromise) {
      databasePromise = connectDatabase().catch((error) => {
        // Allow the next request to retry after a transient failure.
        databasePromise = null;
        throw error;
      });
    }

    await databasePromise;
    return next();
  } catch (error) {
    console.error('Database connection failed:', error.message);

    const hint = hintForMongoError(error?.message || '');
    return res.status(503).json({
      message: 'Database is temporarily unavailable',
      code: databaseErrorCode(error),
      ...(hint ? { hint } : {})
    });
  }
};

// Paystack signs the raw webhook body, so this route must be mounted before the
// JSON parser. It verifies the HMAC before trusting the event, and is outside
// the general rate limiter so provider retries are never throttled.
app.post(
  '/api/payments/paystack/webhook',
  ensureDatabase,
  express.raw({ type: 'application/json', limit: '1mb' }),
  paystackWebhook
);

// Rate limiting (more lenient in development)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Higher limit in development
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

// Body parsing middleware. The 100 KB Express default is too small for a full
// generated document; Vercel still caps the request at 4.5 MB.
const bodyLimit = process.env.REQUEST_BODY_LIMIT || '2mb';
app.use(express.json({ limit: bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: bodyLimit }));

// API Routes
app.use('/api', ensureDatabase);

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/users', userRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', documentRoutes);
app.use('/api/files', fileRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);

  if (err?.name === 'MulterError') {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'The uploaded file is larger than the allowed limit'
      : `Upload failed: ${err.message}`;
    return res.status(400).json({ message });
  }

  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

export default app;
