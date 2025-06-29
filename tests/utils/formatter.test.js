import { test } from 'node:test';
import assert from 'node:assert';
import {
  formatTaskList,
  formatTask,
  formatStats,
  formatSessionStatus,
} from '../../src/utils/formatter.js';

test('formatTask creates correct task line', () => {
  const task = {
    id: 'TASK-001',
    description: 'Test task description',
    status: 'in_progress',
  };

  const formatted = formatTask(task);
  assert.strictEqual(formatted, '- [>] **TASK-001** Test task description');
});

test('formatTaskList handles empty task list', () => {
  const formatted = formatTaskList([]);
  assert.strictEqual(formatted, 'No tasks found.');
});

test('formatTaskList formats tasks by priority', () => {
  const tasks = [
    { id: 'TASK-001', description: 'High priority task', priority: 'high', status: 'todo' },
    { id: 'TASK-002', description: 'Medium priority task', priority: 'medium', status: 'todo' },
    { id: 'TASK-003', description: 'Low priority task', priority: 'low', status: 'todo' },
  ];

  const formatted = formatTaskList(tasks);

  assert(formatted.includes('## HIGH Priority'));
  assert(formatted.includes('## MEDIUM Priority'));
  assert(formatted.includes('## LOW Priority'));
  assert(formatted.includes('**TASK-001** High priority task'));
  assert(formatted.includes('*Total: 3 tasks*'));
});

test('formatTaskList shows task counts correctly', () => {
  const tasks = [
    { id: 'TASK-001', description: 'Todo task', priority: 'medium', status: 'todo' },
    { id: 'TASK-002', description: 'In progress task', priority: 'medium', status: 'in_progress' },
    { id: 'TASK-003', description: 'Blocked task', priority: 'medium', status: 'blocked' },
  ];

  const formatted = formatTaskList(tasks);

  assert(formatted.includes('*Total: 3 tasks (1 in-progress, 1 blocked)*'));
});

test('formatStats creates statistics summary', () => {
  const stats = {
    total: 5,
    todo: 2,
    inProgress: 1,
    blocked: 1,
    completed: 10,
    archived: 3,
    priorities: {
      high: 1,
      medium: 3,
      low: 1,
    },
  };

  const formatted = formatStats(stats);

  assert(formatted.includes('**Total Active Tasks**: 5'));
  assert(formatted.includes('**Completed Tasks**: 10'));
  assert(formatted.includes('**Archived Tasks**: 3'));
  assert(formatted.includes('**Todo**: 2'));
  assert(formatted.includes('**In Progress**: 1'));
  assert(formatted.includes('High**: 1'));
  // Completion rate: 10 / (5 + 10 + 3) = 10/18 = 56%
  assert(formatted.includes('**Completion Rate**: 56%'));
});

test('formatSessionStatus shows current session', () => {
  const session = {
    currentTask: 'TASK-001',
    startedAt: '2025-06-27T10:00:00Z',
    branch: 'feature/test-branch',
    agent: 'Claude Code',
    filesModified: ['src/test.js', 'tests/test.test.js'],
  };

  const formatted = formatSessionStatus(session);

  assert(formatted.includes('**Current Task**: TASK-001'));
  assert(formatted.includes('**Branch**: feature/test-branch'));
  assert(formatted.includes('**Agent**: Claude Code'));
  assert(formatted.includes('**Files Modified**: src/test.js, tests/test.test.js'));
});

test('formatSessionStatus handles empty session', () => {
  const session = {
    currentTask: null,
    startedAt: null,
    branch: null,
    agent: 'CLI',
    filesModified: [],
  };

  const formatted = formatSessionStatus(session);

  assert(formatted.includes('**Current Task**: None'));
  assert(formatted.includes('**Agent**: CLI'));
  assert(!formatted.includes('**Files Modified**'));
});
