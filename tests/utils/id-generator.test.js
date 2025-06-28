import { test } from 'node:test';
import assert from 'node:assert';
import { generateTaskId, parseTaskId, isValidTaskId } from '../../src/utils/id-generator.js';

test('generateTaskId creates sequential IDs', () => {
  const existingTasks = [{ id: 'TASK-001' }, { id: 'TASK-002' }, { id: 'TASK-003' }];

  const newId = generateTaskId(existingTasks);
  assert.strictEqual(newId, 'TASK-004');
});

test('generateTaskId handles gaps in sequence', () => {
  const existingTasks = [{ id: 'TASK-001' }, { id: 'TASK-003' }, { id: 'TASK-005' }];

  const newId = generateTaskId(existingTasks);
  assert.strictEqual(newId, 'TASK-002');
});

test('generateTaskId starts from TASK-001 for empty list', () => {
  const existingTasks = [];
  const newId = generateTaskId(existingTasks);
  assert.strictEqual(newId, 'TASK-001');
});

test('parseTaskId extracts components correctly', () => {
  const parsed = parseTaskId('TASK-042');
  assert.deepStrictEqual(parsed, {
    prefix: 'TASK',
    number: 42,
    full: 'TASK-042',
  });
});

test('parseTaskId throws error for invalid format', () => {
  assert.throws(() => parseTaskId('INVALID'), {
    message: 'Invalid task ID format: INVALID',
  });
});

test('isValidTaskId validates format correctly', () => {
  assert.strictEqual(isValidTaskId('TASK-001'), true);
  assert.strictEqual(isValidTaskId('BUG-123'), true);
  assert.strictEqual(isValidTaskId('invalid'), false);
  assert.strictEqual(isValidTaskId('TASK-'), false);
  assert.strictEqual(isValidTaskId('123-TASK'), false);
});
