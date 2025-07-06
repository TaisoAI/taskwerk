/**
 * Task Service Tests
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import TaskService from '../../../src/core/services/task-service.js';

test('TaskService', async (t) => {
  let service;

  t.beforeEach(() => {
    service = new TaskService();
  });

  await t.test('constructor creates instance', () => {
    assert.ok(service instanceof TaskService);
  });

  await t.test('createTask throws not implemented', async () => {
    await assert.rejects(
      service.createTask({ title: 'test' }),
      /Not implemented/
    );
  });

  await t.test('updateTask throws not implemented', async () => {
    await assert.rejects(
      service.updateTask('task-1', { status: 'active' }),
      /Not implemented/
    );
  });

  await t.test('deleteTask throws not implemented', async () => {
    await assert.rejects(
      service.deleteTask('task-1'),
      /Not implemented/
    );
  });

  await t.test('getTask throws not implemented', async () => {
    await assert.rejects(
      service.getTask('task-1'),
      /Not implemented/
    );
  });

  await t.test('listTasks throws not implemented', async () => {
    await assert.rejects(
      service.listTasks(),
      /Not implemented/
    );
  });

  await t.test('changeTaskStatus throws not implemented', async () => {
    await assert.rejects(
      service.changeTaskStatus('task-1', 'active'),
      /Not implemented/
    );
  });
});