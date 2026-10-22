import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeStatus,
  canTransition,
  hasActiveSoftware,
  saleModeOf,
  getPurchaseOptions,
  resolveItemPrice,
  entitledCategories,
  validateProjectForStatus
} from '../src/services/projectService.js';

const docsOnly = {
  id: 1,
  title: 'Library System',
  status: 'published',
  documentationPrice: '5000.00',
  price: '5000.00',
  softwarePrice: '0.00',
  fullProjectPrice: '0.00',
  projectType: 'documentation',
  softwareStatus: null
};

const included = {
  ...docsOnly,
  id: 2,
  projectType: 'software',
  softwareStatus: 'active',
  softwareName: 'Library Suite',
  softwareSaleMode: 'included',
  softwarePrice: '0.00'
};

const separate = {
  ...docsOnly,
  id: 3,
  projectType: 'software',
  softwareStatus: 'active',
  softwareName: 'Library Suite',
  softwareSaleMode: 'separate',
  softwarePrice: '3000.00',
  fullProjectPrice: '7000.00'
};

test('normalises legacy statuses', () => {
  assert.equal(normalizeStatus('active'), 'published');
  assert.equal(normalizeStatus('inactive'), 'archived');
  assert.equal(normalizeStatus('pending_review'), 'pending_review');
  assert.equal(normalizeStatus('nonsense'), null);
});

test('enforces lifecycle transitions', () => {
  assert.equal(canTransition('draft', 'pending_review'), true);
  assert.equal(canTransition('pending_review', 'published'), true);
  assert.equal(canTransition('published', 'draft'), false);
  assert.equal(canTransition('archived', 'published'), true);
});

test('derives software availability and sale mode', () => {
  assert.equal(hasActiveSoftware(docsOnly), false);
  assert.equal(saleModeOf(docsOnly), null);
  assert.equal(saleModeOf(included), 'included');
  assert.equal(saleModeOf(separate), 'separate');
  assert.equal(hasActiveSoftware({ ...separate, softwareStatus: 'archived' }), false);
});

test('legacy rows keep their implied sale mode', () => {
  const legacy = {
    ...docsOnly,
    softwareFile: 'legacy.zip',
    softwarePrice: '400.00',
    softwareStatus: null,
    softwareSaleMode: null
  };
  assert.equal(saleModeOf(legacy), 'separate');
});

test('offers a single inclusive option when software is included', () => {
  const options = getPurchaseOptions(included);
  assert.equal(options.length, 1);
  assert.equal(options[0].type, 'documentation');
  assert.equal(options[0].includesSoftware, true);
});

test('offers separate and bundled options when software is sold separately', () => {
  const options = getPurchaseOptions(separate);
  assert.deepEqual(options.map((option) => option.type), ['documentation', 'software', 'full']);
  assert.equal(options[1].price, 3000);
});

test('rejects buying included software on its own', () => {
  const result = resolveItemPrice(included, 'software', { hasDocumentationFile: true, hasInstaller: true });
  assert.equal(result.ok, false);
  assert.match(result.error, /included/i);
});

test('authoritative prices come from the project record', () => {
  assert.deepEqual(
    resolveItemPrice(separate, 'software', { hasDocumentationFile: true, hasInstaller: true }),
    { ok: true, price: 3000 }
  );
  assert.deepEqual(
    resolveItemPrice(docsOnly, 'documentation', { hasDocumentationFile: true, hasInstaller: false }),
    { ok: true, price: 5000 }
  );
  assert.equal(
    resolveItemPrice(docsOnly, 'documentation', { hasDocumentationFile: false, hasInstaller: false }).ok,
    false
  );
});

test('entitlements follow the purchased item and sale mode', () => {
  assert.deepEqual(entitledCategories(docsOnly, 'documentation'), ['documentation']);
  assert.deepEqual(entitledCategories(included, 'documentation'), ['documentation', 'software', 'guide']);
  assert.deepEqual(entitledCategories(separate, 'documentation'), ['documentation']);
  assert.deepEqual(entitledCategories(separate, 'software'), ['software', 'guide']);
  assert.deepEqual(entitledCategories(separate, 'full'), ['documentation', 'software', 'guide']);
});

test('publication requires documentation, an installer and a software price', () => {
  const base = {
    title: 'Test',
    description: 'Description',
    categoryId: 1,
    level: 'BSc',
    documentationPrice: 1000
  };

  const missingDocs = validateProjectForStatus({
    data: { ...base, softwareName: 'Suite', softwareSaleMode: 'separate', softwarePrice: 500 },
    status: 'published',
    hasDocumentationFile: false,
    hasInstaller: true,
    softwareEnabled: true
  });
  assert.ok(missingDocs.some((error) => /documentation/i.test(error)));

  const missingPrice = validateProjectForStatus({
    data: { ...base, softwareName: 'Suite', softwareSaleMode: 'separate', softwarePrice: 0, softwareRedistributionAllowed: false },
    status: 'published',
    hasDocumentationFile: true,
    hasInstaller: true,
    softwareEnabled: true
  });
  assert.ok(missingPrice.some((error) => /software price/i.test(error)));

  const valid = validateProjectForStatus({
    data: {
      ...base,
      softwareName: 'Suite',
      softwareSaleMode: 'separate',
      softwarePrice: 500,
      softwareRedistributionAllowed: false
    },
    status: 'published',
    hasDocumentationFile: true,
    hasInstaller: true,
    softwareEnabled: true
  });
  assert.deepEqual(valid, []);
});

test('legacy software-only records stay editable and publishable', () => {
  const errors = validateProjectForStatus({
    data: {
      title: 'Legacy software only',
      description: 'Sold as software without documentation',
      categoryId: 1,
      level: 'BSc',
      documentationPrice: 0,
      price: 0,
      softwareName: 'Legacy Suite',
      softwareSaleMode: 'separate',
      softwarePrice: 500,
      softwareRedistributionAllowed: false
    },
    status: 'published',
    hasDocumentationFile: false,
    hasInstaller: true,
    softwareEnabled: true
  });

  assert.deepEqual(errors, []);
});

test('drafts do not require files yet', () => {
  const errors = validateProjectForStatus({
    data: {
      title: 'Draft project',
      description: 'Work in progress',
      categoryId: 1,
      level: 'BSc',
      documentationPrice: 100
    },
    status: 'draft',
    hasDocumentationFile: false,
    hasInstaller: false,
    softwareEnabled: false
  });
  assert.deepEqual(errors, []);
});
