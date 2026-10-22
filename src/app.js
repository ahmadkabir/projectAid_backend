import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/authRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import supportRoutes from './routes/supportRoutes.js';
import userRoutes from './routes/userRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import documentRoutes from './routes/documentRoutes.js';
import fileRoutes from './routes/fileRoutes.js';
import { paystackWebhook } from './controllers/orderController.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Security middleware
// crossOriginResourcePolicy: 'cross-origin' so the frontend (localhost:5173)
// can load images from /uploads served by this API
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false
}));

// Rate limiting (more lenient in development)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Higher limit in development
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// CORS configuration
// Vite serves on both localhost and 127.0.0.1 — allow both origins
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser tools (no Origin header) and known frontend origins
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(null, false);
  },
  credentials: true
}));

// Paystack signs the raw webhook body, so this route must be mounted before
// the JSON parser. It verifies the HMAC before trusting the event.
app.post(
  '/api/payments/paystack/webhook',
  express.raw({ type: 'application/json', limit: '1mb' }),
  paystackWebhook
);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Public marketing assets only. Paid documentation, software installers and
// user guides are served exclusively through /api/files/:id/download, which
// verifies the customer's purchase.
app.use('/uploads/thumbnails', express.static(path.join(__dirname, '../uploads/thumbnails')));
app.use('/uploads/avatars', express.static(path.join(__dirname, '../uploads/avatars')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'ProjectAid API is running' });
});

// API Routes
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
