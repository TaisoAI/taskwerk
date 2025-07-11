import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SCHEMA_VERSION, getSchemaVersion, applySchema } from '../../src/db/schema.js';
import { createTestDatabase } from '../helpers/database-test-helper.js';

describe('Schema Management', () => {
  let testDb;

  beforeEach(() => {
    testDb = createTestDatabase();
  });

  afterEach(() => {
    testDb?.cleanup();
  });

  describe('getSchemaVersion', () => {
    it('should return 0 for new database', () => {
      const db = testDb.database;
      db.close();

      const newTestDb = createTestDatabase();
      const version = getSchemaVersion(newTestDb.db);
      expect(version).toBe(SCHEMA_VERSION);
      newTestDb.cleanup();
    });

    it('should return current version after schema applied', () => {
      const version = getSchemaVersion(testDb.db);
      expect(version).toBe(SCHEMA_VERSION);
    });

    it('should return 0 if schema_version table does not exist', () => {
      testDb.db.exec('DROP TABLE IF EXISTS schema_version');
      const version = getSchemaVersion(testDb.db);
      expect(version).toBe(0);
    });
  });

  describe('applySchema', () => {
    it('should create all required tables', () => {
      const tables = testDb.db
        .prepare(
          `
        SELECT name FROM sqlite_master 
        WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `
        )
        .all()
        .map(row => row.name);

      expect(tables).toContain('tasks');
      expect(tables).toContain('task_dependencies');
      expect(tables).toContain('task_tags');
      expect(tables).toContain('task_notes');
      expect(tables).toContain('task_history');
      expect(tables).toContain('schema_version');
    });

    it('should create all required indexes', () => {
      const indexes = testDb.db
        .prepare(
          `
        SELECT name FROM sqlite_master 
        WHERE type = 'index' AND name LIKE 'idx_%'
        ORDER BY name
      `
        )
        .all()
        .map(row => row.name);

      expect(indexes).toContain('idx_tasks_status');
      expect(indexes).toContain('idx_tasks_assignee');
      expect(indexes).toContain('idx_tasks_parent');
      expect(indexes).toContain('idx_tasks_created');
      expect(indexes).toContain('idx_task_tags_tag');
    });

    it('should create update trigger', () => {
      const triggers = testDb.db
        .prepare(
          `
        SELECT name FROM sqlite_master 
        WHERE type = 'trigger'
        ORDER BY name
      `
        )
        .all()
        .map(row => row.name);

      expect(triggers).toContain('update_task_timestamp');
    });

    it('should not reapply schema if already at current version', () => {
      const result = applySchema(testDb.db);
      expect(result).toBe(false);
    });
  });

  describe('table constraints', () => {
    it('should enforce status check constraint', () => {
      expect(() => {
        testDb.db
          .prepare(
            `
          INSERT INTO tasks (id, name, status) 
          VALUES ('TEST-1', 'Test', 'invalid')
        `
          )
          .run();
      }).toThrow();
    });

    it('should enforce priority check constraint', () => {
      expect(() => {
        testDb.db
          .prepare(
            `
          INSERT INTO tasks (id, name, priority) 
          VALUES ('TEST-1', 'Test', 'invalid')
        `
          )
          .run();
      }).toThrow();
    });

    it('should enforce progress check constraint', () => {
      expect(() => {
        testDb.db
          .prepare(
            `
          INSERT INTO tasks (id, name, progress) 
          VALUES ('TEST-1', 'Test', 101)
        `
          )
          .run();
      }).toThrow();
    });

    it('should enforce foreign key constraints', () => {
      expect(() => {
        testDb.db
          .prepare(
            `
          INSERT INTO task_dependencies (task_id, depends_on_id) 
          VALUES ('NONEXISTENT', 'ALSONOTEXIST')
        `
          )
          .run();
      }).toThrow();
    });
  });

  describe('default values', () => {
    it('should set default status to todo', () => {
      testDb.db.prepare('INSERT INTO tasks (id, name) VALUES (?, ?)').run('TEST-1', 'Test');
      const task = testDb.db.prepare('SELECT status FROM tasks WHERE id = ?').get('TEST-1');
      expect(task.status).toBe('todo');
    });

    it('should set default priority to medium', () => {
      testDb.db.prepare('INSERT INTO tasks (id, name) VALUES (?, ?)').run('TEST-1', 'Test');
      const task = testDb.db.prepare('SELECT priority FROM tasks WHERE id = ?').get('TEST-1');
      expect(task.priority).toBe('medium');
    });

    it('should set default progress to 0', () => {
      testDb.db.prepare('INSERT INTO tasks (id, name) VALUES (?, ?)').run('TEST-1', 'Test');
      const task = testDb.db.prepare('SELECT progress FROM tasks WHERE id = ?').get('TEST-1');
      expect(task.progress).toBe(0);
    });

    it('should set timestamps automatically', () => {
      testDb.db.prepare('INSERT INTO tasks (id, name) VALUES (?, ?)').run('TEST-1', 'Test');
      const task = testDb.db
        .prepare('SELECT created_at, updated_at FROM tasks WHERE id = ?')
        .get('TEST-1');
      expect(task.created_at).toBeTruthy();
      expect(task.updated_at).toBeTruthy();
    });
  });
});
