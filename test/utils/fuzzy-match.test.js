import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  fuzzyMatchTaskId,
  findSimilarTaskIds,
  formatTaskNotFoundError,
} from '../../src/utils/fuzzy-match.js';
import { TaskwerkDatabase } from '../../src/db/database.js';
import { applySchema } from '../../src/db/schema.js';
import { existsSync, mkdirSync, rmSync } from 'fs';

describe('Fuzzy Match Utilities', () => {
  let db;
  const testDir = '.taskwerk-test';
  const dbPath = `${testDir}/test.db`;

  beforeEach(() => {
    // Create test directory
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }

    // Create test database
    db = new TaskwerkDatabase(dbPath);
    const connection = db.connect();
    applySchema(connection);

    // Insert test tasks
    const stmt = connection.prepare(
      'INSERT INTO tasks (id, name, status, priority, created_by) VALUES (?, ?, ?, ?, ?)'
    );

    stmt.run('TASK-001', 'First task', 'todo', 'medium', 'test');
    stmt.run('TASK-002', 'Second task', 'todo', 'medium', 'test');
    stmt.run('TASK-003', 'Third task', 'todo', 'medium', 'test');
    stmt.run('TASK-010', 'Tenth task', 'todo', 'medium', 'test');
    stmt.run('BUG-001', 'First bug', 'todo', 'high', 'test');
    stmt.run('FEAT-001', 'First feature', 'todo', 'low', 'test');
    stmt.run('TASK-001.1', 'Subtask 1', 'todo', 'medium', 'test');
    stmt.run('TASK-001.2', 'Subtask 2', 'todo', 'medium', 'test');
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('fuzzyMatchTaskId', () => {
    it('should match exact task ID', () => {
      expect(fuzzyMatchTaskId('TASK-001', db)).toBe('TASK-001');
    });

    it('should match case-insensitive', () => {
      expect(fuzzyMatchTaskId('task-001', db)).toBe('TASK-001');
      expect(fuzzyMatchTaskId('Task-001', db)).toBe('TASK-001');
      expect(fuzzyMatchTaskId('TASK-001', db)).toBe('TASK-001');
    });

    it('should match without leading zeros', () => {
      expect(fuzzyMatchTaskId('TASK-1', db)).toBe('TASK-001');
      expect(fuzzyMatchTaskId('TASK-2', db)).toBe('TASK-002');
      expect(fuzzyMatchTaskId('TASK-10', db)).toBe('TASK-010');
      expect(fuzzyMatchTaskId('bug-1', db)).toBe('BUG-001');
    });

    it('should match subtasks without leading zeros', () => {
      expect(fuzzyMatchTaskId('TASK-1.1', db)).toBe('TASK-001.1');
      expect(fuzzyMatchTaskId('task-1.2', db)).toBe('TASK-001.2');
    });

    it('should match by number only', () => {
      expect(fuzzyMatchTaskId('1', db)).toBe('TASK-001');
      expect(fuzzyMatchTaskId('2', db)).toBe('TASK-002');
      expect(fuzzyMatchTaskId('10', db)).toBe('TASK-010');
    });

    it('should return null for non-existent tasks', () => {
      expect(fuzzyMatchTaskId('TASK-999', db)).toBe(null);
      expect(fuzzyMatchTaskId('NONEXIST-001', db)).toBe(null);
    });
  });

  describe('findSimilarTaskIds', () => {
    it('should find exact matches first', () => {
      const suggestions = findSimilarTaskIds('TASK-001', 3, db);
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0]).toEqual({ id: 'TASK-001', distance: 0 });
    });

    it('should find partial matches', () => {
      const suggestions = findSimilarTaskIds('001', 3, db);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].distance).toBe(0.5);
      expect(suggestions.some(s => s.id === 'TASK-001')).toBe(true);
      expect(suggestions.some(s => s.id === 'BUG-001')).toBe(true);
    });

    it('should find similar IDs by Levenshtein distance', () => {
      const suggestions = findSimilarTaskIds('TASK-004', 2, db);
      const ids = suggestions.map(s => s.id);
      // Should find TASK-001, TASK-002, TASK-003 which are within distance 2 of TASK-004
      expect(ids).toContain('TASK-001');
      expect(ids).toContain('TASK-002');
      expect(ids).toContain('TASK-003');
    });

    it('should respect maxDistance parameter', () => {
      const suggestions = findSimilarTaskIds('XXXX-999', 1, db);
      expect(suggestions).toHaveLength(0);
    });

    it('should sort by distance then by ID', () => {
      const suggestions = findSimilarTaskIds('TASK', 3, db);
      expect(suggestions[0].distance).toBeLessThanOrEqual(suggestions[1].distance);
      if (suggestions[0].distance === suggestions[1].distance) {
        expect(suggestions[0].id.localeCompare(suggestions[1].id)).toBeLessThan(0);
      }
    });
  });

  describe('formatTaskNotFoundError', () => {
    it('should format error without suggestions', () => {
      const error = formatTaskNotFoundError('XXXX-999', db);
      expect(error).toBe('Task XXXX-999 not found');
    });

    it('should format error with suggestions', () => {
      const error = formatTaskNotFoundError('TASK-004', db);
      expect(error).toContain('Task TASK-004 not found');
      expect(error).toContain('Did you mean:');
      expect(error).toContain('TASK-001');
      expect(error).toContain('TASK-002');
      expect(error).toContain('TASK-003');
    });

    it('should limit suggestions to 3', () => {
      const error = formatTaskNotFoundError('TASK', db);
      const matches = error.match(/•/g);
      expect(matches).toHaveLength(3);
    });
  });
});
