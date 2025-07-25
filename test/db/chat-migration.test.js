import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { TestMigrationRunner } from '../helpers/test-migration-runner.js';
import { applySchema } from '../../src/db/schema.js';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

describe('Chat Management Migration', () => {
  let db;
  let tempDir;
  let migrationRunner;

  beforeEach(async () => {
    // Create temp directory and database
    tempDir = await mkdtemp(join(tmpdir(), 'taskwerk-test-'));
    const dbPath = join(tempDir, 'test.db');
    db = new Database(dbPath);

    // Apply base schema first
    applySchema(db);

    // Create migration runner
    migrationRunner = new TestMigrationRunner(db);
  });

  afterEach(async () => {
    db.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Schema Changes', () => {
    it('should add chat management columns to tasks table', () => {
      // Run migrations
      migrationRunner.runPendingMigrations();

      // Check new columns exist
      const taskInfo = db.pragma('table_info(tasks)');
      const columnNames = taskInfo.map(col => col.name);

      expect(columnNames).toContain('source');
      expect(columnNames).toContain('context_id');
      expect(columnNames).toContain('intent_group_id');
      expect(columnNames).toContain('correlation_id');

      // Check default value
      const sourceCol = taskInfo.find(col => col.name === 'source');
      expect(sourceCol.dflt_value).toBe("'cli'");
    });

    it('should create chat_contexts table with correct schema', () => {
      migrationRunner.runPendingMigrations();

      const contextInfo = db.pragma('table_info(chat_contexts)');
      const columnNames = contextInfo.map(col => col.name);

      expect(columnNames).toEqual([
        'id',
        'name',
        'project_id',
        'type',
        'first_prompt',
        'created_at',
        'last_active',
        'expires_at',
        'turn_count',
        'status',
      ]);

      // Check constraints
      const sql = db
        .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='chat_contexts'")
        .get();
      expect(sql.sql).toContain("CHECK(type IN ('ask', 'agent'))");
      expect(sql.sql).toContain("CHECK(status IN ('active', 'completed', 'abandoned'))");
    });

    it('should create chat_turns table with correct schema', () => {
      migrationRunner.runPendingMigrations();

      const turnsInfo = db.pragma('table_info(chat_turns)');
      const columnNames = turnsInfo.map(col => col.name);

      expect(columnNames).toEqual([
        'id',
        'context_id',
        'turn_number',
        'role',
        'content',
        'created_task_ids',
        'tool_calls',
        'created_at',
      ]);

      // Check foreign key
      const fkInfo = db.pragma('foreign_key_list(chat_turns)');
      expect(fkInfo[0].table).toBe('chat_contexts');
      expect(fkInfo[0].from).toBe('context_id');
      expect(fkInfo[0].to).toBe('id');
      expect(fkInfo[0].on_delete).toBe('CASCADE');
    });

    it('should create all necessary indexes', () => {
      migrationRunner.runPendingMigrations();

      const indexes = db
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'")
        .all();

      const indexNames = indexes.map(idx => idx.name);

      // Task indexes
      expect(indexNames).toContain('idx_tasks_source');
      expect(indexNames).toContain('idx_tasks_context');
      expect(indexNames).toContain('idx_tasks_intent_group');

      // Context indexes
      expect(indexNames).toContain('idx_contexts_project');
      expect(indexNames).toContain('idx_contexts_name');
      expect(indexNames).toContain('idx_contexts_status');
      expect(indexNames).toContain('idx_contexts_type');
      expect(indexNames).toContain('idx_contexts_expires');

      // Turn indexes
      expect(indexNames).toContain('idx_turns_context');
      expect(indexNames).toContain('idx_turns_number');
    });
  });

  describe('Triggers', () => {
    beforeEach(() => {
      migrationRunner.runPendingMigrations();
    });

    it('should update context last_active and turn_count when adding turns', async () => {
      // Create a context
      db.prepare(
        `
        INSERT INTO chat_contexts (id, name, project_id, type, turn_count)
        VALUES ('CHAT-001', 'test-context', 'test-project', 'ask', 0)
      `
      ).run();

      const contextBefore = db.prepare('SELECT * FROM chat_contexts WHERE id = ?').get('CHAT-001');

      // Wait to ensure timestamp difference (SQLite timestamps have 1-second resolution)
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Add a turn
      db.prepare(
        `
        INSERT INTO chat_turns (context_id, turn_number, role, content)
        VALUES ('CHAT-001', 1, 'user', 'Hello')
      `
      ).run();

      const contextAfter = db.prepare('SELECT * FROM chat_contexts WHERE id = ?').get('CHAT-001');

      expect(contextAfter.turn_count).toBe(1);
      // The trigger should have updated last_active - check that they're different
      // (SQLite CURRENT_TIMESTAMP may have limited precision)
      expect(contextAfter.last_active).not.toBe(contextBefore.last_active);

      // Add another turn
      db.prepare(
        `
        INSERT INTO chat_turns (context_id, turn_number, role, content)
        VALUES ('CHAT-001', 2, 'assistant', 'Hi there!')
      `
      ).run();

      const contextFinal = db.prepare('SELECT * FROM chat_contexts WHERE id = ?').get('CHAT-001');
      expect(contextFinal.turn_count).toBe(2);
    });

    it('should track task source in timeline when creating non-CLI tasks', () => {
      // Create task with source='ask'
      db.prepare(
        `
        INSERT INTO tasks (id, name, source, context_id)
        VALUES ('TASK-001', 'Test task', 'ask', 'CHAT-001')
      `
      ).run();

      const timeline = db
        .prepare('SELECT * FROM task_timeline WHERE task_id = ? ORDER BY id DESC LIMIT 1')
        .get('TASK-001');

      expect(timeline).toBeTruthy();
      expect(timeline.action).toBe('created');
      expect(timeline.user).toBe('ask');
      expect(timeline.note).toBe('Task created via ask in context CHAT-001');

      const changes = JSON.parse(timeline.changes);
      expect(changes.source).toBe('ask');
      expect(changes.context_id).toBe('CHAT-001');
    });

    it('should not track CLI tasks in timeline', () => {
      // Create task with default source='cli'
      db.prepare(
        `
        INSERT INTO tasks (id, name)
        VALUES ('TASK-002', 'CLI task')
      `
      ).run();

      const timeline = db
        .prepare('SELECT * FROM task_timeline WHERE task_id = ? AND action = ?')
        .get('TASK-002', 'created');

      expect(timeline).toBeFalsy();
    });
  });

  describe('Data Integrity', () => {
    beforeEach(() => {
      migrationRunner.runPendingMigrations();
    });

    it('should enforce chat context type constraint', () => {
      expect(() => {
        db.prepare(
          `
          INSERT INTO chat_contexts (id, name, project_id, type)
          VALUES ('CHAT-001', 'test', 'project', 'invalid')
        `
        ).run();
      }).toThrow();
    });

    it('should enforce chat turn role constraint', () => {
      // Create context first
      db.prepare(
        `
        INSERT INTO chat_contexts (id, name, project_id, type)
        VALUES ('CHAT-001', 'test', 'project', 'ask')
      `
      ).run();

      expect(() => {
        db.prepare(
          `
          INSERT INTO chat_turns (context_id, turn_number, role, content)
          VALUES ('CHAT-001', 1, 'invalid', 'test')
        `
        ).run();
      }).toThrow();
    });

    it('should cascade delete turns when deleting context', () => {
      // Create context and turns
      db.prepare(
        `
        INSERT INTO chat_contexts (id, name, project_id, type)
        VALUES ('CHAT-001', 'test', 'project', 'ask')
      `
      ).run();

      db.prepare(
        `
        INSERT INTO chat_turns (context_id, turn_number, role, content)
        VALUES ('CHAT-001', 1, 'user', 'Hello')
      `
      ).run();

      db.prepare(
        `
        INSERT INTO chat_turns (context_id, turn_number, role, content)
        VALUES ('CHAT-001', 2, 'assistant', 'Hi!')
      `
      ).run();

      // Delete context
      db.prepare('DELETE FROM chat_contexts WHERE id = ?').run('CHAT-001');

      // Check turns are gone
      const turns = db.prepare('SELECT * FROM chat_turns WHERE context_id = ?').all('CHAT-001');
      expect(turns).toHaveLength(0);
    });

    it('should handle JSON fields correctly', () => {
      db.prepare(
        `
        INSERT INTO chat_contexts (id, name, project_id, type)
        VALUES ('CHAT-001', 'test', 'project', 'ask')
      `
      ).run();

      const taskIds = JSON.stringify(['TASK-001', 'TASK-002']);
      const toolCalls = JSON.stringify([{ tool: 'create_task', params: { name: 'Test' } }]);

      db.prepare(
        `
        INSERT INTO chat_turns (context_id, turn_number, role, content, created_task_ids, tool_calls)
        VALUES (?, ?, ?, ?, ?, ?)
      `
      ).run('CHAT-001', 1, 'assistant', 'Created tasks', taskIds, toolCalls);

      const turn = db.prepare('SELECT * FROM chat_turns WHERE context_id = ?').get('CHAT-001');

      expect(JSON.parse(turn.created_task_ids)).toEqual(['TASK-001', 'TASK-002']);
      expect(JSON.parse(turn.tool_calls)[0].tool).toBe('create_task');
    });
  });

  describe('Migration Runner Integration', () => {
    it('should track migration as applied', () => {
      const result = migrationRunner.runPendingMigrations();

      expect(result.count).toBeGreaterThan(0);
      expect(result.migrations[0].status).toBe('success');

      // Check it's recorded
      const applied = db
        .prepare('SELECT * FROM migrations WHERE filename = ?')
        .get('001_add_chat_management.sql');
      expect(applied).toBeTruthy();

      // Running again should do nothing
      const secondRun = migrationRunner.runPendingMigrations();
      expect(secondRun.count).toBe(0);
    });
  });
});
