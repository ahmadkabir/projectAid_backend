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
- `npm run migrate` - Run database migrations
- `npm run seed` - Seed initial data
- `npm run migrate:files-to-r2` - Copy existing local project files to R2
  (supports `--dry-run`, `--limit=50`, `--no-verify`; never deletes local files)

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
