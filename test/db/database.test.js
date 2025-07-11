import { describe, it, expect, afterEach } from 'vitest';
import { TaskwerkDatabase, getDatabase, closeDatabase } from '../../src/db/database.js';
import { createTestDatabase } from '../helpers/database-test-helper.js';

describe('TaskwerkDatabase', () => {
  let testDb;

  afterEach(() => {
    if (testDb?.cleanup) {
      testDb.cleanup();
    }
    closeDatabase();
  });

  describe('constructor', () => {
    it('should create database with default path', () => {
      const db = new TaskwerkDatabase();
      expect(db.dbPath).toContain('.taskwerk');
      expect(db.dbPath).toContain('taskwerk.db');
    });

    it('should accept custom database path', () => {
      const customPath = '/tmp/custom.db';
      const db = new TaskwerkDatabase(customPath);
      expect(db.dbPath).toBe(customPath);
    });
  });

  describe('connect', () => {
    it('should connect to database', () => {
      testDb = createTestDatabase();
      expect(testDb.database.isConnected()).toBe(true);
    });

    it('should enable WAL mode', () => {
      testDb = createTestDatabase();
      const mode = testDb.db.pragma('journal_mode', { simple: true });
      expect(mode).toBe('wal');
    });

    it('should enable foreign keys', () => {
      testDb = createTestDatabase();
      const fk = testDb.db.pragma('foreign_keys', { simple: true });
      expect(fk).toBe(1);
    });

    it('should return existing connection if already connected', () => {
      testDb = createTestDatabase();
      const firstConnection = testDb.database.db;
      const secondConnection = testDb.database.connect();
      expect(secondConnection).toBe(firstConnection);
    });
  });

  describe('close', () => {
    it('should close database connection', () => {
      testDb = createTestDatabase();
      testDb.database.close();
      expect(testDb.database.isConnected()).toBe(false);
      expect(testDb.database.db).toBe(null);
    });

    it('should handle closing already closed database', () => {
      testDb = createTestDatabase();
      testDb.database.close();
      expect(() => testDb.database.close()).not.toThrow();
    });
  });

  describe('executeTransaction', () => {
    it('should execute transaction successfully', () => {
      testDb = createTestDatabase();

      const result = testDb.database.executeTransaction(() => {
        testDb.db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY)');
        testDb.db.prepare('INSERT INTO test (id) VALUES (?)').run(1);
        return testDb.db.prepare('SELECT * FROM test').all();
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it('should rollback transaction on error', () => {
      testDb = createTestDatabase();

      expect(() => {
        testDb.database.executeTransaction(() => {
          testDb.db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY)');
          testDb.db.prepare('INSERT INTO test (id) VALUES (?)').run(1);
          throw new Error('Transaction error');
        });
      }).toThrow('Transaction error');

      const tables = testDb.db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='test'")
        .all();
      expect(tables).toHaveLength(0);
    });

    it('should throw error if database not connected', () => {
      const db = new TaskwerkDatabase();
      expect(() => db.executeTransaction(() => {})).toThrow('Database not connected');
    });
  });

  describe('prepare', () => {
    it('should prepare statement', () => {
      testDb = createTestDatabase();
      const stmt = testDb.database.prepare('SELECT 1 as value');
      const result = stmt.get();
      expect(result.value).toBe(1);
    });

    it('should throw error if database not connected', () => {
      const db = new TaskwerkDatabase();
      expect(() => db.prepare('SELECT 1')).toThrow('Database not connected');
    });
  });

  describe('exec', () => {
    it('should execute SQL', () => {
      testDb = createTestDatabase();
      testDb.database.exec('CREATE TABLE test (id INTEGER PRIMARY KEY)');

      const tables = testDb.db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='test'")
        .all();
      expect(tables).toHaveLength(1);
    });

    it('should throw error if database not connected', () => {
      const db = new TaskwerkDatabase();
      expect(() => db.exec('SELECT 1')).toThrow('Database not connected');
    });
  });

  describe('singleton functions', () => {
    it('should return same instance from getDatabase', () => {
      const db1 = getDatabase();
      const db2 = getDatabase();
      expect(db1).toBe(db2);
    });

    it('should close and reset singleton', () => {
      const db1 = getDatabase();
      closeDatabase();
      const db2 = getDatabase();
      expect(db1).not.toBe(db2);
    });
  });
});
