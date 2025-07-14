import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { TaskwerkDatabase, closeDatabase } from '../../src/db/database.js';
import { applySchema } from '../../src/db/schema.js';
import {
  generateTaskId,
  taskIdExists,
  isValidTaskId,
  parseTaskId,
  generateSubtaskId,
} from '../../src/db/task-id.js';

describe('Task Schema', () => {
  let tempDir;
  let db;

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'taskwerk-task-schema-test-'));
    const dbPath = join(tempDir, 'test.db');

    // Initialize database and apply schema
    const database = new TaskwerkDatabase(dbPath);
    db = database.connect();
    applySchema(db);
  });

  afterEach(() => {
    closeDatabase();
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Tasks Table', () => {
    it('should create task with required fields', () => {
      const stmt = db.prepare(`
        INSERT INTO tasks (id, name, created_by, updated_by)
        VALUES (?, ?, ?, ?)
      `);

      const result = stmt.run('TASK-1', 'Test task', 'user1', 'user1');
      expect(result.changes).toBe(1);

      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get('TASK-1');
      expect(task.id).toBe('TASK-1');
      expect(task.name).toBe('Test task');
      expect(task.status).toBe('todo');
      expect(task.priority).toBe('medium');
      expect(task.created_by).toBe('user1');
      expect(task.is_subtask).toBe(0);
      expect(task.is_blocked).toBe(0);
    });

    it('should enforce valid status values', () => {
      const stmt = db.prepare(`
        INSERT INTO tasks (id, name, status, created_by, updated_by)
        VALUES (?, ?, ?, ?, ?)
      `);

      // Valid statuses (including both 'in-progress' and 'in_progress')
      expect(() => stmt.run('TASK-1', 'Test', 'todo', 'user1', 'user1')).not.toThrow();
      expect(() => stmt.run('TASK-2', 'Test', 'in-progress', 'user1', 'user1')).not.toThrow();
      expect(() => stmt.run('TASK-3', 'Test', 'blocked', 'user1', 'user1')).not.toThrow();
      expect(() => stmt.run('TASK-4', 'Test', 'done', 'user1', 'user1')).not.toThrow();
      expect(() => stmt.run('TASK-5', 'Test', 'completed', 'user1', 'user1')).not.toThrow();
      expect(() => stmt.run('TASK-6', 'Test', 'cancelled', 'user1', 'user1')).not.toThrow();

      // Invalid status
      expect(() => stmt.run('TASK-7', 'Test', 'invalid', 'user1', 'user1')).toThrow();
    });

    it('should enforce valid priority values', () => {
      const stmt = db.prepare(`
        INSERT INTO tasks (id, name, priority, created_by, updated_by)
        VALUES (?, ?, ?, ?, ?)
      `);

      // Valid priorities
      expect(() => stmt.run('TASK-1', 'Test', 'low', 'user1', 'user1')).not.toThrow();
      expect(() => stmt.run('TASK-2', 'Test', 'medium', 'user1', 'user1')).not.toThrow();
      expect(() => stmt.run('TASK-3', 'Test', 'high', 'user1', 'user1')).not.toThrow();
      expect(() => stmt.run('TASK-4', 'Test', 'critical', 'user1', 'user1')).not.toThrow();

      // Invalid priority
      expect(() => stmt.run('TASK-5', 'Test', 'urgent', 'user1', 'user1')).toThrow();
    });

    it('should store JSON metadata', () => {
      const metadata = { custom: 'field', tags: ['bug', 'ui'] };
      const context = { branch: 'feature/test', commit: 'abc123' };

      const stmt = db.prepare(`
        INSERT INTO tasks (id, name, metadata, context, created_by, updated_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        'TASK-1',
        'Test',
        JSON.stringify(metadata),
        JSON.stringify(context),
        'user1',
        'user1'
      );

      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get('TASK-1');
      expect(JSON.parse(task.metadata)).toEqual(metadata);
      expect(JSON.parse(task.context)).toEqual(context);
    });

    it('should handle subtasks with parent_id', () => {
      // Create parent task
      db.prepare(
        `
        INSERT INTO tasks (id, name, created_by, updated_by)
        VALUES ('TASK-1', 'Parent task', 'user1', 'user1')
      `
      ).run();

      // Create subtask
      db.prepare(
        `
        INSERT INTO tasks (id, name, parent_id, created_by, updated_by)
        VALUES ('TASK-1.1', 'Subtask', 'TASK-1', 'user1', 'user1')
      `
      ).run();

      const subtask = db.prepare('SELECT * FROM tasks WHERE id = ?').get('TASK-1.1');
      expect(subtask.parent_id).toBe('TASK-1');
      expect(subtask.is_subtask).toBe(1);
    });

    it('should calculate is_blocked correctly', () => {
      db.prepare(
        `
        INSERT INTO tasks (id, name, status, created_by, updated_by)
        VALUES ('TASK-1', 'Blocked task', 'blocked', 'user1', 'user1')
      `
      ).run();

      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get('TASK-1');
      expect(task.status).toBe('blocked');
      expect(task.is_blocked).toBe(1);
    });
  });

  describe('Task Dependencies', () => {
    beforeEach(() => {
      // Create test tasks
      db.prepare(
        `
        INSERT INTO tasks (id, name, created_by, updated_by)
        VALUES ('TASK-1', 'Task 1', 'user1', 'user1'),
               ('TASK-2', 'Task 2', 'user1', 'user1'),
               ('TASK-3', 'Task 3', 'user1', 'user1')
      `
      ).run();
    });

    it('should create task dependencies', () => {
      const stmt = db.prepare(`
        INSERT INTO task_dependencies (task_id, depends_on_id)
        VALUES (?, ?)
      `);

      stmt.run('TASK-2', 'TASK-1');
      stmt.run('TASK-3', 'TASK-1');

      const deps = db
        .prepare('SELECT * FROM task_dependencies WHERE depends_on_id = ?')
        .all('TASK-1');
      expect(deps).toHaveLength(2);
      expect(deps.map(d => d.task_id)).toContain('TASK-2');
      expect(deps.map(d => d.task_id)).toContain('TASK-3');
    });

    it('should prevent duplicate dependencies', () => {
      const stmt = db.prepare(`
        INSERT INTO task_dependencies (task_id, depends_on_id)
        VALUES (?, ?)
      `);

      stmt.run('TASK-2', 'TASK-1');
      expect(() => stmt.run('TASK-2', 'TASK-1')).toThrow();
    });

    it('should prevent self-dependencies', () => {
      const stmt = db.prepare(`
        INSERT INTO task_dependencies (task_id, depends_on_id)
        VALUES (?, ?)
      `);

      expect(() => stmt.run('TASK-1', 'TASK-1')).toThrow();
    });

    it('should cascade delete dependencies', () => {
      db.prepare('INSERT INTO task_dependencies (task_id, depends_on_id) VALUES (?, ?)').run(
        'TASK-2',
        'TASK-1'
      );

      // Delete the parent task
      db.prepare('DELETE FROM tasks WHERE id = ?').run('TASK-1');

      // Check that dependency was deleted
      const deps = db.prepare('SELECT * FROM task_dependencies').all();
      expect(deps).toHaveLength(0);
    });
  });

  describe('Task Tags', () => {
    beforeEach(() => {
      db.prepare(
        `
        INSERT INTO tasks (id, name, created_by, updated_by)
        VALUES ('TASK-1', 'Task 1', 'user1', 'user1')
      `
      ).run();
    });

    it('should add tags to tasks', () => {
      const stmt = db.prepare('INSERT INTO task_tags (task_id, tag) VALUES (?, ?)');

      stmt.run('TASK-1', 'bug');
      stmt.run('TASK-1', 'ui');
      stmt.run('TASK-1', 'critical');

      const tags = db
        .prepare('SELECT tag FROM task_tags WHERE task_id = ? ORDER BY tag')
        .all('TASK-1');
      expect(tags).toHaveLength(3);
      expect(tags.map(t => t.tag)).toEqual(['bug', 'critical', 'ui']);
    });

    it('should prevent duplicate tags per task', () => {
      const stmt = db.prepare('INSERT INTO task_tags (task_id, tag) VALUES (?, ?)');

      stmt.run('TASK-1', 'bug');
      expect(() => stmt.run('TASK-1', 'bug')).toThrow();
    });
  });

  describe('Task Timeline', () => {
    beforeEach(() => {
      db.prepare(
        `
        INSERT INTO tasks (id, name, created_by, updated_by)
        VALUES ('TASK-1', 'Task 1', 'user1', 'user1')
      `
      ).run();
    });

    it('should record task timeline events', () => {
      const stmt = db.prepare(`
        INSERT INTO task_timeline (task_id, action, user, note, changes)
        VALUES (?, ?, ?, ?, ?)
      `);

      stmt.run('TASK-1', 'created', 'user1', 'Initial creation', null);
      stmt.run('TASK-1', 'started', 'user1', 'Beginning work', null);
      stmt.run(
        'TASK-1',
        'updated',
        'bot-claude',
        'Updated description',
        JSON.stringify({
          description: { old: 'Task 1', new: 'Updated Task 1' },
        })
      );

      const timeline = db
        .prepare('SELECT * FROM task_timeline WHERE task_id = ? ORDER BY timestamp')
        .all('TASK-1');
      expect(timeline).toHaveLength(3);
      expect(timeline[0].action).toBe('created');
      expect(timeline[1].action).toBe('started');
      expect(timeline[2].action).toBe('updated');
      expect(timeline[2].user).toBe('bot-claude');
    });
  });

  describe('Task Notes', () => {
    beforeEach(() => {
      db.prepare(
        `
        INSERT INTO tasks (id, name, created_by, updated_by)
        VALUES ('TASK-1', 'Task 1', 'user1', 'user1')
      `
      ).run();
    });

    it('should add notes to tasks', () => {
      const stmt = db.prepare(`
        INSERT INTO task_notes (task_id, user, note)
        VALUES (?, ?, ?)
      `);

      stmt.run('TASK-1', 'user1', 'This is a note about the task');
      stmt.run('TASK-1', 'bot-gpt', 'AI analysis: This task requires attention');

      const notes = db.prepare('SELECT * FROM task_notes WHERE task_id = ?').all('TASK-1');
      expect(notes).toHaveLength(2);
      expect(notes[0].user).toBe('user1');
      expect(notes[1].user).toBe('bot-gpt');
    });
  });

  describe('Task ID Generation', () => {
    it('should generate sequential task IDs', async () => {
      const id1 = await generateTaskId('TASK', db);
      expect(id1).toBe('TASK-1');

      // Insert the task
      db.prepare(
        `
        INSERT INTO tasks (id, name, created_by, updated_by)
        VALUES (?, ?, ?, ?)
      `
      ).run(id1, 'Task 1', 'user1', 'user1');

      const id2 = await generateTaskId('TASK', db);
      expect(id2).toBe('TASK-2');
    });

    it('should handle custom prefixes', async () => {
      const id1 = await generateTaskId('BUG', db);
      expect(id1).toBe('BUG-1');

      db.prepare(
        `
        INSERT INTO tasks (id, name, created_by, updated_by)
        VALUES (?, ?, ?, ?)
      `
      ).run(id1, 'Bug 1', 'user1', 'user1');

      const id2 = await generateTaskId('BUG', db);
      expect(id2).toBe('BUG-2');
    });

    it('should check if task ID exists', () => {
      expect(taskIdExists('TASK-1', db)).toBe(false);

      db.prepare(
        `
        INSERT INTO tasks (id, name, created_by, updated_by)
        VALUES ('TASK-1', 'Task 1', 'user1', 'user1')
      `
      ).run();

      expect(taskIdExists('TASK-1', db)).toBe(true);
    });

    it('should validate task ID format', () => {
      expect(isValidTaskId('TASK-1')).toBe(true);
      expect(isValidTaskId('BUG-123')).toBe(true);
      expect(isValidTaskId('FEATURE-42')).toBe(true);

      expect(isValidTaskId('task-1')).toBe(false);
      expect(isValidTaskId('TASK1')).toBe(false);
      expect(isValidTaskId('TASK-')).toBe(false);
      expect(isValidTaskId('TASK-ABC')).toBe(false);
    });

    it('should parse task IDs', () => {
      expect(parseTaskId('TASK-123')).toEqual({ prefix: 'TASK', number: 123 });
      expect(parseTaskId('BUG-42')).toEqual({ prefix: 'BUG', number: 42 });
      expect(parseTaskId('invalid')).toBe(null);
    });

    it('should generate subtask IDs', async () => {
      // Create parent task
      db.prepare(
        `
        INSERT INTO tasks (id, name, created_by, updated_by)
        VALUES ('TASK-1', 'Parent task', 'user1', 'user1')
      `
      ).run();

      const id1 = await generateSubtaskId('TASK-1', db);
      expect(id1).toBe('TASK-1.1');

      // Note: The check constraint needs to be updated to allow subtask format
    });
  });
});
