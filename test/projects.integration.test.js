import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import './helpers/localStorage.js';
import app from '../src/app.js';
import sequelize from '../src/config/database.js';
import {
  User,
  Project,
  ProjectCategory,
  ProjectDocumentFile,
  Order,
  OrderItem
} from '../src/models/index.js';
import { deleteObject } from '../src/services/storageService.js';

/**
 * End-to-end API tests against the configured MySQL/MariaDB database.
 *
 * Each run uses unique users/categories and removes everything it created.
 */

let server;
let baseUrl;
let dbAvailable = false;
let admin;
let student;
let student2;
let category;
let createdCategoryId = null;

const tokens = {};
const projectIds = [];
const orderIds = [];
const userIds = [];
const storageKeys = [];

const pdf = (label) => Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Title (${label}) >>\nendobj\ntrailer\n<<>>\n%%EOF`);
const zip = (label) => Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from(label)]);

const tokenFor = (user) => jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

const auth = (who) => ({ Authorization: `Bearer ${tokens[who]}` });

const multipart = (fields, files = {}) => {
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') form.append(key, String(value));
  });
  Object.entries(files).forEach(([key, file]) => {
    if (!file) return;
    form.append(key, new Blob([file.buffer], { type: file.mime }), file.name);
  });
  return form;
};

const request = async (path, { method = 'GET', who, body, form } = {}) => {
  const headers = who ? auth(who) : {};
  const options = { method, headers };

  if (form) {
    options.body = form;
  } else if (body !== undefined) {
    options.headers = { ...headers, 'Content-Type': 'application/json' };
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${baseUrl}${path}`, options);
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : Buffer.from(await response.arrayBuffer());

  return { status: response.status, body: payload, contentType };
};

const trackProject = (project) => {
  if (!project) return project;
  if (!projectIds.includes(project.id)) projectIds.push(project.id);
  (project.files || []).forEach((file) => {
    if (file.storageKey) storageKeys.push(file.storageKey);
  });
  return project;
};

const createProject = async (fields, files) => {
  const response = await request('/api/projects', {
    method: 'POST',
    who: 'admin',
    form: multipart(fields, files)
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  return trackProject(response.body.project);
};

const adminProject = async (id) => {
  const response = await request(`/api/projects/${id}`, { who: 'admin' });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return trackProject(response.body.project);
};

const purchase = async (who, projectId, itemType, { pay = true } = {}) => {
  const created = await request('/api/orders', {
    method: 'POST',
    who,
    body: { items: [{ projectId, itemType }] }
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  orderIds.push(created.body.order.id);

  if (pay) {
    const paid = await request(`/api/orders/${created.body.order.id}/payment`, {
      method: 'POST',
      who,
      body: { paymentMethod: 'mock_payment' }
    });
    assert.equal(paid.status, 200, JSON.stringify(paid.body));
  }

  return created.body.order;
};

const download = (who, fileId) => request(`/api/files/${fileId}/download`, { who });

before(async () => {
  try {
    await sequelize.authenticate();
    dbAvailable = true;
  } catch (error) {
    console.warn(`Integration tests skipped: database unavailable (${error.message})`);
    return;
  }

  server = app.listen(0);
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const suffix = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

  admin = await User.create({
    name: 'Integration Admin',
    email: `integration-admin-${suffix}@projectaid.test`,
    password: 'test-password-123',
    role: 'admin',
    emailVerified: true
  });
  student = await User.create({
    name: 'Integration Student',
    email: `integration-student-${suffix}@projectaid.test`,
    password: 'test-password-123',
    role: 'student',
    emailVerified: true
  });
  student2 = await User.create({
    name: 'Integration Student Two',
    email: `integration-student2-${suffix}@projectaid.test`,
    password: 'test-password-123',
    role: 'student',
    emailVerified: true
  });
  userIds.push(admin.id, student.id, student2.id);

  tokens.admin = tokenFor(admin);
  tokens.student = tokenFor(student);
  tokens.student2 = tokenFor(student2);

  category = await ProjectCategory.findOne({ where: { name: 'Computer Science' } });
  if (!category) {
    category = await ProjectCategory.create({ name: `Integration Course ${suffix}` });
    createdCategoryId = category.id;
  }
});

const skipWithoutDb = (t) => {
  if (!dbAvailable) {
    t.skip('database not available');
    return true;
  }
  return false;
};

const baseFields = (title, overrides = {}) => ({
  title,
  description: `${title} description for integration testing.`,
  course: category.id,
  level: 'BSc',
  price: 1500,
  ...overrides
});

test('1. create a documentation-only project, keep it out of the catalogue until published', async (t) => {
  if (skipWithoutDb(t)) return;

  const project = await createProject(
    baseFields(`Docs Only ${Date.now()}`, { status: 'draft' }),
    { documentationFile: { name: 'project.pdf', mime: 'application/pdf', buffer: pdf('v1') } }
  );

  assert.equal(project.status, 'draft');
  assert.equal(project.hasSoftware, false);
  assert.equal(project.documentationFiles.length, 1);

  const publicList = await request(`/api/projects?search=${encodeURIComponent(project.title)}`);
  assert.equal(publicList.body.total, 0, 'drafts must not be visible to visitors');

  const detail = await request(`/api/projects/${project.id}`, { who: 'student' });
  assert.equal(detail.status, 404);

  const submitted = await request(`/api/projects/${project.id}/status`, {
    method: 'PATCH',
    who: 'admin',
    body: { status: 'pending_review' }
  });
  assert.equal(submitted.status, 200);

  const published = await request(`/api/projects/${project.id}/status`, {
    method: 'PATCH',
    who: 'admin',
    body: { status: 'published' }
  });
  assert.equal(published.status, 200);
  assert.equal(published.body.project.status, 'published');

  const visible = await request(`/api/projects?search=${encodeURIComponent(project.title)}`);
  assert.equal(visible.body.total, 1, 'published project must appear publicly');

  t.diagnostic(`docs-only project ${project.id} published`);
});

test('2. create a project with documentation and included software', async (t) => {
  if (skipWithoutDb(t)) return;

  const project = await createProject(
    baseFields(`Docs And Software ${Date.now()}`, {
      status: 'published',
      price: 2500,
      hasSoftware: 'true',
      softwareName: 'Integration Suite',
      softwareVersion: '2.1.0',
      softwareDescription: 'Companion application',
      softwareOperatingSystem: 'Windows 10+, Ubuntu 22.04',
      softwareRequirements: '4 GB RAM, 2 GB disk',
      softwareLicense: 'Single-user academic licence',
      softwareRedistributionAllowed: 'false',
      softwareSaleMode: 'included'
    }),
    {
      documentationFile: { name: 'project.pdf', mime: 'application/pdf', buffer: pdf('docs') },
      softwareInstaller: { name: 'suite.zip', mime: 'application/zip', buffer: zip('installer') },
      softwareGuide: { name: 'guide.pdf', mime: 'application/pdf', buffer: pdf('guide') }
    }
  );

  assert.equal(project.status, 'published');
  assert.equal(project.hasSoftware, true);
  assert.equal(project.softwareFiles.length, 1);
  assert.equal(project.guideFiles.length, 1);
  assert.equal(project.softwareRedistributionAllowed, false);
  assert.equal(project.purchaseOptions.length, 1);
  assert.equal(project.purchaseOptions[0].includesSoftware, true);
  assert.equal(Number(project.purchaseOptions[0].price), 2500);

  t.diagnostic(`included-software project ${project.id} created`);
});

test('3. add software to a documentation-only project later', async (t) => {
  if (skipWithoutDb(t)) return;

  const project = await createProject(baseFields(`Add Software Later ${Date.now()}`, { status: 'published' }), {
    documentationFile: { name: 'project.pdf', mime: 'application/pdf', buffer: pdf('docs') }
  });
  assert.equal(project.hasSoftware, false);

  const added = await request(`/api/projects/${project.id}/software`, {
    method: 'POST',
    who: 'admin',
    form: multipart(
      {
        hasSoftware: 'true',
        softwareName: 'Later Suite',
        softwareVersion: '1.0.0',
        softwareSaleMode: 'separate',
        softwarePrice: 800,
        softwareRequirements: 'Windows 11',
        softwareLicense: 'Commercial',
        softwareRedistributionAllowed: 'true'
      },
      {
        softwareInstaller: { name: 'later.zip', mime: 'application/zip', buffer: zip('later') },
        softwareGuide: { name: 'later-guide.pdf', mime: 'application/pdf', buffer: pdf('later guide') }
      }
    )
  });

  assert.equal(added.status, 200, JSON.stringify(added.body));
  const updated = trackProject(added.body.project);
  assert.equal(updated.hasSoftware, true);
  assert.equal(updated.projectType, 'software');
  assert.equal(updated.softwareSaleMode, 'separate');
  assert.equal(Number(updated.softwarePrice), 800);
  assert.deepEqual(updated.purchaseOptions.map((option) => option.type), ['documentation', 'software']);

  t.diagnostic(`software added to project ${updated.id}`);
});

test('4. edit project information without touching the documentation', async (t) => {
  if (skipWithoutDb(t)) return;

  const project = await createProject(baseFields(`Edit Info ${Date.now()}`, { status: 'published' }), {
    documentationFile: { name: 'keep.pdf', mime: 'application/pdf', buffer: pdf('keep') }
  });
  const originalFileId = project.documentationFiles[0].id;

  const response = await request(`/api/projects/${project.id}`, {
    method: 'PUT',
    who: 'admin',
    form: multipart({ title: `${project.title} (revised)`, description: 'Updated description', price: 1750 })
  });

  assert.equal(response.status, 200, JSON.stringify(response.body));
  const updated = trackProject(response.body.project);
  assert.equal(updated.title, `${project.title} (revised)`);
  assert.equal(updated.documentationFiles.length, 1);
  assert.equal(updated.documentationFiles[0].id, originalFileId);
  assert.equal(updated.documentationFiles[0].isCurrent, true);
  assert.equal(Number(updated.documentationPrice), 1750);
});

test('5. replace documentation and software files without deleting history', async (t) => {
  if (skipWithoutDb(t)) return;

  const project = await createProject(
    baseFields(`Replace Files ${Date.now()}`, {
      status: 'published',
      hasSoftware: 'true',
      softwareName: 'Replaceable Suite',
      softwareSaleMode: 'separate',
      softwarePrice: 600,
      softwareRedistributionAllowed: 'false'
    }),
    {
      documentationFile: { name: 'v1.pdf', mime: 'application/pdf', buffer: pdf('v1') },
      softwareInstaller: { name: 'v1.zip', mime: 'application/zip', buffer: zip('v1') }
    }
  );

  const oldDocId = project.documentationFiles[0].id;
  const oldInstallerId = project.softwareFiles[0].id;

  const replacedDoc = await request(`/api/projects/${project.id}/documentation`, {
    method: 'POST',
    who: 'admin',
    form: multipart({}, {
      documentationFile: { name: 'v2.pdf', mime: 'application/pdf', buffer: pdf('v2') }
    })
  });
  assert.equal(replacedDoc.status, 201, JSON.stringify(replacedDoc.body));
  storageKeys.push(replacedDoc.body.file.storageKey);

  const replacedSoftware = await request(`/api/projects/${project.id}/software`, {
    method: 'POST',
    who: 'admin',
    form: multipart(
      { softwareName: 'Replaceable Suite', softwareSaleMode: 'separate', softwarePrice: 650 },
      { softwareInstaller: { name: 'v2.zip', mime: 'application/zip', buffer: zip('v2') } }
    )
  });
  assert.equal(replacedSoftware.status, 200, JSON.stringify(replacedSoftware.body));

  const updated = trackProject(replacedSoftware.body.project);
  assert.equal(updated.documentationFiles.length, 1, 'only one current documentation file');
  assert.notEqual(updated.documentationFiles[0].id, oldDocId);
  assert.equal(updated.softwareFiles.length, 1);
  assert.notEqual(updated.softwareFiles[0].id, oldInstallerId);

  const supersededDoc = updated.files.find((file) => file.id === oldDocId);
  const supersededInstaller = updated.files.find((file) => file.id === oldInstallerId);
  assert.equal(supersededDoc.isCurrent, false);
  assert.equal(supersededInstaller.isCurrent, false);
  assert.ok(supersededDoc.supersededAt);
});

test('6. public detail hides superseded files and exposes the software offer', async (t) => {
  if (skipWithoutDb(t)) return;

  const project = await createProject(
    baseFields(`Public Shape ${Date.now()}`, {
      status: 'published',
      hasSoftware: 'true',
      softwareName: 'Public Suite',
      softwareSaleMode: 'included',
      softwareRedistributionAllowed: 'false'
    }),
    {
      documentationFile: { name: 'docs.pdf', mime: 'application/pdf', buffer: pdf('public') },
      softwareInstaller: { name: 'public.zip', mime: 'application/zip', buffer: zip('public') },
      softwareGuide: { name: 'public-guide.pdf', mime: 'application/pdf', buffer: pdf('public guide') }
    }
  );

  const detail = await request(`/api/projects/${project.id}`, { who: 'student' });
  assert.equal(detail.status, 200);
  assert.equal(detail.body.project.hasSoftware, true);
  assert.equal(detail.body.project.softwareName, 'Public Suite');
  assert.equal(detail.body.project.files.every((file) => !('storageKey' in file)), true);
  assert.equal(detail.body.project.files.every((file) => file.isCurrent), true);
});

test('7. customers can only download what they paid for', async (t) => {
  if (skipWithoutDb(t)) return;

  const project = await createProject(baseFields(`Download Rules ${Date.now()}`, { status: 'published' }), {
    documentationFile: { name: 'rules.pdf', mime: 'application/pdf', buffer: pdf('rules') }
  });
  const fileId = project.documentationFiles[0].id;

  const order = await purchase('student', project.id, 'documentation', { pay: false });
  assert.equal(order.status, 'pending');

  const beforePayment = await download('student', fileId);
  assert.equal(beforePayment.status, 403, 'pending orders must not unlock downloads');

  const payment = await request(`/api/orders/${order.id}/payment`, {
    method: 'POST',
    who: 'student',
    body: { paymentMethod: 'mock_payment' }
  });
  assert.equal(payment.status, 200);

  const afterPayment = await download('student', fileId);
  assert.equal(afterPayment.status, 200);
  assert.equal(afterPayment.contentType, 'application/pdf');
  assert.match(afterPayment.body.subarray(0, 5).toString(), /%PDF/);

  const guessed = await download('student2', fileId);
  assert.equal(guessed.status, 403, 'other customers cannot download by guessing the id');

  const orders = await request('/api/orders', { who: 'student' });
  assert.equal(orders.status, 200);
  const item = orders.body.orders
    .flatMap((entry) => entry.items)
    .find((entry) => entry.projectId === project.id);
  assert.deepEqual(item.downloadableFiles.map((file) => file.id), [fileId]);
});

test('8. included and separately sold software are handled differently', async (t) => {
  if (skipWithoutDb(t)) return;

  const includedProject = await createProject(
    baseFields(`Included Download ${Date.now()}`, {
      status: 'published',
      hasSoftware: 'true',
      softwareName: 'Included Suite',
      softwareSaleMode: 'included',
      softwareRedistributionAllowed: 'false'
    }),
    {
      documentationFile: { name: 'docs.pdf', mime: 'application/pdf', buffer: pdf('included docs') },
      softwareInstaller: { name: 'included.zip', mime: 'application/zip', buffer: zip('included') },
      softwareGuide: { name: 'included-guide.pdf', mime: 'application/pdf', buffer: pdf('included guide') }
    }
  );

  await purchase('student', includedProject.id, 'documentation');
  const includedInstaller = includedProject.softwareFiles[0].id;
  const includedGuide = includedProject.guideFiles[0].id;

  assert.equal((await download('student', includedInstaller)).status, 200);
  assert.equal((await download('student', includedGuide)).status, 200);

  // Software cannot be bought on its own when it is included.
  const separateIncludedOrder = await request('/api/orders', {
    method: 'POST',
    who: 'student',
    body: { items: [{ projectId: includedProject.id, itemType: 'software' }] }
  });
  assert.equal(separateIncludedOrder.status, 400);

  const separateProject = await createProject(
    baseFields(`Separate Download ${Date.now()}`, {
      status: 'published',
      price: 2000,
      hasSoftware: 'true',
      softwareName: 'Separate Suite',
      softwareSaleMode: 'separate',
      softwarePrice: 700,
      fullProjectPrice: 2400,
      softwareRedistributionAllowed: 'true'
    }),
    {
      documentationFile: { name: 'docs.pdf', mime: 'application/pdf', buffer: pdf('separate docs') },
      softwareInstaller: { name: 'separate.zip', mime: 'application/zip', buffer: zip('separate') }
    }
  );

  const docFileId = separateProject.documentationFiles[0].id;
  const softwareFileId = separateProject.softwareFiles[0].id;

  await purchase('student2', separateProject.id, 'documentation');
  assert.equal((await download('student2', docFileId)).status, 200);
  assert.equal((await download('student2', softwareFileId)).status, 403);

  await purchase('student2', separateProject.id, 'software');
  assert.equal((await download('student2', softwareFileId)).status, 200);

  // The documentation purchase is still honoured after buying software.
  assert.equal((await download('student2', docFileId)).status, 200);

  // Checkout prices come from the project, not the client.
  const order = await purchase('student', separateProject.id, 'full');
  assert.equal(Number(order.totalAmount), 2400);
});

test('9. archiving software keeps the documentation and prior purchases', async (t) => {
  if (skipWithoutDb(t)) return;

  const project = await createProject(
    baseFields(`Archive Software ${Date.now()}`, {
      status: 'published',
      hasSoftware: 'true',
      softwareName: 'Archive Suite',
      softwareSaleMode: 'separate',
      softwarePrice: 500,
      softwareRedistributionAllowed: 'false'
    }),
    {
      documentationFile: { name: 'docs.pdf', mime: 'application/pdf', buffer: pdf('archive docs') },
      softwareInstaller: { name: 'archive.zip', mime: 'application/zip', buffer: zip('archive') }
    }
  );

  const softwareFileId = project.softwareFiles[0].id;
  const docFileId = project.documentationFiles[0].id;

  await purchase('student', project.id, 'software');

  const archived = await request(`/api/projects/${project.id}/software`, {
    method: 'DELETE',
    who: 'admin'
  });
  assert.equal(archived.status, 200, JSON.stringify(archived.body));
  const updated = trackProject(archived.body.project);

  assert.equal(updated.hasSoftware, false);
  assert.equal(updated.projectType, 'documentation');
  assert.equal(updated.documentationFiles.length, 1);
  assert.equal(updated.documentationFiles[0].id, docFileId);
  assert.equal(updated.softwareFiles.length, 1, 'installer is archived, not deleted');
  assert.equal(updated.files.find((file) => file.id === softwareFileId).isCurrent, true);

  // A prior software purchase still works and the project can be bought for docs.
  assert.equal((await download('student', softwareFileId)).status, 200);
  await purchase('student', project.id, 'documentation');
});

test('10. archived resources disappear from the catalogue but keep history', async (t) => {
  if (skipWithoutDb(t)) return;

  const project = await createProject(baseFields(`Archive Resource ${Date.now()}`, { status: 'published' }), {
    documentationFile: { name: 'docs.pdf', mime: 'application/pdf', buffer: pdf('archive resource') }
  });
  const fileId = project.documentationFiles[0].id;

  await purchase('student', project.id, 'documentation');

  const archived = await request(`/api/projects/${project.id}/status`, {
    method: 'PATCH',
    who: 'admin',
    body: { status: 'archived' }
  });
  assert.equal(archived.status, 200, JSON.stringify(archived.body));

  const publicSearch = await request(`/api/projects?search=${encodeURIComponent(project.title)}`);
  assert.equal(publicSearch.body.total, 0);

  const publicDetail = await request(`/api/projects/${project.id}`, { who: 'student' });
  assert.equal(publicDetail.status, 404);

  const adminSearch = await request(
    `/api/projects?search=${encodeURIComponent(project.title)}&status=archived`,
    { who: 'admin' }
  );
  assert.equal(adminSearch.body.total, 1);

  // Existing purchase history is preserved.
  assert.equal((await download('student', fileId)).status, 200);

  const cannotBuy = await request('/api/orders', {
    method: 'POST',
    who: 'student2',
    body: { items: [{ projectId: project.id, itemType: 'documentation' }] }
  });
  assert.equal(cannotBuy.status, 400);
});

test('11. existing accounts, login and order history still work', async (t) => {
  if (skipWithoutDb(t)) return;

  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { email: student.email, password: 'test-password-123' }
  });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  assert.equal(login.body.user.email, student.email);

  const orders = await request('/api/orders', { who: 'student' });
  assert.equal(orders.status, 200);
  assert.ok(orders.body.orders.length > 0);
  assert.ok(orders.body.orders.every((order) => Array.isArray(order.items)));

  const allOrders = await request('/api/orders/all?limit=5', { who: 'admin' });
  assert.equal(allOrders.status, 200);
  assert.equal(allOrders.body.success, true);

  const dashboard = await request('/api/analytics/dashboard?range=30d', { who: 'admin' });
  assert.equal(dashboard.status, 200);
});

test('12. paystack initialize, verify and signed webhook complete an order once', async (t) => {
  if (skipWithoutDb(t)) return;

  const originalKey = process.env.PAYSTACK_SECRET_KEY;
  const originalCurrency = process.env.PAYSTACK_CURRENCY;
  const realFetch = globalThis.fetch;
  const secret = 'sk_test_integration_secret';
  process.env.PAYSTACK_SECRET_KEY = secret;
  process.env.PAYSTACK_CURRENCY = 'NGN';

  const fakePaystackResponse = (data) => ({
    ok: true,
    status: 200,
    json: async () => ({ status: true, data })
  });

  let reference = '';

  globalThis.fetch = async (url, options) => {
    const target = String(url);

    if (target.includes('/transaction/initialize')) {
      const body = JSON.parse(options.body);
      reference = body.reference;
      return fakePaystackResponse({
        authorization_url: 'https://checkout.paystack.com/integration-test',
        access_code: 'integration-access-code',
        reference
      });
    }

    if (target.includes('/transaction/verify/')) {
      return fakePaystackResponse({
        status: 'success',
        reference,
        amount: orderAmountKobo,
        currency: 'NGN',
        metadata: { orderId: String(order.id), userId: String(student.id) }
      });
    }

    return realFetch(url, options);
  };

  let order;
  let orderAmountKobo;

  try {
    const project = await createProject(
      baseFields(`Paystack Resource ${Date.now()}`, { status: 'published' }),
      {
        documentationFile: {
          name: 'paystack-docs.pdf',
          mime: 'application/pdf',
          buffer: pdf('paystack resource')
        }
      }
    );

    const created = await request('/api/orders', {
      method: 'POST',
      who: 'student',
      body: { items: [{ projectId: project.id, itemType: 'documentation' }] }
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    order = created.body.order;
    orderAmountKobo = Math.round(Number(order.totalAmount) * 100);

    const initialized = await request(`/api/orders/${order.id}/pay`, {
      method: 'POST',
      who: 'student'
    });
    assert.equal(initialized.status, 200, JSON.stringify(initialized.body));
    assert.equal(initialized.body.authorizationUrl, 'https://checkout.paystack.com/integration-test');
    assert.equal(initialized.body.reference, reference);

    const verified = await request(
      `/api/orders/payment-status?reference=${encodeURIComponent(reference)}`,
      { who: 'student' }
    );
    assert.equal(verified.status, 200, JSON.stringify(verified.body));
    assert.equal(verified.body.paymentStatus, 'success');
    assert.equal(verified.body.order.status, 'completed');
    assert.equal(verified.body.order.paymentMethod, 'paystack');

    // A second order is completed by a signed charge.success webhook.
    const webhookProject = await createProject(
      baseFields(`Webhook Resource ${Date.now()}`, { status: 'published' }),
      {
        documentationFile: {
          name: 'webhook-docs.pdf',
          mime: 'application/pdf',
          buffer: pdf('webhook resource')
        }
      }
    );

    const webhookOrderResponse = await request('/api/orders', {
      method: 'POST',
      who: 'student',
      body: { items: [{ projectId: webhookProject.id, itemType: 'documentation' }] }
    });
    assert.equal(webhookOrderResponse.status, 201);
    const webhookOrder = webhookOrderResponse.body.order;
    const webhookReference = `PA-WEBHOOK-${Date.now()}`;
    const rawBody = JSON.stringify({
      event: 'charge.success',
      data: {
        reference: webhookReference,
        status: 'success',
        amount: Math.round(Number(webhookOrder.totalAmount) * 100),
        currency: 'NGN',
        metadata: { orderId: String(webhookOrder.id), userId: String(student.id) }
      }
    });
    const signature = crypto
      .createHmac('sha512', secret)
      .update(rawBody)
      .digest('hex');

    const invalid = await realFetch(`${baseUrl}/api/payments/paystack/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-paystack-signature': 'bad-signature' },
      body: rawBody
    });
    assert.equal(invalid.status, 401);

    const webhook = await realFetch(`${baseUrl}/api/payments/paystack/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-paystack-signature': signature },
      body: rawBody
    });
    assert.equal(webhook.status, 200);

    const paidWebhookOrder = await Order.findByPk(webhookOrder.id);
    assert.equal(paidWebhookOrder.status, 'completed');
    assert.equal(paidWebhookOrder.paymentMethod, 'paystack');
    assert.equal(paidWebhookOrder.transactionId, webhookReference);

    const duplicate = await realFetch(`${baseUrl}/api/payments/paystack/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-paystack-signature': signature },
      body: rawBody
    });
    assert.equal(duplicate.status, 200);
    const duplicatePayload = await duplicate.json();
    assert.equal(duplicatePayload.alreadyProcessed, true);
  } finally {
    globalThis.fetch = realFetch;
    if (originalKey === undefined) delete process.env.PAYSTACK_SECRET_KEY;
    else process.env.PAYSTACK_SECRET_KEY = originalKey;
    if (originalCurrency === undefined) delete process.env.PAYSTACK_CURRENCY;
    else process.env.PAYSTACK_CURRENCY = originalCurrency;
  }
});

// Cleanup runs as the final test so the HTTP server and database are closed
// deterministically even if an earlier assertion failed.
test('13. clean up test data', async (t) => {
  if (skipWithoutDb(t)) return;

  // Tests 7/8 order real seeded projects with test students, so items must be
  // removed by the orders they belong to — deleting orders first leaves
  // orphaned order_items that inflate the admin purchase metrics.
  const doomedOrderIds = await Order.findAll({ where: { userId: userIds }, attributes: ['id'] });
  await OrderItem.destroy({ where: { orderId: doomedOrderIds.map((order) => order.id) } });
  await OrderItem.destroy({ where: { projectId: projectIds } });
  await Order.destroy({ where: { userId: userIds } });
  await Project.destroy({ where: { id: projectIds } });
  await ProjectDocumentFile.destroy({ where: { projectId: projectIds } });
  await User.destroy({ where: { id: userIds } });
  if (createdCategoryId) {
    await ProjectCategory.destroy({ where: { id: createdCategoryId } });
  }

  await Promise.all(storageKeys.map((key) => deleteObject(key).catch(() => {})));

  // fetch keeps keep-alive sockets open; close them so the runner exits.
  server.closeAllConnections?.();
  await new Promise((resolve) => server.close(resolve));
  await sequelize.close();
});
