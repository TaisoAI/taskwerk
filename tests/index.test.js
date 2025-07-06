/**
 * Main Index Tests
 * 
 * @description Tests for main index exports
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { TaskwerkAPI, TaskStatus, Priority, NoteType } from '../src/index.js';

test('Main exports', async (t) => {
  await t.test('exports TaskwerkAPI', () => {
    assert.ok(TaskwerkAPI);
    assert.equal(typeof TaskwerkAPI, 'function');
  });

  await t.test('exports task statuses', () => {
    assert.ok(TaskStatus);
    assert.equal(TaskStatus.TODO, 'todo');
    assert.equal(TaskStatus.ACTIVE, 'active');
    assert.equal(TaskStatus.COMPLETED, 'completed');
  });

  await t.test('exports priority levels', () => {
    assert.ok(Priority);
    assert.equal(Priority.LOW, 'low');
    assert.equal(Priority.MEDIUM, 'medium');
    assert.equal(Priority.HIGH, 'high');
  });

  await t.test('exports note types', () => {
    assert.ok(NoteType);
    assert.equal(NoteType.USER, 'user');
    assert.equal(NoteType.SYSTEM, 'system');
  });

  await t.test('can create API instance', () => {
    const api = new TaskwerkAPI();
    assert.ok(api);
    assert.equal(typeof api.createTask, 'function');
    assert.equal(typeof api.listTasks, 'function');
  });
});