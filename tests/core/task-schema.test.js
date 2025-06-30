import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TaskSchema } from '../../src/core/task-schema.js';

describe('TaskSchema', () => {
  describe('schema definition', () => {
    it('should have a complete v2 schema', () => {
      const schema = TaskSchema.getV2Schema();

      // Check core fields
      assert(schema.id, 'Schema should have id field');
      assert(schema.description, 'Schema should have description field');
      assert(schema.status, 'Schema should have status field');
      assert(schema.priority, 'Schema should have priority field');

      // Check enhanced v2 fields
      assert(schema.dependencies, 'Schema should have dependencies field');
      assert(schema.timeline, 'Schema should have timeline field');
      assert(schema.subtasks, 'Schema should have subtasks field');
      assert(schema.git, 'Schema should have git field');
      assert(schema.assignee, 'Schema should have assignee field');

      // Check required field markers
      assert.strictEqual(schema.id.required, true);
      assert.strictEqual(schema.description.required, true);
      assert.strictEqual(schema.status.required, true);
    });

    it('should have proper enum values for key fields', () => {
      const schema = TaskSchema.getV2Schema();

      assert.deepStrictEqual(schema.status.enum, [
        'todo',
        'in_progress',
        'completed',
        'blocked',
        'archived',
      ]);
      assert.deepStrictEqual(schema.priority.enum, ['high', 'medium', 'low']);
      assert.deepStrictEqual(schema.category.enum, [
        'bugs',
        'features',
        'docs',
        'refactor',
        'test',
        'chore',
      ]);
    });

    it('should have proper patterns for validation', () => {
      const schema = TaskSchema.getV2Schema();

      // Test ID pattern
      assert(schema.id.pattern.test('TASK-001'));
      assert(schema.id.pattern.test('TASK-999'));
      assert(!schema.id.pattern.test('task-001'));
      assert(!schema.id.pattern.test('TASK-1'));
      assert(!schema.id.pattern.test('TASK-1234'));

      // Test assignee pattern
      assert(schema.assignee.pattern.test('@johndoe'));
      assert(schema.assignee.pattern.test('@jane-doe'));
      assert(!schema.assignee.pattern.test('johndoe'));
      assert(!schema.assignee.pattern.test('@john doe'));

      // Test estimated pattern
      assert(schema.estimated.pattern.test('2h'));
      assert(schema.estimated.pattern.test('3d'));
      assert(schema.estimated.pattern.test('1w'));
      assert(schema.estimated.pattern.test('2m'));
      assert(!schema.estimated.pattern.test('2 hours'));
      assert(!schema.estimated.pattern.test('2x'));
    });
  });

  describe('task creation', () => {
    it('should create a v2 task with defaults', () => {
      const task = TaskSchema.createV2Task({
        id: 'TASK-001',
        description: 'Test task',
      });

      assert.strictEqual(task.id, 'TASK-001');
      assert.strictEqual(task.description, 'Test task');
      assert.strictEqual(task.status, 'todo');
      assert.strictEqual(task.priority, 'medium');
      assert.strictEqual(task.format, 'v2');
      assert(task.created instanceof Date);
      assert(Array.isArray(task.dependencies));
      assert(Array.isArray(task.timeline));
      assert(Array.isArray(task.subtasks));
      assert(Array.isArray(task.files));
      assert(typeof task.git === 'object');
      assert(Array.isArray(task.git.commits));
    });

    it('should override defaults with provided data', () => {
      const task = TaskSchema.createV2Task({
        id: 'TASK-002',
        description: 'High priority task',
        priority: 'high',
        category: 'bugs',
        assignee: '@johndoe',
        dependencies: ['TASK-001'],
      });

      assert.strictEqual(task.priority, 'high');
      assert.strictEqual(task.category, 'bugs');
      assert.strictEqual(task.assignee, '@johndoe');
      assert.deepStrictEqual(task.dependencies, ['TASK-001']);
    });

    it('should handle date string conversion', () => {
      const dateString = '2025-06-29T14:30:00Z';
      const task = TaskSchema.createV2Task({
        id: 'TASK-003',
        description: 'Test dates',
        created: dateString,
        completedAt: dateString,
      });

      assert(task.created instanceof Date);
      assert(task.completedAt instanceof Date);
      assert.strictEqual(task.created.toISOString(), '2025-06-29T14:30:00.000Z');
      assert.strictEqual(task.completedAt.toISOString(), '2025-06-29T14:30:00.000Z');
    });
  });

  describe('task validation', () => {
    it('should validate a valid v2 task', () => {
      const validTask = TaskSchema.createV2Task({
        id: 'TASK-001',
        description: 'Valid task',
        status: 'todo',
        priority: 'high',
        category: 'features',
        assignee: '@johndoe',
        estimated: '2h',
        dependencies: ['TASK-000'],
        subtasks: [
          {
            id: 'TASK-001.1',
            description: 'Subtask',
            status: 'todo',
          },
        ],
      });

      const result = TaskSchema.validateV2Task(validTask);

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it('should detect missing required fields', () => {
      const invalidTask = {
        description: 'Missing ID',
        status: 'todo',
      };

      const result = TaskSchema.validateV2Task(invalidTask);

      assert.strictEqual(result.valid, false);
      assert(result.errors.some(e => e.includes("Field 'id' is required")));
    });

    it('should detect invalid field types', () => {
      const invalidTask = {
        id: 'TASK-001',
        description: 'Test',
        status: 'invalid_status',
        priority: 'invalid_priority',
        dependencies: 'not_an_array',
        assignee: 'no_at_symbol',
      };

      const result = TaskSchema.validateV2Task(invalidTask);

      assert.strictEqual(result.valid, false);
      assert(result.errors.some(e => e.includes('status')));
      assert(result.errors.some(e => e.includes('priority')));
      assert(result.errors.some(e => e.includes('dependencies')));
      assert(result.errors.some(e => e.includes('assignee')));
    });

    it('should validate ID format strictly', () => {
      const testCases = [
        { id: 'TASK-001', valid: true },
        { id: 'TASK-999', valid: true },
        { id: 'task-001', valid: false },
        { id: 'TASK-1', valid: false },
        { id: 'TASK-1234', valid: false },
        { id: 'TSK-001', valid: false },
      ];

      testCases.forEach(({ id, valid }) => {
        const task = { id, description: 'Test', status: 'todo' };
        const result = TaskSchema.validateV2Task(task);

        if (valid) {
          assert(
            result.valid || !result.errors.some(e => e.includes('id')),
            `${id} should be valid`
          );
        } else {
          assert(
            !result.valid && result.errors.some(e => e.includes('id')),
            `${id} should be invalid`
          );
        }
      });
    });

    it('should validate status-specific fields for completed tasks', () => {
      const completedWithoutTimestamp = {
        id: 'TASK-001',
        description: 'Completed task',
        status: 'completed',
        // Missing completedAt
      };

      const result = TaskSchema.validateV2Task(completedWithoutTimestamp);

      assert.strictEqual(result.valid, false);
      assert(result.errors.some(e => e.includes('completedAt')));
    });

    it('should validate status-specific fields for archived tasks', () => {
      const archivedIncomplete = {
        id: 'TASK-001',
        description: 'Archived task',
        status: 'archived',
        // Missing archivedAt and archiveReason
      };

      const result = TaskSchema.validateV2Task(archivedIncomplete);

      assert.strictEqual(result.valid, false);
      assert(result.errors.some(e => e.includes('archivedAt')));
      assert(result.errors.some(e => e.includes('archiveReason')));
    });

    it('should validate nested object structures', () => {
      const taskWithSubtasks = {
        id: 'TASK-001',
        description: 'Parent task',
        status: 'todo',
        subtasks: [
          {
            id: 'TASK-001.1',
            description: 'Valid subtask',
            status: 'todo',
          },
          {
            id: 'invalid-id',
            description: 'Invalid subtask',
            status: 'invalid_status',
          },
        ],
      };

      const result = TaskSchema.validateV2Task(taskWithSubtasks);

      assert.strictEqual(result.valid, false);
      assert(result.errors.some(e => e.includes('subtasks')));
    });
  });

  describe('field utilities', () => {
    it('should provide field descriptions', () => {
      const description = TaskSchema.getFieldDescription('id');
      assert(typeof description === 'string');
      assert(description.length > 0);
      assert(description.includes('Unique task identifier'));
    });

    it('should provide valid enum values', () => {
      const statusValues = TaskSchema.getValidValues('status');
      assert(Array.isArray(statusValues));
      assert(statusValues.includes('todo'));
      assert(statusValues.includes('completed'));

      const invalidField = TaskSchema.getValidValues('description');
      assert.strictEqual(invalidField, null);
    });

    it('should check if fields are required', () => {
      assert.strictEqual(TaskSchema.isFieldRequired('id'), true);
      assert.strictEqual(TaskSchema.isFieldRequired('description'), true);
      assert.strictEqual(TaskSchema.isFieldRequired('assignee'), false);
      assert.strictEqual(TaskSchema.isFieldRequired('category'), false);
    });

    it('should provide field defaults', () => {
      assert.strictEqual(TaskSchema.getFieldDefault('status'), 'todo');
      assert.strictEqual(TaskSchema.getFieldDefault('priority'), 'medium');
      assert.deepStrictEqual(TaskSchema.getFieldDefault('dependencies'), []);
      assert.strictEqual(TaskSchema.getFieldDefault('id'), undefined);
    });
  });

  describe('task sanitization', () => {
    it('should normalize case for enum fields', () => {
      const task = {
        id: 'TASK-001',
        description: 'Test',
        status: 'TODO',
        priority: 'HIGH',
        category: 'BUGS',
      };

      const sanitized = TaskSchema.sanitizeTask(task);

      assert.strictEqual(sanitized.status, 'todo');
      assert.strictEqual(sanitized.priority, 'high');
      assert.strictEqual(sanitized.category, 'bugs');
    });

    it('should ensure required arrays exist', () => {
      const task = {
        id: 'TASK-001',
        description: 'Test',
        status: 'todo',
      };

      const sanitized = TaskSchema.sanitizeTask(task);

      assert(Array.isArray(sanitized.dependencies));
      assert(Array.isArray(sanitized.timeline));
      assert(Array.isArray(sanitized.files));
      assert(Array.isArray(sanitized.subtasks));
      assert(typeof sanitized.git === 'object');
      assert(Array.isArray(sanitized.git.commits));
    });

    it('should remove empty strings and null values', () => {
      const task = {
        id: 'TASK-001',
        description: 'Test',
        status: 'todo',
        assignee: '',
        category: null,
        note: 'Valid note',
      };

      const sanitized = TaskSchema.sanitizeTask(task);

      assert(!Object.prototype.hasOwnProperty.call(sanitized, 'assignee'));
      assert(!Object.prototype.hasOwnProperty.call(sanitized, 'category'));
      assert.strictEqual(sanitized.note, 'Valid note');
    });
  });

  describe('v1 to v2 conversion', () => {
    it('should convert basic v1 task to v2', () => {
      const v1Task = {
        id: 'TASK-001',
        description: 'Legacy task',
        status: 'todo',
        priority: 'high',
        category: 'bugs',
      };

      const v2Task = TaskSchema.convertV1ToV2(v1Task);

      assert.strictEqual(v2Task.id, 'TASK-001');
      assert.strictEqual(v2Task.description, 'Legacy task');
      assert.strictEqual(v2Task.status, 'todo');
      assert.strictEqual(v2Task.priority, 'high');
      assert.strictEqual(v2Task.category, 'bugs');
      assert.strictEqual(v2Task.format, 'v2');
      assert(v2Task.created instanceof Date);
      assert(Array.isArray(v2Task.dependencies));
      assert(Array.isArray(v2Task.timeline));
    });

    it('should convert completed v1 task with all data', () => {
      const v1CompletedTask = {
        id: 'TASK-001',
        description: 'Completed legacy task',
        status: 'completed',
        completedAt: '2025-06-29T14:00:00Z',
        note: 'Task completed successfully',
        filesChanged: ['src/app.js', 'tests/app.test.js'],
      };

      const v2Task = TaskSchema.convertV1ToV2(v1CompletedTask);

      assert.strictEqual(v2Task.status, 'completed');
      assert(v2Task.completedAt instanceof Date);
      assert.strictEqual(v2Task.note, 'Task completed successfully');
      assert.deepStrictEqual(v2Task.filesChanged, ['src/app.js', 'tests/app.test.js']);
      assert.deepStrictEqual(v2Task.files, ['src/app.js', 'tests/app.test.js']);
    });

    it('should convert archived v1 task with all data', () => {
      const v1ArchivedTask = {
        id: 'TASK-001',
        description: 'Archived legacy task',
        status: 'archived',
        archivedAt: '2025-06-29T14:00:00Z',
        archiveReason: 'Requirements changed',
        supersededBy: 'TASK-050',
        note: 'Will revisit in Q3',
      };

      const v2Task = TaskSchema.convertV1ToV2(v1ArchivedTask);

      assert.strictEqual(v2Task.status, 'archived');
      assert(v2Task.archivedAt instanceof Date);
      assert.strictEqual(v2Task.archiveReason, 'Requirements changed');
      assert.strictEqual(v2Task.supersededBy, 'TASK-050');
      assert.strictEqual(v2Task.note, 'Will revisit in Q3');
    });

    it('should apply defaults for missing v1 fields', () => {
      const minimalV1Task = {
        id: 'TASK-001',
        description: 'Minimal task',
        status: 'todo',
      };

      const v2Task = TaskSchema.convertV1ToV2(minimalV1Task);

      assert.strictEqual(v2Task.priority, 'medium'); // Default applied
      assert(v2Task.created instanceof Date);
      assert(Array.isArray(v2Task.dependencies));
      assert(Array.isArray(v2Task.timeline));
      assert.strictEqual(v2Task.format, 'v2');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle undefined and null values gracefully', () => {
      const result = TaskSchema.validateV2Task(null);
      assert.strictEqual(result.valid, false);

      const result2 = TaskSchema.validateV2Task(undefined);
      assert.strictEqual(result2.valid, false);

      const result3 = TaskSchema.validateV2Task({});
      assert.strictEqual(result3.valid, false);
    });

    it('should validate complex nested structures', () => {
      const complexTask = TaskSchema.createV2Task({
        id: 'TASK-001',
        description: 'Complex task',
        status: 'in_progress',
        assignee: '@johndoe',
        dependencies: ['TASK-000', 'TASK-002'],
        timeline: [
          {
            timestamp: '2025-06-29T14:00:00Z',
            action: 'created',
            user: '@johndoe',
          },
          {
            timestamp: '2025-06-29T15:00:00Z',
            action: 'started',
            user: '@johndoe',
            note: 'Beginning work',
          },
        ],
        git: {
          commits: ['abc123', 'def456'],
          branch: 'feature/task-001',
          pullRequest: '#123',
        },
        subtasks: [
          {
            id: 'TASK-001.1',
            description: 'First subtask',
            status: 'completed',
            assignee: '@janedoe',
          },
          {
            id: 'TASK-001.2',
            description: 'Second subtask',
            status: 'in_progress',
            assignee: '@johndoe',
          },
        ],
      });

      const result = TaskSchema.validateV2Task(complexTask);
      assert.strictEqual(result.valid, true, `Validation errors: ${result.errors.join(', ')}`);
    });

    it('should maintain referential integrity in defaults', () => {
      const task1 = TaskSchema.createV2Task({ id: 'TASK-001', description: 'Task 1' });
      const task2 = TaskSchema.createV2Task({ id: 'TASK-002', description: 'Task 2' });

      // Ensure arrays are not shared between instances
      task1.dependencies.push('TASK-000');
      assert.strictEqual(task2.dependencies.length, 0);

      task1.git.commits.push('abc123');
      assert.strictEqual(task2.git.commits.length, 0);
    });
  });
});
