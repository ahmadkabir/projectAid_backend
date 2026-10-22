import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  amountToKobo,
  generatePaymentReference,
  verifyWebhookSignature,
  initializeTransaction,
  isPaystackConfigured
} from '../src/services/paystackService.js';

const SECRET = 'sk_test_unit_test_secret';

test('amountToKobo converts naira to integer kobo', () => {
  assert.equal(amountToKobo(1500), 150000);
  assert.equal(amountToKobo('2500.50'), 250050);
  assert.equal(amountToKobo(0.01), 1);
  assert.throws(() => amountToKobo(0), /Invalid payment amount/);
  assert.throws(() => amountToKobo('not-a-number'), /Invalid payment amount/);
});

test('generatePaymentReference is unique and tied to the order', () => {
  const first = generatePaymentReference(42);
  const second = generatePaymentReference(42);

  assert.match(first, /^PA-42-\d+-[a-f0-9]{8}$/);
  assert.notEqual(first, second);
});

test('verifyWebhookSignature accepts a valid HMAC-SHA512 signature', () => {
  process.env.PAYSTACK_SECRET_KEY = SECRET;
  const body = Buffer.from(JSON.stringify({ event: 'charge.success' }));
  const signature = crypto
    .createHmac('sha512', SECRET)
    .update(body)
    .digest('hex');

  assert.equal(verifyWebhookSignature(body, signature), true);
  assert.equal(verifyWebhookSignature(body, `${signature}00`), false);
  assert.equal(verifyWebhookSignature(body, 'not-hex'), false);
  assert.equal(verifyWebhookSignature(body, undefined), false);
  assert.equal(
    verifyWebhookSignature(Buffer.from('{"event":"charge.failed"}'), signature),
    false
  );
});

test('initializeTransaction sends the server-calculated amount', async () => {
  process.env.PAYSTACK_SECRET_KEY = SECRET;
  process.env.PAYSTACK_CURRENCY = 'NGN';
  assert.equal(isPaystackConfigured(), true);

  const originalFetch = globalThis.fetch;
  let requestUrl;
  let requestOptions;

  globalThis.fetch = async (url, options) => {
    requestUrl = url;
    requestOptions = options;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        status: true,
        data: {
          authorization_url: 'https://checkout.paystack.com/example',
          access_code: 'access-code',
          reference: 'PA-7-reference'
        }
      })
    };
  };

  try {
    const data = await initializeTransaction({
      email: 'student@example.com',
      amountKobo: 250050,
      reference: 'PA-7-reference',
      callbackUrl: 'http://localhost:5173/payment/callback',
      currency: 'NGN',
      metadata: { orderId: '7' }
    });

    assert.equal(requestUrl, 'https://api.paystack.co/transaction/initialize');
    assert.equal(requestOptions.method, 'POST');
    assert.equal(requestOptions.headers.Authorization, `Bearer ${SECRET}`);

    const body = JSON.parse(requestOptions.body);
    assert.equal(body.amount, 250050);
    assert.equal(body.email, 'student@example.com');
    assert.equal(body.currency, 'NGN');
    assert.equal(body.callback_url, 'http://localhost:5173/payment/callback');
    assert.deepEqual(body.metadata, { orderId: '7' });
    assert.equal(data.authorization_url, 'https://checkout.paystack.com/example');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('initializeTransaction fails clearly when Paystack is not configured', async () => {
  const originalKey = process.env.PAYSTACK_SECRET_KEY;
  delete process.env.PAYSTACK_SECRET_KEY;

  try {
    assert.equal(isPaystackConfigured(), false);
    await assert.rejects(
      () => initializeTransaction({
        email: 'student@example.com',
        amountKobo: 10000,
        reference: 'PA-1-reference'
      }),
      /Paystack is not configured/
    );
  } finally {
    if (originalKey === undefined) delete process.env.PAYSTACK_SECRET_KEY;
    else process.env.PAYSTACK_SECRET_KEY = originalKey;
  }
});
