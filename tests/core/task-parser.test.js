import { test } from 'node:test';
import assert from 'node:assert';
import { TaskParser } from '../../src/core/task-parser.js';

test('TaskParser parses task line correctly', () => {
  const parser = new TaskParser();
  const line = '- [x] **TASK-001** Fix authentication bug - Completed with OAuth fix';

  const task = parser.parseTaskLine(line);

  assert.strictEqual(task.id, 'TASK-001');
  assert.strictEqual(task.description, 'Fix authentication bug');
  assert.strictEqual(task.status, 'completed');
  assert.strictEqual(task.note, 'Completed with OAuth fix');
});

test('TaskParser handles different status markers', () => {
  const parser = new TaskParser();

  const tests = [
    { line: '- [ ] **TASK-001** Todo task', expected: 'todo' },
    { line: '- [>] **TASK-002** In progress task', expected: 'in_progress' },
    { line: '- [x] **TASK-003** Completed task', expected: 'completed' },
    { line: '- [!] **TASK-004** Blocked task', expected: 'blocked' },
  ];

  for (const { line, expected } of tests) {
    const task = parser.parseTaskLine(line);
    assert.strictEqual(task.status, expected, `Failed for line: ${line}`);
  }
});

test('TaskParser returns null for non-task lines', () => {
  const parser = new TaskParser();
  const nonTaskLines = ['# Header', 'Regular text', '- Not a task', '## Another header'];

  for (const line of nonTaskLines) {
    const result = parser.parseTaskLine(line);
    assert.strictEqual(result, null, `Should return null for: ${line}`);
  }
});

test('TaskParser formats task line correctly', () => {
  const parser = new TaskParser();
  const task = {
    id: 'TASK-001',
    description: 'Test task',
    status: 'in_progress',
  };

  const formatted = parser.formatTaskLine(task);
  assert.strictEqual(formatted, '- [>] **TASK-001** Test task');
});
