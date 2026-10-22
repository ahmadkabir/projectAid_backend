import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateUploadedFile,
  sniffKind,
  MAX_DOCUMENTATION_SIZE
} from '../src/services/fileValidation.js';

const pdfBuffer = (label = 'v1') =>
  Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Title (${label}) >>\nendobj\n%%EOF`);

const zipBuffer = () =>
  Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('payload')]);

const docxBuffer = () =>
  Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    Buffer.from('[Content_Types].xml word/document.xml')
  ]);

const upload = (name, mime, buffer, size) => ({
  originalname: name,
  mimetype: mime,
  buffer,
  size: size ?? buffer.length
});

test('sniffs the real container type instead of trusting the name', () => {
  assert.equal(sniffKind(pdfBuffer()), 'pdf');
  assert.equal(sniffKind(zipBuffer()), 'zip');
  assert.equal(sniffKind(docxBuffer()), 'docx');
  assert.equal(sniffKind(Buffer.from([0x4d, 0x5a, 0x90, 0x00])), 'executable');
});

test('accepts a valid PDF as project documentation', () => {
  const result = validateUploadedFile(
    upload('project.pdf', 'application/pdf', pdfBuffer()),
    'documentation'
  );

  assert.equal(result.ok, true);
  assert.equal(result.meta.fileType, 'pdf');
  assert.equal(result.meta.mimeType, 'application/pdf');
});

test('accepts PDF and DOCX documentation', () => {
  assert.equal(
    validateUploadedFile(upload('guide.pdf', 'application/pdf', pdfBuffer()), 'guide').ok,
    true
  );
  assert.equal(
    validateUploadedFile(
      upload(
        'guide.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        docxBuffer()
      ),
      'guide'
    ).ok,
    true
  );
});

test('rejects executables and renamed binaries', () => {
  const exe = validateUploadedFile(
    upload('installer.zip', 'application/zip', Buffer.from([0x4d, 0x5a, 0x90, 0x00])),
    'software'
  );
  assert.equal(exe.ok, false);
  assert.match(exe.error, /executable|does not match/i);

  const disguised = validateUploadedFile(
    upload('documentation.pdf', 'application/pdf', zipBuffer()),
    'documentation'
  );
  assert.equal(disguised.ok, false);
  assert.match(disguised.error, /does not match/i);
});

test('rejects unsupported extensions and MIME types', () => {
  const exeName = validateUploadedFile(
    upload('malware.exe', 'application/octet-stream', zipBuffer()),
    'software'
  );
  assert.equal(exeName.ok, false);

  const wrongMime = validateUploadedFile(
    upload('documentation.pdf', 'text/html', pdfBuffer()),
    'documentation'
  );
  assert.equal(wrongMime.ok, false);
});

test('enforces the configured size limit', () => {
  const tooLarge = validateUploadedFile(
    upload('documentation.pdf', 'application/pdf', pdfBuffer(), MAX_DOCUMENTATION_SIZE + 1),
    'documentation'
  );
  assert.equal(tooLarge.ok, false);
  assert.match(tooLarge.error, /too large/i);
});

test('rejects traversal in the browser supplied name', () => {
  const traversal = validateUploadedFile(
    upload('../../etc/passwd.pdf', 'application/pdf', pdfBuffer()),
    'documentation'
  );
  assert.equal(traversal.ok, false);
});

test('accepts ZIP archives as software installers', () => {
  const result = validateUploadedFile(
    upload('software.zip', 'application/zip', zipBuffer()),
    'software'
  );
  assert.equal(result.ok, true);
  assert.equal(result.meta.fileType, 'zip');
});
