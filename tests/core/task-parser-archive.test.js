import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { TaskParser } from '../../src/core/task-parser.js';

describe('TaskParser Archive Tests', () => {
  let parser;

  beforeEach(() => {
    parser = new TaskParser();
  });

  describe('parseCompletedTaskLine - archived tasks', () => {
    it('should parse archived task line correctly', () => {
      const line = '- [~] **TASK-001** Fix login timeout issue *[2025-06-29T21:35:52.404Z]*';
      const result = parser.parseCompletedTaskLine(line);

      assert.strictEqual(result.id, 'TASK-001');
      assert.strictEqual(result.description, 'Fix login timeout issue');
      assert.strictEqual(result.status, 'archived');
      assert.strictEqual(result.archivedAt, '2025-06-29T21:35:52.404Z');
      assert.strictEqual(result.priority, 'medium');
      assert.strictEqual(result.category, null);
    });

    it('should still parse completed tasks correctly', () => {
      const line = '- [x] **TASK-002** Complete user dashboard *[2025-06-29T21:35:52.404Z]*';
      const result = parser.parseCompletedTaskLine(line);

      assert.strictEqual(result.id, 'TASK-002');
      assert.strictEqual(result.description, 'Complete user dashboard');
      assert.strictEqual(result.status, 'completed');
      assert.strictEqual(result.completedAt, '2025-06-29T21:35:52.404Z');
    });

    it('should return null for invalid archived task line', () => {
      const line = '- [~] TASK-001 Invalid format';
      const result = parser.parseCompletedTaskLine(line);
      assert.strictEqual(result, null);
    });
  });

  describe('statusToChar', () => {
    it('should return ~ for archived status', () => {
      assert.strictEqual(parser.statusToChar('archived'), '~');
    });

    it('should return x for completed status', () => {
      assert.strictEqual(parser.statusToChar('completed'), 'x');
    });

    it('should return > for in_progress status', () => {
      assert.strictEqual(parser.statusToChar('in_progress'), '>');
    });
  });

  describe('parseStatus', () => {
    it('should return archived for ~ character', () => {
      assert.strictEqual(parser.parseStatus('~'), 'archived');
    });

    it('should return completed for x character', () => {
      assert.strictEqual(parser.parseStatus('x'), 'completed');
    });
  });

  describe('formatArchivedTask', () => {
    it('should format archived task correctly with all fields', () => {
      const task = {
        id: 'TASK-001',
        description: 'Fix login timeout issue',
        status: 'archived',
        archivedAt: '2025-06-29T21:35:52.404Z',
        archiveReason: 'Requirements changed',
        supersededBy: 'TASK-002',
        note: 'May revisit later',
        filesChanged: ['src/auth.js', 'tests/auth.test.js'],
      };

      const result = parser.formatArchivedTask(task);
      const formatted = result.join('\n');

      assert(
        formatted.includes(
          '- [~] **TASK-001** Fix login timeout issue *[2025-06-29T21:35:52.404Z]*'
        )
      );
      assert(formatted.includes('**Archived:** Requirements changed'));
      assert(formatted.includes('**Superseded by:** TASK-002'));
      assert(formatted.includes('**Note:** May revisit later'));
      assert(formatted.includes('Files: src/auth.js, tests/auth.test.js'));
    });

    it('should format archived task with minimal fields', () => {
      const task = {
        id: 'TASK-001',
        description: 'Simple archived task',
        status: 'archived',
        archivedAt: '2025-06-29T21:35:52.404Z',
        archiveReason: 'Not needed',
      };

      const result = parser.formatArchivedTask(task);
      const formatted = result.join('\n');

      assert(
        formatted.includes('- [~] **TASK-001** Simple archived task *[2025-06-29T21:35:52.404Z]*')
      );
      assert(formatted.includes('**Archived:** Not needed'));
      assert(!formatted.includes('**Superseded by:**'));
      assert(!formatted.includes('**Note:**'));
      assert(!formatted.includes('Files:'));
    });
  });

  describe('addArchivedTask', () => {
    it('should add archived task to completed content', () => {
      const content = `# Completed Tasks

- [x] **TASK-010** Existing completed task *[2025-06-29T20:00:00.000Z]*
  Some notes here

`;

      const task = {
        id: 'TASK-001',
        description: 'Archived task',
        status: 'archived',
        archivedAt: '2025-06-29T21:35:52.404Z',
        archiveReason: 'No longer needed',
      };

      const result = parser.addArchivedTask(content, task);

      assert(result.includes('- [~] **TASK-001** Archived task *[2025-06-29T21:35:52.404Z]*'));
      assert(result.includes('**Archived:** No longer needed'));
      assert(result.includes('- [x] **TASK-010** Existing completed task'));

      // Archived task should appear before existing completed task (most recent first)
      const archivedIndex = result.indexOf('**TASK-001**');
      const completedIndex = result.indexOf('**TASK-010**');
      assert(
        archivedIndex < completedIndex,
        'Archived task should appear before existing completed task'
      );
    });
  });

  describe('parseTasks - mixed completed and archived', () => {
    it('should parse both completed and archived tasks from completed file', () => {
      const content = `# Completed Tasks

- [~] **TASK-001** Archived task *[2025-06-29T21:35:52.404Z]*
  **Archived:** Requirements changed

- [x] **TASK-002** Completed task *[2025-06-29T20:00:00.000Z]*
  Task completed successfully

- [~] **TASK-003** Another archived task *[2025-06-29T19:00:00.000Z]*
  **Archived:** Duplicate of TASK-004
  **Superseded by:** TASK-004

`;

      const tasks = parser.parseTasks(content);

      assert.strictEqual(tasks.length, 3);

      const archivedTasks = tasks.filter(t => t.status === 'archived');
      const completedTasks = tasks.filter(t => t.status === 'completed');

      assert.strictEqual(archivedTasks.length, 2);
      assert.strictEqual(completedTasks.length, 1);

      assert.strictEqual(archivedTasks[0].id, 'TASK-001');
      assert.strictEqual(archivedTasks[1].id, 'TASK-003');
      assert.strictEqual(completedTasks[0].id, 'TASK-002');
    });
  });
});
