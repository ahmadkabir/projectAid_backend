import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  buildStorageKey,
  saveBuffer,
  readBuffer,
  statObject,
  deleteObject,
  getSignedDownloadUrl,
  getSignedUploadUrl,
  checksumOf,
  localPathForKey,
  __private
} from '../src/services/storageService.js';

test('builds unguessable keys without the browser supplied name', () => {
  const key = buildStorageKey({
    category: 'documentation',
    projectId: 42,
    originalName: 'final year project.pdf'
  });

  assert.match(key, /^documentation\/42\/\d+-[a-f0-9]{24}\.pdf$/);
  assert.ok(!key.includes('final year project'));
});

test('rejects unknown categories', () => {
  assert.throws(() =>
    buildStorageKey({ category: 'avatars', projectId: 1, originalName: 'a.pdf' })
  );
});

test('writes, reads and deletes a local object', async () => {
  const key = `test-tmp/${Date.now()}-${crypto.randomBytes(4).toString('hex')}.pdf`;
  const buffer = Buffer.from('%PDF-1.4 test');

  const saved = await saveBuffer(key, buffer, { contentType: 'application/pdf' });
  assert.equal(saved.size, buffer.length);
  assert.equal(saved.checksum, checksumOf(buffer));

  assert.deepEqual(await statObject(key), { exists: true, size: buffer.length });
  assert.deepEqual(await readBuffer(key), buffer);

  assert.equal(await deleteObject(key), true);
  assert.equal(await statObject(key), null);
});

test('local storage never resolves keys outside the uploads directory', () => {
  assert.throws(() => localPathForKey('../../etc/passwd'), /Invalid storage key/);
  assert.throws(() => localPathForKey('test-tmp/../../../tmp/evil.pdf'), /Invalid storage key/);
  assert.ok(localPathForKey('uploads/documentation/legacy.pdf').startsWith(__private.uploadsRoot));
});

test('generates short-lived signed S3 download and upload URLs', async () => {
  const previous = { ...process.env };
  const envNames = [
    'STORAGE_PROVIDER',
    'STORAGE_S3_ENDPOINT',
    'STORAGE_S3_REGION',
    'STORAGE_S3_BUCKET',
    'STORAGE_S3_ACCESS_KEY_ID',
    'STORAGE_S3_SECRET_ACCESS_KEY',
    'STORAGE_S3_FORCE_PATH_STYLE',
    'R2_ENDPOINT',
    'R2_BUCKET_NAME',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY'
  ];

  process.env.STORAGE_PROVIDER = 's3';
  process.env.STORAGE_S3_ENDPOINT = 'https://accountid.r2.cloudflarestorage.com';
  process.env.STORAGE_S3_REGION = 'auto';
  process.env.STORAGE_S3_BUCKET = 'projectaid-private';
  process.env.STORAGE_S3_ACCESS_KEY_ID = 'test-access-key';
  process.env.STORAGE_S3_SECRET_ACCESS_KEY = 'test-secret-key';
  process.env.STORAGE_S3_FORCE_PATH_STYLE = 'true';

  try {
    const downloadUrl = await getSignedDownloadUrl('documentation/1/abc.pdf', { expiresIn: 300 });
    assert.match(
      downloadUrl,
      /^https:\/\/accountid\.r2\.cloudflarestorage\.com\/projectaid-private\/documentation\/1\/abc\.pdf\?/
    );
    assert.match(downloadUrl, /X-Amz-Signature=[a-f0-9]{64}/);
    assert.match(downloadUrl, /X-Amz-Expires=300/);
    assert.match(downloadUrl, /X-Amz-Algorithm=AWS4-HMAC-SHA256/);
    assert.match(downloadUrl, /X-Amz-SignedHeaders=host/);

    const upload = await getSignedUploadUrl('documentation/1/abc.pdf', {
      contentType: 'application/pdf',
      expiresIn: 600
    });
    assert.match(upload.url, /X-Amz-Signature=[a-f0-9]{64}/);
    assert.match(upload.url, /X-Amz-Expires=600/);
    assert.equal(upload.headers['Content-Type'], 'application/pdf');
    assert.match(upload.url, /X-Amz-SignedHeaders=host/);
  } finally {
    for (const name of envNames) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }

  // Safe with the default local provider.
  assert.equal(await getSignedDownloadUrl('documentation/1/abc.pdf'), null);
  await assert.rejects(
    getSignedUploadUrl('documentation/1/abc.pdf', { contentType: 'application/pdf' }),
    /require the s3 storage provider/
  );
});
