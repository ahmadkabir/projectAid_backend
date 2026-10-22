import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateFileBytes,
  validateUploadMetadata,
  FILE_RULES,
  formatBytes
} from '../src/services/fileValidation.js';
import { isKeyInNamespace, buildStorageKey } from '../src/services/storageService.js';
import { createUploadTicket } from '../src/services/directUploadService.js';

const PDF_HEADER = Buffer.from('%PDF-1.7\n...rest of the document...');

test('metadata validation rejects unsafe names, wrong types and oversized files', () => {
  const valid = validateUploadMetadata(
    { originalName: 'Project Report.pdf', mimeType: 'application/pdf', size: 2048 },
    'documentation'
  );
  assert.equal(valid.ok, true);
  assert.equal(valid.meta.fileType, 'pdf');
  assert.equal(valid.meta.size, 2048);

  assert.equal(
    validateUploadMetadata(
      { originalName: '../../etc/passwd.pdf', mimeType: 'application/pdf', size: 10 },
      'documentation'
    ).ok,
    false
  );

  assert.equal(
    validateUploadMetadata(
      { originalName: 'installer.exe', mimeType: 'application/octet-stream', size: 10 },
      'software'
    ).ok,
    false
  );

  assert.equal(
    validateUploadMetadata(
      { originalName: 'report.pdf', mimeType: 'text/html', size: 10 },
      'documentation'
    ).ok,
    false
  );

  assert.match(
    validateUploadMetadata(
      {
        originalName: 'report.pdf',
        mimeType: 'application/pdf',
        size: FILE_RULES.documentation.maxSize + 1
      },
      'documentation'
    ).error,
    /too large/
  );

  assert.equal(
    validateUploadMetadata({ originalName: 'empty.pdf', mimeType: 'application/pdf', size: 0 }, 'documentation')
      .ok,
    false
  );
});

test('byte validation detects executables disguised as documents', () => {
  const meta = validateUploadMetadata(
    { originalName: 'report.pdf', mimeType: 'application/pdf', size: 10 },
    'documentation'
  ).meta;

  assert.equal(validateFileBytes(PDF_HEADER, meta, 'documentation').ok, true);

  const exe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
  const result = validateFileBytes(
    exe,
    { ...meta, size: exe.length },
    'documentation'
  );
  assert.equal(result.ok, false);
  assert.match(result.error, /executable/);

  const notAPdf = Buffer.from('just some text pretending to be a pdf');
  assert.equal(validateFileBytes(notAPdf, { ...meta, size: notAPdf.length }, 'documentation').ok, false);
});

test('sniffs a DOCX zip container correctly', () => {
  const docxPrefix = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    Buffer.from('.....[Content_Types].xml....word/document.xml')
  ]);
  const meta = validateUploadMetadata(
    {
      originalName: 'chapter.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: docxPrefix.length
    },
    'documentation'
  ).meta;

  const result = validateFileBytes(docxPrefix, meta, 'documentation');
  assert.equal(result.ok, true);
  assert.equal(result.meta.fileType, 'docx');
});

test('storage keys are namespaced per project and category', () => {
  const key = buildStorageKey({
    category: 'software',
    projectId: 12,
    originalName: 'app.zip'
  });

  assert.equal(isKeyInNamespace(key, { category: 'software', projectId: 12 }), true);
  assert.equal(isKeyInNamespace(key, { category: 'software', projectId: 13 }), false);
  assert.equal(isKeyInNamespace(key, { category: 'documentation', projectId: 12 }), false);
  assert.equal(isKeyInNamespace('documentation/12/../13/evil.pdf', { category: 'documentation', projectId: 12 }), false);
  assert.equal(isKeyInNamespace('../../metadata/12/x.pdf', { category: 'documentation', projectId: 12 }), false);
});

test('upload tickets are presigned, namespaced and size limited', async () => {
  const previous = { ...process.env };
  const envNames = [
    'STORAGE_PROVIDER',
    'STORAGE_S3_ENDPOINT',
    'STORAGE_S3_REGION',
    'STORAGE_S3_BUCKET',
    'STORAGE_S3_ACCESS_KEY_ID',
    'STORAGE_S3_SECRET_ACCESS_KEY',
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

  try {
    const ticket = await createUploadTicket({
      projectId: 7,
      category: 'documentation',
      originalName: 'Final Report.pdf',
      mimeType: 'application/pdf',
      size: 4096
    });

    assert.match(ticket.storageKey, /^documentation\/7\/\d+-[a-f0-9]{24}\.pdf$/);
    assert.match(ticket.uploadUrl, /X-Amz-Signature=[a-f0-9]{64}/);
    assert.equal(ticket.category, 'documentation');
    assert.equal(ticket.headers['Content-Type'], 'application/pdf');
    assert.equal(ticket.maxSize, FILE_RULES.documentation.maxSize);

    await assert.rejects(
      createUploadTicket({
        projectId: 7,
        category: 'documentation',
        originalName: 'Final Report.pdf',
        mimeType: 'application/pdf',
        size: FILE_RULES.documentation.maxSize + 1
      }),
      new RegExp(`max ${formatBytes(FILE_RULES.documentation.maxSize).replace(/\./g, '\\.')}`)
    );

    await assert.rejects(
      createUploadTicket({
        projectId: 7,
        category: 'documentation',
        originalName: 'Final Report.exe',
        mimeType: 'application/octet-stream',
        size: 100
      }),
      /must be one of/
    );
  } finally {
    for (const name of envNames) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});
