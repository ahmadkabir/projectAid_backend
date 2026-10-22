import crypto from 'crypto';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';
const REQUEST_TIMEOUT_MS = 20000;

const paystackError = (message, status = 502) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

export const isPaystackConfigured = () =>
  Boolean(process.env.PAYSTACK_SECRET_KEY);

export const paystackCurrency = () =>
  (process.env.PAYSTACK_CURRENCY || 'NGN').toUpperCase();

/**
 * Paystack expects the smallest currency unit (kobo for NGN), as an integer.
 */
export const amountToKobo = (amount) => {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw paystackError('Invalid payment amount', 400);
  }
  return Math.round(numeric * 100);
};

export const generatePaymentReference = (orderId) =>
  `PA-${orderId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

const paystackRequest = async (path, options = {}) => {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw paystackError('Paystack is not configured', 503);
  }

  let response;
  try {
    response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw paystackError('Paystack request timed out');
    }
    throw paystackError('Unable to reach Paystack');
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.status) {
    const message = payload?.message || `Paystack request failed (${response.status})`;
    console.error('Paystack API error:', {
      path,
      status: response.status,
      message
    });
    throw paystackError(message);
  }

  return payload.data;
};

export const initializeTransaction = async ({
  email,
  amountKobo,
  reference,
  callbackUrl,
  currency,
  metadata
}) => {
  const body = {
    email,
    amount: amountKobo,
    reference,
    currency: currency || paystackCurrency(),
    metadata
  };

  if (callbackUrl) body.callback_url = callbackUrl;

  return paystackRequest('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify(body)
  });
};

export const verifyTransaction = (reference) =>
  paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);

/**
 * Paystack signs the raw webhook body with HMAC-SHA512 using the secret key.
 * The raw body must not be parsed before this check.
 */
export const verifyWebhookSignature = (rawBody, signature) => {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey || !signature) return false;

  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody || '');
  const expected = crypto
    .createHmac('sha512', secretKey)
    .update(body)
    .digest();
  let provided;
  try {
    provided = Buffer.from(String(signature).trim(), 'hex');
  } catch {
    return false;
  }

  return provided.length === expected.length &&
    crypto.timingSafeEqual(provided, expected);
};
