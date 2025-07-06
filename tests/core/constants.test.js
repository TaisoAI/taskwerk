/**
 * Constants Tests
 * 
 * @description Tests for core constants
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { 
  TaskStatus, 
  Priority, 
  NoteType,
  ChangeType,
  DEFAULTS,
  STATE_TRANSITIONS 
} from '../../src/core/constants.js';

test('Constants', async (t) => {
  await t.test('TaskStatus values are correct', () => {
    assert.equal(TaskStatus.TODO, 'todo');
    assert.equal(TaskStatus.ACTIVE, 'active');
    assert.equal(TaskStatus.PAUSED, 'paused');
    assert.equal(TaskStatus.BLOCKED, 'blocked');
    assert.equal(TaskStatus.COMPLETED, 'completed');
    assert.equal(TaskStatus.ARCHIVED, 'archived');
  });

  await t.test('Priority values are correct', () => {
    assert.equal(Priority.HIGH, 'high');
    assert.equal(Priority.MEDIUM, 'medium');
    assert.equal(Priority.LOW, 'low');
  });

  await t.test('NoteType values are correct', () => {
    assert.equal(NoteType.COMMENT, 'comment');
    assert.equal(NoteType.PLAN, 'plan');
    assert.equal(NoteType.UPDATE, 'update');
    assert.equal(NoteType.BLOCK, 'block');
    assert.equal(NoteType.COMPLETE, 'complete');
  });

  await t.test('DEFAULTS are correct', () => {
    assert.equal(DEFAULTS.PRIORITY, 'medium');
    assert.equal(DEFAULTS.STATUS, 'todo');
    assert.equal(DEFAULTS.PROGRESS, 0);
    assert.equal(DEFAULTS.TASKWERK_DIR, '.taskwerk');
    assert.equal(DEFAULTS.DB_FILENAME, 'taskwerk.db');
  });

  await t.test('STATE_TRANSITIONS are valid', () => {
    // Check todo can transition to multiple states
    assert.ok(STATE_TRANSITIONS.todo.includes('active'));
    assert.ok(STATE_TRANSITIONS.todo.includes('blocked'));
    assert.ok(STATE_TRANSITIONS.todo.includes('completed'));
    
    // Check archived is terminal
    assert.equal(STATE_TRANSITIONS.archived.length, 0);
  });
});