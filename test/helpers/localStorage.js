// Tests must never depend on a real bucket or the developer's `.env`.
// dotenv does not override already-set variables, so this wins as long as it
// is imported before any module that loads the environment.
process.env.STORAGE_PROVIDER = 'local';
process.env.UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
// Integration tests use the mock payment endpoint; real deployments leave this
// unset/false so only verified Paystack payments can complete an order.
process.env.PAYMENTS_MOCK_ENABLED = 'true';
