import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { TaskwerkDatabase } from '../../src/db/database.js';
import { applySchema } from '../../src/db/schema.js';
import { QueryBuilder, query } from '../../src/api/query-builder.js';

describe('QueryBuilder', () => {
  let tempDir;
  let db;
  let builder;

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'taskwerk-query-test-'));
    const dbPath = join(tempDir, 'test.db');

    const database = new TaskwerkDatabase(dbPath);
    db = database.connect();
    applySchema(db);

    builder = new QueryBuilder(db);

    // Insert test data
    db.prepare(
      `
      INSERT INTO tasks (id, name, status, priority, assignee, created_at)
      VALUES 
        ('TASK-1', 'First task', 'todo', 'high', 'user1', '2024-01-01 10:00:00'),
        ('TASK-2', 'Second task', 'in-progress', 'medium', 'user2', '2024-01-02 11:00:00'),
        ('TASK-3', 'Third task', 'done', 'low', 'user1', '2024-01-03 12:00:00'),
        ('TASK-4', 'Fourth task', 'blocked', 'critical', 'user3', '2024-01-04 13:00:00')
    `
    ).run();
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Basic Query Building', () => {
    it('should build simple SELECT query', () => {
      const { sql, values } = builder.from('tasks').buildQuery();

      expect(sql).toBe('SELECT * FROM tasks');
      expect(values).toEqual([]);
    });

    it('should select specific fields', () => {
      const { sql } = builder.from('tasks').select('id', 'name', 'status').buildQuery();

      expect(sql).toBe('SELECT id, name, status FROM tasks');
    });

    it('should add WHERE conditions', () => {
      const { sql, values } = builder.from('tasks').where('status', '=', 'todo').buildQuery();

      expect(sql).toBe('SELECT * FROM tasks WHERE status = ?');
      expect(values).toEqual(['todo']);
    });

    it('should add multiple WHERE conditions', () => {
      const { sql, values } = builder
        .from('tasks')
        .where('status', '=', 'todo')
        .andWhere('priority', '=', 'high')
        .buildQuery();

      expect(sql).toBe('SELECT * FROM tasks WHERE status = ? AND priority = ?');
      expect(values).toEqual(['todo', 'high']);
    });

    it('should add OR WHERE conditions', () => {
      const { sql, values } = builder
        .from('tasks')
        .where('status', '=', 'todo')
        .orWhere('status', '=', 'done')
        .buildQuery();

      expect(sql).toBe('SELECT * FROM tasks WHERE (status = ?) OR (status = ?)');
      expect(values).toEqual(['todo', 'done']);
    });

    it('should handle IN conditions', () => {
      const { sql, values } = builder
        .from('tasks')
        .where('status', 'IN', ['todo', 'in-progress'])
        .buildQuery();

      expect(sql).toBe('SELECT * FROM tasks WHERE status IN (?, ?)');
      expect(values).toEqual(['todo', 'in-progress']);
    });

    it('should add ORDER BY', () => {
      const { sql } = builder.from('tasks').orderBy('created_at', 'DESC').buildQuery();

      expect(sql).toBe('SELECT * FROM tasks ORDER BY created_at DESC');
    });

    it('should add multiple ORDER BY', () => {
      const { sql } = builder
        .from('tasks')
        .orderBy('priority', 'ASC')
        .orderBy('created_at', 'DESC')
        .buildQuery();

      expect(sql).toBe('SELECT * FROM tasks ORDER BY priority ASC, created_at DESC');
    });

    it('should add LIMIT and OFFSET', () => {
      const { sql } = builder.from('tasks').limit(10).offset(5).buildQuery();

      expect(sql).toBe('SELECT * FROM tasks LIMIT 10 OFFSET 5');
    });
  });

  describe('Advanced Query Features', () => {
    it('should handle LIKE conditions', () => {
      const { sql, values } = builder.from('tasks').like('name', 'task').buildQuery();

      expect(sql).toBe('SELECT * FROM tasks WHERE name LIKE ?');
      expect(values).toEqual(['%task%']);
    });

    it('should handle NULL conditions', () => {
      const { sql, values } = builder.from('tasks').whereNull('assignee').buildQuery();

      expect(sql).toBe('SELECT * FROM tasks WHERE assignee IS NULL');
      expect(values).toEqual([]);
    });

    it('should handle NOT NULL conditions', () => {
      const { sql, values } = builder.from('tasks').whereNotNull('assignee').buildQuery();

      expect(sql).toBe('SELECT * FROM tasks WHERE assignee IS NOT NULL');
      expect(values).toEqual([]);
    });

    it('should handle date ranges', () => {
      const { sql, values } = builder
        .from('tasks')
        .whereDateBetween('created_at', '2024-01-01', '2024-01-31')
        .buildQuery();

      expect(sql).toBe('SELECT * FROM tasks WHERE created_at BETWEEN ? AND ?');
      expect(values).toEqual(['2024-01-01', '2024-01-31']);
    });

    it('should add JOIN clauses', () => {
      const { sql } = builder
        .from('tasks')
        .join('task_tags', 'tasks.id = task_tags.task_id')
        .buildQuery();

      expect(sql).toBe('SELECT * FROM tasks INNER JOIN task_tags ON tasks.id = task_tags.task_id');
    });

    it('should add LEFT JOIN clauses', () => {
      const { sql } = builder
        .from('tasks')
        .leftJoin('task_tags', 'tasks.id = task_tags.task_id')
        .buildQuery();

      expect(sql).toBe('SELECT * FROM tasks LEFT JOIN task_tags ON tasks.id = task_tags.task_id');
    });

    it('should add GROUP BY', () => {
      const { sql } = builder
        .from('tasks')
        .select('status', 'COUNT(*) as count')
        .groupBy('status')
        .buildQuery();

      expect(sql).toBe('SELECT status, COUNT(*) as count FROM tasks GROUP BY status');
    });

    it('should add HAVING conditions', () => {
      const { sql, values } = builder
        .from('tasks')
        .select('assignee', 'COUNT(*) as count')
        .groupBy('assignee')
        .having('COUNT(*) > ?', 1)
        .buildQuery();

      expect(sql).toBe(
        'SELECT assignee, COUNT(*) as count FROM tasks GROUP BY assignee HAVING COUNT(*) > ?'
      );
      expect(values).toEqual([1]);
    });

    it('should handle pagination', () => {
      const { sql } = builder.from('tasks').paginate(2, 10).buildQuery();

      expect(sql).toBe('SELECT * FROM tasks LIMIT 10 OFFSET 10');
    });
  });

  describe('Query Execution', () => {
    it('should execute query and return results', () => {
      const results = builder.from('tasks').where('status', '=', 'todo').get();

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('First task');
    });

    it('should execute query and return first result', () => {
      const result = builder
        .from('tasks')
        .where('assignee', '=', 'user1')
        .orderBy('created_at', 'ASC')
        .first();

      expect(result.name).toBe('First task');
    });

    it('should count results', () => {
      const count = builder.from('tasks').where('assignee', '=', 'user1').count();

      expect(count).toBe(2);
    });

    it('should check existence', () => {
      const exists = builder.from('tasks').where('status', '=', 'blocked').exists();

      expect(exists).toBe(true);

      const notExists = builder.reset().from('tasks').where('status', '=', 'nonexistent').exists();

      expect(notExists).toBe(false);
    });

    it('should reset builder state', () => {
      builder.from('tasks').where('status', '=', 'todo').orderBy('created_at').limit(10);

      const { sql: beforeReset } = builder.buildQuery();
      expect(beforeReset).toContain('WHERE');
      expect(beforeReset).toContain('ORDER BY');
      expect(beforeReset).toContain('LIMIT');

      builder.reset();

      expect(() => builder.buildQuery()).toThrow('Table not specified');
    });
  });

  describe('Complex Queries', () => {
    it('should build complex query with all features', () => {
      const { sql, values } = builder
        .from('tasks')
        .select('id', 'name', 'status', 'priority')
        .where('status', 'IN', ['todo', 'in-progress'])
        .andWhere('priority', '!=', 'low')
        .orWhere('assignee', '=', 'user1')
        .orderBy('priority', 'DESC')
        .orderBy('created_at', 'ASC')
        .limit(5)
        .offset(2)
        .buildQuery();

      expect(sql).toBe(
        'SELECT id, name, status, priority FROM tasks ' +
          'WHERE status IN (?, ?) AND priority != ? OR (assignee = ?) ' +
          'ORDER BY priority DESC, created_at ASC ' +
          'LIMIT 5 OFFSET 2'
      );
      expect(values).toEqual(['todo', 'in-progress', 'low', 'user1']);
    });

    it('should execute complex query', () => {
      const results = builder
        .from('tasks')
        .where('status', '!=', 'done')
        .andWhere('priority', 'IN', ['high', 'critical'])
        .orderBy('priority', 'DESC')
        .get();

      expect(results).toHaveLength(2);
      // Alphabetical ordering: 'high' comes after 'critical' in DESC order
      expect(results[0].priority).toBe('high');
      expect(results[1].priority).toBe('critical');
    });
  });

  describe('Query Helper Function', () => {
    it('should create query builder with helper function', () => {
      const results = query(db).from('tasks').where('assignee', '=', 'user1').get();

      expect(results).toHaveLength(2);
    });
  });
});
