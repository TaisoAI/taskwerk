import { test } from 'node:test';
import assert from 'node:assert';
import { rm } from 'fs/promises';
import { join } from 'path';
import { SessionManager } from '../../src/core/session-manager.js';

const TEST_SESSION_FILE = join(process.cwd(), '.test-session.json');
const TEST_CONFIG = { sessionFile: TEST_SESSION_FILE };

async function cleanupSession() {
  await rm(TEST_SESSION_FILE, { force: true });
}

test('SessionManager creates default session', async () => {
  await cleanupSession();

  const sessionManager = new SessionManager(TEST_CONFIG);
  sessionManager.sessionFile = TEST_SESSION_FILE;

  const session = await sessionManager.getCurrentSession();

  assert.strictEqual(session.currentTask, null);
  assert.strictEqual(session.startedAt, null);
  assert.strictEqual(session.baseBranch, 'main');
  assert(Array.isArray(session.filesModified));
  assert(session.lastActivity);

  await cleanupSession();
});

test('SessionManager starts and tracks tasks', async () => {
  await cleanupSession();

  const sessionManager = new SessionManager(TEST_CONFIG);
  sessionManager.sessionFile = TEST_SESSION_FILE;

  await sessionManager.startTask('TASK-001');
  const session = await sessionManager.getCurrentSession();

  assert.strictEqual(session.currentTask, 'TASK-001');
  assert(session.startedAt);
  assert(session.lastActivity);

  await cleanupSession();
});

test('SessionManager updates session data', async () => {
  await cleanupSession();

  const sessionManager = new SessionManager(TEST_CONFIG);
  sessionManager.sessionFile = TEST_SESSION_FILE;

  await sessionManager.updateSession({
    branch: 'feature/test-branch',
    filesModified: ['src/test.js', 'tests/test.test.js'],
  });

  const session = await sessionManager.getCurrentSession();
  assert.strictEqual(session.branch, 'feature/test-branch');
  assert.deepStrictEqual(session.filesModified, ['src/test.js', 'tests/test.test.js']);

  await cleanupSession();
});

test('SessionManager completes tasks', async () => {
  await cleanupSession();

  const sessionManager = new SessionManager(TEST_CONFIG);
  sessionManager.sessionFile = TEST_SESSION_FILE;

  await sessionManager.startTask('TASK-001');
  await sessionManager.completeTask('TASK-001');

  const session = await sessionManager.getCurrentSession();
  assert.strictEqual(session.currentTask, null);
  assert.strictEqual(session.startedAt, null);

  await cleanupSession();
});

test('SessionManager detects agent correctly', async () => {
  await cleanupSession();

  const sessionManager = new SessionManager(TEST_CONFIG);
  sessionManager.sessionFile = TEST_SESSION_FILE;

  // Test default detection
  const agent = sessionManager.detectAgent();
  assert.strictEqual(agent, 'CLI');

  await cleanupSession();
});
