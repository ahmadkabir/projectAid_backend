# ProjectAid Backend API

Express.js backend API for ProjectAid MVP.

## Quick Start

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and configure
3. Create MySQL database: `CREATE DATABASE projectaid_db;`
4. Run migrations: `npm run migrate`
5. Seed data (optional): `npm run seed`
6. Start server: `npm run dev`

## Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run db:check` - Verify the database connection, TLS cipher and tables
- `npm run db:check-mongo` - Verify an optional MongoDB `MONGODB_URI` connection
- `npm run migrate` - Run database migrations
- `npm run seed` - Seed initial data
- `npm run migrate:files-to-r2` - Copy existing local project files to R2
  (supports `--dry-run`, `--limit=50`, `--no-verify`; never deletes local files)

## Database connection

All application data is stored in MongoDB through Mongoose. Configure one of:

```dotenv
# Cloud MongoDB (Atlas, etc.)
DATABASE_MODE=online
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/projectaid?retryWrites=true&w=majority

# Or a local daemon
DATABASE_MODE=local
MONGODB_LOCAL_URI=mongodb://127.0.0.1:27017/projectaid
```

Optional: `MONGODB_DB` overrides the database in the URI,
`MONGODB_CONNECT_TIMEOUT` (ms) and `MONGODB_POOL_MAX` (default 10; use a lower
value such as 5 on serverless). Verify the connection with:

```bash
npm run db:check-mongo
```

It resolves DNS/SRV, authenticates, pings the server and lists collections in
the target database, then exits 0. On failure it prints the driver error plus
the likely fix (bad credentials, `authSource`, unreachable host, missing IP
allowlist entry).

The `DB_*` variables and `npm run db:check` / `npm run migrate` belong to the
legacy MySQL migration scripts only; the running API never uses them.

## Deploying to Vercel

Vercel detects the Express app (`src/app.js` / `src/server.js`) and runs it as a
single Function with Fluid compute. No `vercel.json` is required.

1. **Root Directory**: set it to `projectAid_backend` in the Vercel project.
2. **Node version**: `package.json` pins `22.x` (Mongoose 9 requires >= 20.19).
3. **Environment variables** (Project Settings → Environment Variables):

   ```dotenv
   DATABASE_MODE=online
   MONGODB_URI=...
   JWT_SECRET=...
   FRONTEND_URL=https://your-frontend.example.com

   # Required on Vercel: the filesystem is read-only
   STORAGE_PROVIDER=s3
   R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com
   R2_BUCKET_NAME=...
   R2_ACCESS_KEY_ID=...
   R2_SECRET_ACCESS_KEY=...

   PAYSTACK_SECRET_KEY=...
   PAYSTACK_CALLBACK_URL=https://your-frontend.example.com/payment/callback
   PAYMENTS_MOCK_ENABLED=false

   EMAIL_PROVIDER=smtp
   EMAIL_SMTP_HOST=...
   EMAIL_SMTP_PORT=587
   EMAIL_USER=...
   EMAIL_PASS=...
   EMAIL_FROM=...
   ```

4. Upload the existing public images once, because `uploads/` is not part of the
   deployment and cannot be written to at runtime:

   ```bash
   npm run migrate:public-assets -- --dry-run
   npm run migrate:public-assets
   ```

5. Add the webhook URL in Paystack:
   `https://<your-api>/api/payments/paystack/webhook`.

Notes:

- Vercel caps request and buffered response bodies at 4.5 MB. Paid files use
  presigned direct-to-R2 uploads, and generated PDFs are streamed, so they are
  not affected. Keep avatars/thumbnails under 4 MB.
- `express.static` is ignored on Vercel. Thumbnails and avatars are served by
  the API from the configured storage provider instead.
- The rate limiter is per instance. Use a shared store (e.g. Upstash Redis) if
  you need a strict global limit.

## Object storage (Cloudflare R2)

Set `STORAGE_PROVIDER=s3` plus either the `STORAGE_S3_*` or `R2_*` variables
(see `.env.example`). Keep the bucket private and add a CORS rule that allows
`PUT`/`GET`/`HEAD` from the frontend origin and the `content-type` header.

- Paid files upload directly from the admin UI to R2 using short-lived
  presigned PUT URLs (15 min). The API records the file only after verifying the
  object's size and real file signature.
- Downloads stay private: the API checks the session and a completed purchase,
  then redirects to a 5-minute presigned GET URL (or streams local files).
- With `STORAGE_PROVIDER=local`, the admin UI automatically falls back to the
  multipart upload endpoints.
- After switching to R2, run `npm run migrate:files-to-r2` to copy existing
  local files and verify each copy before updating its database row.

## Payments (Paystack)

Set `PAYSTACK_SECRET_KEY`, `PAYSTACK_CURRENCY=NGN` and
`PAYSTACK_CALLBACK_URL` in `.env`. The browser is redirected to Paystack's
hosted checkout; the API verifies the transaction before completing an order.

- `POST /api/orders/:id/pay` - initialize a transaction for a pending order.
- `GET /api/orders/payment-status?reference=...` - verify after checkout.
- `POST /api/payments/paystack/webhook` - signed Paystack webhook.
- `POST /api/orders/:id/payment` - mock flow, disabled unless
  `PAYMENTS_MOCK_ENABLED=true` (tests only).

Add the webhook URL in the Paystack dashboard:

```
https://<your-public-api-host>/api/payments/paystack/webhook
```

For local testing use a tunnel such as `ngrok http 5001` and register the
resulting HTTPS URL; Paystack cannot reach `localhost`. The webhook route keeps
the raw request body because Paystack signs it with HMAC-SHA512.

## API Documentation

See main README.md for complete API endpoint documentation.
# projectAid_backend
