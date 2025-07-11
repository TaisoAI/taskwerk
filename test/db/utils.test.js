import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync } from 'fs';
import { join } from 'path';
import {
  backupDatabase,
  deleteDatabase,
  vacuumDatabase,
  getDatabaseInfo,
  exportToJSON,
  generateTaskId,
} from '../../src/db/utils.js';
import { createTestDatabase, createTestTask } from '../helpers/database-test-helper.js';

describe('Database Utilities', () => {
  let testDb;

  beforeEach(() => {
    testDb = createTestDatabase();
  });

  afterEach(() => {
    testDb?.cleanup();
  });

  describe('backupDatabase', () => {
    it('should backup database file', () => {
      const backupPath = join(testDb.tempDir, 'backup.db');
      const result = backupDatabase(testDb.dbPath, backupPath);

      expect(result).toBe(true);
      expect(existsSync(backupPath)).toBe(true);
    });

    it('should backup WAL and SHM files if they exist', () => {
      testDb.db.exec('CREATE TABLE test (id INTEGER)');
      testDb.db.prepare('INSERT INTO test VALUES (?)').run(1);

      const backupPath = join(testDb.tempDir, 'backup.db');
      backupDatabase(testDb.dbPath, backupPath);

      if (existsSync(`${testDb.dbPath}-wal`)) {
        expect(existsSync(`${backupPath}-wal`)).toBe(true);
      }
    });

    it('should create backup directory if it does not exist', () => {
      const backupPath = join(testDb.tempDir, 'subdir', 'backup.db');
      const result = backupDatabase(testDb.dbPath, backupPath);

      expect(result).toBe(true);
      expect(existsSync(backupPath)).toBe(true);
    });

    it('should throw error if database file not found', () => {
      const nonExistent = join(testDb.tempDir, 'nonexistent.db');
      const backupPath = join(testDb.tempDir, 'backup.db');

      expect(() => backupDatabase(nonExistent, backupPath)).toThrow('Database file not found');
    });
  });

  describe('deleteDatabase', () => {
    it('should delete database files', () => {
      const backupPath = join(testDb.tempDir, 'to-delete.db');
      backupDatabase(testDb.dbPath, backupPath);

      expect(existsSync(backupPath)).toBe(true);

      const result = deleteDatabase(backupPath);
      expect(result).toBe(true);
      expect(existsSync(backupPath)).toBe(false);
    });

    it('should return false if no files deleted', () => {
      const nonExistent = join(testDb.tempDir, 'nonexistent.db');
      const result = deleteDatabase(nonExistent);
      expect(result).toBe(false);
    });
  });

  describe('vacuumDatabase', () => {
    it('should vacuum database without error', () => {
      createTestTask(testDb.db);
      createTestTask(testDb.db);

      expect(() => vacuumDatabase(testDb.db)).not.toThrow();
    });
  });

  describe('getDatabaseInfo', () => {
    it('should return database information', () => {
      createTestTask(testDb.db);
      createTestTask(testDb.db);

      const info = getDatabaseInfo(testDb.db);

      expect(info.sizeBytes).toBeGreaterThan(0);
      expect(info.sizeMB).toBeGreaterThan(0);
      expect(info.pageSize).toBeGreaterThan(0);
      expect(info.pageCount).toBeGreaterThan(0);
      expect(info.walMode).toBe('wal');
      expect(info.foreignKeys).toBe(true);
      expect(info.tables.tasks).toBe(2);
    });

    it('should handle empty tables', () => {
      const info = getDatabaseInfo(testDb.db);
      expect(info.tables.tasks).toBe(0);
    });
  });

  describe('exportToJSON', () => {
    it('should export all tables to JSON', () => {
      createTestTask(testDb.db, { id: 'TASK-1', name: 'Task 1' });
      createTestTask(testDb.db, { id: 'TASK-2', name: 'Task 2' });

      testDb.db
        .prepare('INSERT INTO task_tags (task_id, tag) VALUES (?, ?)')
        .run('TASK-1', 'important');
      testDb.db
        .prepare('INSERT INTO task_notes (task_id, note) VALUES (?, ?)')
        .run('TASK-1', 'Test note');

      const data = exportToJSON(testDb.db);

      expect(data.tasks).toHaveLength(2);
      expect(data.task_tags).toHaveLength(1);
      expect(data.task_notes).toHaveLength(1);
      expect(data.tasks[0].name).toBe('Task 1');
      expect(data.task_tags[0].tag).toBe('important');
    });

    it('should exclude sqlite internal tables', () => {
      const data = exportToJSON(testDb.db);
      expect(data.sqlite_master).toBeUndefined();
      expect(data.sqlite_sequence).toBeUndefined();
    });
  });

  describe('generateTaskId', () => {
    it('should generate unique task IDs', () => {
      const id1 = generateTaskId();
      const id2 = generateTaskId();

      expect(id1).toMatch(/^TASK-[A-Z0-9]+$/);
      expect(id2).toMatch(/^TASK-[A-Z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    it('should generate IDs with consistent format', () => {
      for (let i = 0; i < 10; i++) {
        const id = generateTaskId();
        expect(id).toMatch(/^TASK-[A-Z0-9]{8,}$/);
      }
    });
  });
});
