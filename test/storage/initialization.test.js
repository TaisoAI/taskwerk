/**
 * Storage Initialization Tests
 * 
 * @description Tests for storage initialization and helper functions
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initializeStorage, getNextTaskId } from '../../src/storage/index.js';
import { join } from 'path';
import { rmSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Storage Initialization', () => {
  const testDir = join(__dirname, '../temp/test-storage');
  let storage;
  
  beforeEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });
  
  afterEach(() => {
    // Clean up
    if (storage?.close) {
      storage.close();
    }
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should initialize storage system', async () => {
    storage = await initializeStorage({ projectRoot: testDir });
    
    expect(storage).toBeDefined();
    expect(storage.db).toBeDefined();
    expect(storage.connection).toBeDefined();
    expect(storage.close).toBeInstanceOf(Function);
  });

  it('should not reinitialize schema on subsequent calls', async () => {
    // First initialization
    const storage1 = await initializeStorage({ projectRoot: testDir });
    storage1.close();
    
    // Second initialization - should skip schema creation
    storage = await initializeStorage({ projectRoot: testDir });
    
    // Should still work
    const tables = storage.db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table'"
    ).all();
    expect(tables.length).toBeGreaterThan(0);
  });

  describe('getNextTaskId', () => {
    beforeEach(async () => {
      storage = await initializeStorage({ projectRoot: testDir });
    });

    it('should return TASK-001 when no tasks exist', () => {
      const nextId = getNextTaskId(storage.db);
      expect(nextId).toBe('TASK-001');
    });

    it('should increment task ID correctly', () => {
      const db = storage.db;
      
      // Insert some tasks
      const stmt = db.prepare(
        'INSERT INTO tasks (string_id, name) VALUES (?, ?)'
      );
      
      stmt.run('TASK-001', 'First task');
      stmt.run('TASK-002', 'Second task');
      stmt.run('TASK-005', 'Fifth task');
      
      const nextId = getNextTaskId(db);
      expect(nextId).toBe('TASK-006');
    });

    it('should pad task numbers correctly', () => {
      const db = storage.db;
      
      // Insert task with ID 99
      db.prepare('INSERT INTO tasks (string_id, name) VALUES (?, ?)').run('TASK-099', 'Task 99');
      
      let nextId = getNextTaskId(db);
      expect(nextId).toBe('TASK-100');
      
      // Insert task with ID 999
      db.prepare('INSERT INTO tasks (string_id, name) VALUES (?, ?)').run('TASK-999', 'Task 999');
      
      nextId = getNextTaskId(db);
      expect(nextId).toBe('TASK-1000');
    });

    it('should handle non-standard task IDs', () => {
      const db = storage.db;
      
      // Insert task with non-standard ID
      db.prepare('INSERT INTO tasks (string_id, name) VALUES (?, ?)').run('CUSTOM-ID', 'Custom task');
      
      const nextId = getNextTaskId(db);
      expect(nextId).toBe('TASK-001');
    });
  });
});