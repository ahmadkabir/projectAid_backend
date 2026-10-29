import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  connectDatabase,
  disconnectDatabase,
  getDatabaseTarget,
  redactUri,
  hintForMongoError,
  hasTransactionSupport
} from '../src/config/mongo.js';
import {
  User,
  ProjectCategory,
  Project,
  Order,
  ProjectDocumentFile,
  SupportRequest
} from '../src/models/index.js';

test('Database Configuration Module', async (t) => {
  await t.test('redacts passwords in connection URIs', () => {
    const raw = 'mongodb+srv://admin_user:SuperSecretPassword123@cluster.mongodb.net/testdb';
    const redacted = redactUri(raw);
    assert.ok(!redacted.includes('SuperSecretPassword123'));
    assert.ok(redacted.includes('admin_user:***@cluster.mongodb.net'));
  });

  await t.test('provides clear actionable hints for common errors', () => {
    const authHint = hintForMongoError('Authentication failed.');
    assert.ok(authHint && authHint.includes('credentials were rejected'));

    const connRefusedHint = hintForMongoError('connect ECONNREFUSED 127.0.0.1:27017');
    assert.ok(connRefusedHint && connRefusedHint.includes('local MongoDB daemon is running'));

    const timeoutHint = hintForMongoError('Server selection timed out');
    assert.ok(timeoutHint && timeoutHint.includes('timed out'));
  });

  await t.test('validates database target based on DATABASE_MODE', () => {
    const target = getDatabaseTarget();
    assert.ok(['local', 'online'].includes(target.mode));
    assert.ok(target.uri.startsWith('mongodb'));
    assert.ok(!target.redactedUri.includes('O98BKgAzRJYFkC6T')); // ensure real password is redacted
  });
});

test('Online MongoDB Data Reuse & Model Compatibility', async (t) => {
  await connectDatabase();

  await t.test('preserves existing production collections and data', async () => {
    const userCount = await User.countDocuments();
    const projectCount = await Project.countDocuments();
    const categoryCount = await ProjectCategory.countDocuments();
    const orderCount = await Order.countDocuments();

    assert.ok(userCount >= 3, `Expected at least 3 users, found ${userCount}`);
    assert.ok(projectCount >= 50, `Expected at least 50 projects, found ${projectCount}`);
    assert.ok(categoryCount >= 10, `Expected at least 10 categories, found ${categoryCount}`);
    assert.ok(orderCount >= 5, `Expected at least 5 orders, found ${orderCount}`);
  });

  await t.test('supports finding documents by ObjectId or legacy numeric id', async () => {
    // Test Category lookup
    const categoryByLegacy = await ProjectCategory.findByIdOrLegacy(1);
    assert.ok(categoryByLegacy, 'Should find category by legacyId 1');

    const categoryByObjectId = await ProjectCategory.findByIdOrLegacy(categoryByLegacy.id);
    assert.ok(categoryByObjectId, 'Should find category by ObjectId string');
    assert.equal(categoryByLegacy.name, categoryByObjectId.name);

    // Test Project lookup
    const projectByLegacy = await Project.findByIdOrLegacy(1);
    assert.ok(projectByLegacy, 'Should find project by legacyId 1');
    assert.equal(projectByLegacy.legacyId, 1);

    const projectByObjectId = await Project.findByIdOrLegacy(projectByLegacy.id);
    assert.ok(projectByObjectId, 'Should find project by ObjectId');
    assert.equal(projectByObjectId.title, projectByLegacy.title);

    // Ensure .id virtual is populated
    assert.equal(typeof projectByObjectId.id, 'string');
    assert.equal(projectByObjectId.id, projectByObjectId._id.toString());
  });

  await t.test('populates relationships between Projects and Categories', async () => {
    const project = await Project.findOne({ category: { $ne: null } }).populate('category');
    assert.ok(project, 'Project with category should exist');
    assert.ok(project.category, 'Populated category should exist');
    assert.ok(project.category.name, 'Category should have a name');
    assert.ok(project.categoryId, 'Virtual categoryId should exist');
  });

  await t.test('supports User authentication and password comparison', async () => {
    const admin = await User.findOne({ email: 'admin@projectaid.com' });
    assert.ok(admin, 'Admin user should exist in MongoDB');
    assert.equal(admin.role, 'admin');

    const isMatch = await admin.comparePassword('admin123');
    assert.equal(isMatch, true, 'Admin password admin123 should match bcrypt hash');

    const wrongMatch = await admin.comparePassword('wrongpassword');
    assert.equal(wrongMatch, false, 'Invalid password should not match');
  });

  await t.test('supports Order items and user references', async () => {
    const order = await Order.findOne({ 'items.0': { $exists: true } })
      .populate('user')
      .populate('items.project');

    assert.ok(order, 'Order with items should exist');
    assert.ok(order.items.length > 0, 'Order should contain items');
    assert.ok(order.totalAmount > 0, 'Order should have total amount');
    assert.ok(order.id, 'Order should have virtual id');
    if (order.user) {
      assert.ok(order.user.email, 'Order user should have email');
    }
  });

  await t.test('supports non-destructive CRUD operations', async () => {
    // Create temporary test category
    const testCategory = await ProjectCategory.create({
      name: `Test Cat ${Date.now()}`,
      description: 'Temporary category for automated test'
    });
    assert.ok(testCategory.id);

    // Create temporary test project
    const testProject = await Project.create({
      title: `Test Project ${Date.now()}`,
      description: 'Temporary test description',
      category: testCategory._id,
      price: 25,
      documentationPrice: 25,
      status: 'draft'
    });
    assert.ok(testProject.id);

    // Update temporary test project
    testProject.title = 'Updated Test Project Title';
    await testProject.save();

    const fetched = await Project.findById(testProject._id);
    assert.equal(fetched.title, 'Updated Test Project Title');

    // Clean up temporary test documents
    await Project.deleteOne({ _id: testProject._id });
    await ProjectCategory.deleteOne({ _id: testCategory._id });

    const deletedProject = await Project.findById(testProject._id);
    const deletedCategory = await ProjectCategory.findById(testCategory._id);
    assert.equal(deletedProject, null);
    assert.equal(deletedCategory, null);
  });

  await disconnectDatabase();
});
