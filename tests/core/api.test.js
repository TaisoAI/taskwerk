/**
 * Core API Tests
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { TaskwerkAPI } from '../../src/core/api.js';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

test('TaskwerkAPI', async (t) => {
  let tempDir;
  let api;

  t.beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'taskwerk-test-'));
    api = new TaskwerkAPI({ projectRoot: tempDir });
  });

  t.afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  await t.test('constructor sets default options', () => {
    const api = new TaskwerkAPI();
    assert.ok(api.options);
    assert.equal(api.options.projectRoot, process.cwd());
  });

  await t.test('constructor accepts custom options', () => {
    const customRoot = '/custom/path';
    const api = new TaskwerkAPI({ projectRoot: customRoot });
    assert.equal(api.options.projectRoot, customRoot);
  });

  await t.test('has task service methods', () => {
    assert.equal(typeof api.createTask, 'function');
    assert.equal(typeof api.updateTask, 'function');
    assert.equal(typeof api.deleteTask, 'function');
    assert.equal(typeof api.getTask, 'function');
    assert.equal(typeof api.listTasks, 'function');
  });

  await t.test('has note service methods', () => {
    assert.equal(typeof api.addNote, 'function');
    assert.equal(typeof api.getTaskNotes, 'function');
  });

  await t.test('has query service methods', () => {
    assert.equal(typeof api.search, 'function');
    assert.equal(typeof api.getTasksByStatus, 'function');
    assert.equal(typeof api.getTasksByDate, 'function');
  });

  await t.test('has import/export service methods', () => {
    assert.equal(typeof api.exportTasks, 'function');
    assert.equal(typeof api.importTasks, 'function');
  });

  await t.test('service method stubs throw not implemented', async () => {
    await assert.rejects(
      api.createTask({ title: 'test' }),
      /Database not initialized/
    );

    await assert.rejects(
      api.listTasks(),
      /Database not initialized/
    );

    await assert.rejects(
      api.exportTasks(),
      /Not implemented/
    );
  });
});