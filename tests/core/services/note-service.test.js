/**
 * Note Service Tests
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import NoteService from '../../../src/core/services/note-service.js';

test('NoteService', async (t) => {
  let service;

  t.beforeEach(() => {
    service = new NoteService();
  });

  await t.test('constructor creates instance', () => {
    assert.ok(service instanceof NoteService);
  });

  await t.test('addNote throws not implemented', async () => {
    await assert.rejects(
      service.addNote('task-1', { content: 'test note' }),
      /Not implemented/
    );
  });

  await t.test('getTaskNotes throws not implemented', async () => {
    await assert.rejects(
      service.getTaskNotes('task-1'),
      /Not implemented/
    );
  });

  await t.test('deleteNote throws not implemented', async () => {
    await assert.rejects(
      service.deleteNote('note-1'),
      /Not implemented/
    );
  });
});