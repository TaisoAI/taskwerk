/**
 * Database Tests
 * 
 * @description Tests for database connection and initialization
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseConnection } from '../../src/storage/database.js';
import { initializeSchema, getSchemaVersion } from '../../src/storage/schema.js';
import { join } from 'path';
import { rmSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Database', () => {
  let dbConnection;
  const testDir = join(__dirname, '../temp/test-project');
  const taskwerkDir = join(testDir, '.taskwerk');
  
  beforeEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });
  
  afterEach(() => {
    // Clean up
    if (dbConnection) {
      dbConnection.close();
    }
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('DatabaseConnection', () => {
    it('should create database connection', () => {
      dbConnection = new DatabaseConnection({ projectRoot: testDir });
      const db = dbConnection.connect();
      
      expect(db).toBeDefined();
      expect(existsSync(taskwerkDir)).toBe(true);
      expect(existsSync(join(taskwerkDir, 'taskwerk.db'))).toBe(true);
    });

    it('should return existing connection on multiple calls', () => {
      dbConnection = new DatabaseConnection({ projectRoot: testDir });
      const db1 = dbConnection.connect();
      const db2 = dbConnection.connect();
      
      expect(db1).toBe(db2);
    });

    it('should close connection', () => {
      dbConnection = new DatabaseConnection({ projectRoot: testDir });
      dbConnection.connect();
      dbConnection.close();
      
      expect(dbConnection.db).toBe(null);
    });

    it('should check if database is initialized', () => {
      dbConnection = new DatabaseConnection({ projectRoot: testDir });
      
      // Before initialization
      expect(dbConnection.isInitialized()).toBe(false);
      
      // After initialization
      const db = dbConnection.connect();
      initializeSchema(db);
      expect(dbConnection.isInitialized()).toBe(true);
    });
  });

  describe('Schema', () => {
    it('should initialize schema', () => {
      dbConnection = new DatabaseConnection({ projectRoot: testDir });
      const db = dbConnection.connect();
      
      initializeSchema(db);
      
      // Check tables exist
      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      ).all();
      
      const tableNames = tables.map(t => t.name).sort();
      expect(tableNames).toContain('tasks');
      expect(tableNames).toContain('task_dependencies');
      expect(tableNames).toContain('task_notes');
      expect(tableNames).toContain('task_history');
      expect(tableNames).toContain('tags');
      expect(tableNames).toContain('task_tags');
      expect(tableNames).toContain('task_commits');
      expect(tableNames).toContain('schema_version');
    });

    it('should set schema version', () => {
      dbConnection = new DatabaseConnection({ projectRoot: testDir });
      const db = dbConnection.connect();
      
      initializeSchema(db);
      
      const version = getSchemaVersion(db);
      expect(version).toBe(1);
    });

    it('should enforce foreign keys', () => {
      dbConnection = new DatabaseConnection({ projectRoot: testDir });
      const db = dbConnection.connect();
      
      initializeSchema(db);
      
      // Test foreign key constraint
      expect(() => {
        db.prepare('INSERT INTO task_dependencies (task_id, depends_on_id) VALUES (999, 888)').run();
      }).toThrow();
    });

    it('should use WAL mode', () => {
      dbConnection = new DatabaseConnection({ projectRoot: testDir });
      const db = dbConnection.connect();
      
      const result = db.prepare('PRAGMA journal_mode').get();
      expect(result.journal_mode).toBe('wal');
    });
  });
});