import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { ContextManager } from '../../src/chat/context-manager.js';
import { applySchema } from '../../src/db/schema.js';
import { TestMigrationRunner } from '../helpers/test-migration-runner.js';
import { mkdtemp, rm, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

describe('ContextManager', () => {
  let db;
  let tempDir;
  let contextManager;
  let originalCwd;

  beforeEach(async () => {
    // Save original cwd
    originalCwd = process.cwd();

    // Create temp directory and database
    tempDir = await mkdtemp(join(tmpdir(), 'taskwerk-test-'));
    const dbPath = join(tempDir, 'test.db');
    db = new Database(dbPath);

    // Apply base schema and migrations
    applySchema(db);
    const migrationRunner = new TestMigrationRunner(db);
    migrationRunner.runPendingMigrations();

    // Create context manager
    contextManager = new ContextManager(db);
  });

  afterEach(async () => {
    // Restore original cwd
    process.chdir(originalCwd);

    db.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Project Detection', () => {
    it('should detect project when .taskwerk exists', async () => {
      // Create .taskwerk directory
      const projectDir = join(tempDir, 'my-project');
      await mkdir(projectDir, { recursive: true });
      await mkdir(join(projectDir, '.taskwerk'));

      // Change to project directory
      process.chdir(projectDir);

      const result = await contextManager.detectProject();
      expect(result.isProject).toBe(true);
      expect(result.projectId).toBe('my-project');
    });

    it('should not detect project without .taskwerk', async () => {
      // Change to temp directory (no .taskwerk)
      process.chdir(tempDir);

      const result = await contextManager.detectProject();
      expect(result.isProject).toBe(false);
      expect(result.projectId).toBe(null);
    });
  });

  describe('Context Creation', () => {
    it('should create project context when in project', async () => {
      // Setup project directory
      const projectDir = join(tempDir, 'webapp');
      await mkdir(projectDir, { recursive: true });
      await mkdir(join(projectDir, '.taskwerk'));
      process.chdir(projectDir);

      const context = await contextManager.getOrCreateContext('ask', {
        firstPrompt: 'implement authentication',
      });

      expect(context.scope).toBe('project');
      expect(context.project_id).toBe('webapp');
      expect(context.display).toBe('[Project: webapp]');
      expect(context.name).toBe('implement-authentication');
      expect(context.type).toBe('ask');
    });

    it('should create global context when not in project', async () => {
      // Change to non-project directory
      process.chdir(tempDir);

      const context = await contextManager.getOrCreateContext('ask', {
        firstPrompt: 'how to parse JSON',
      });

      expect(context.scope).toBe('global');
      expect(context.project_id).toBe('GLOBAL');
      expect(context.display).toBe('[Global: general]');
      expect(context.name).toBe('general');
    });

    it('should create named global context', async () => {
      const context = await contextManager.getOrCreateContext('agent', {
        contextName: 'python-tips',
        firstPrompt: 'python best practices',
      });

      expect(context.scope).toBe('global');
      expect(context.name).toBe('python-tips');
      expect(context.display).toBe('[Global: python-tips]');
    });

    it('should generate incremental context IDs', async () => {
      const context1 = await contextManager.getOrCreateContext('ask', { forceNew: true });
      expect(context1.id).toBe('CHAT-001');

      const context2 = await contextManager.getOrCreateContext('ask', { forceNew: true });
      expect(context2.id).toBe('CHAT-002');

      const context3 = await contextManager.getOrCreateContext('ask', { forceNew: true });
      expect(context3.id).toBe('CHAT-003');
    });
  });

  describe('Context Continuation', () => {
    let continuationDb;
    let continuationManager;

    beforeEach(async () => {
      // Create a fresh database for context continuation tests
      const dbPath = join(tempDir, `continuation-test-${Date.now()}.db`);
      continuationDb = new Database(dbPath);
      applySchema(continuationDb);
      const migrationRunner = new TestMigrationRunner(continuationDb);
      migrationRunner.runPendingMigrations();
      continuationManager = new ContextManager(continuationDb);
    });

    afterEach(() => {
      if (continuationDb) {
        continuationDb.close();
      }
    });

    it('should continue recent project context within time window', async () => {
      // Setup project
      const projectDir = join(tempDir, 'webapp');
      await mkdir(projectDir, { recursive: true });
      await mkdir(join(projectDir, '.taskwerk'));
      process.chdir(projectDir);

      // Create first context
      const context1 = await continuationManager.getOrCreateContext('ask', {
        firstPrompt: 'implement auth',
      });

      // Verify it's a valid context ID (CHAT-XXX format)
      expect(context1.id).toMatch(/^CHAT-\d{3}$/);

      // Small delay to ensure we're within continuation window
      await new Promise(resolve => setTimeout(resolve, 10));

      // Get context again (should continue)
      const context2 = await continuationManager.getOrCreateContext('ask');

      // Should continue the same context (same ID)
      expect(context2.id).toBe(context1.id);
      expect(context2.name).toBe(context1.name);
      expect(context2.project_id).toBe('webapp');
      expect(context2.type).toBe('ask');
    });

    it('should create new context after time window expires', async () => {
      // Setup project
      const projectDir = join(tempDir, 'webapp');
      await mkdir(projectDir, { recursive: true });
      await mkdir(join(projectDir, '.taskwerk'));
      process.chdir(projectDir);

      // Create context with short continuation window
      const shortWindowManager = new ContextManager(continuationDb, {
        continuationWindow: 100, // 100ms
      });

      const context1 = await shortWindowManager.getOrCreateContext('ask');

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      const context2 = await shortWindowManager.getOrCreateContext('ask');

      expect(context2.id).not.toBe(context1.id);
    });

    it('should force new context with forceNew option', async () => {
      const context1 = await continuationManager.getOrCreateContext('ask');
      const context2 = await continuationManager.getOrCreateContext('ask', { forceNew: true });

      expect(context2.id).not.toBe(context1.id);
    });

    it('should not mix contexts between different types', async () => {
      const askContext = await continuationManager.getOrCreateContext('ask');
      const agentContext = await continuationManager.getOrCreateContext('agent');

      expect(agentContext.id).not.toBe(askContext.id);
      expect(agentContext.type).toBe('agent');
      expect(askContext.type).toBe('ask');
    });
  });

  describe('Context Name Generation', () => {
    it('should generate meaningful names from prompts', () => {
      const testCases = [
        { prompt: 'implement user authentication', expected: 'implement-user-authentication' },
        { prompt: 'How do I parse JSON?', expected: 'parse-json' },
        { prompt: 'fix the login bug', expected: 'fix-login-bug' },
        { prompt: 'I need to add tests', expected: 'need-add-tests' },
        { prompt: 'the quick brown fox', expected: 'quick-brown-fox' },
        { prompt: '', expected: 'conversation' },
      ];

      for (const { prompt, expected } of testCases) {
        const name = contextManager.generateContextName(prompt);
        expect(name).toBe(expected);
      }
    });
  });

  describe('Turn Management', () => {
    let context;

    beforeEach(async () => {
      context = await contextManager.getOrCreateContext('ask', {
        firstPrompt: 'test conversation',
      });
    });

    it('should add turns to context', async () => {
      await contextManager.addTurn(context.id, 'user', 'Hello');
      await contextManager.addTurn(context.id, 'assistant', 'Hi there!');

      const history = await contextManager.getHistory(context.id);
      expect(history).toHaveLength(2);
      expect(history[0].role).toBe('user');
      expect(history[0].content).toBe('Hello');
      expect(history[1].role).toBe('assistant');
      expect(history[1].content).toBe('Hi there!');
    });

    it('should store metadata with turns', async () => {
      await contextManager.addTurn(context.id, 'assistant', 'I created some tasks', {
        createdTaskIds: ['TASK-001', 'TASK-002'],
        toolCalls: [{ tool: 'create_task', params: { name: 'Test' } }],
      });

      const history = await contextManager.getHistory(context.id);
      expect(history[0].created_task_ids).toEqual(['TASK-001', 'TASK-002']);
      expect(history[0].tool_calls[0].tool).toBe('create_task');
    });

    it('should update context turn count via trigger', async () => {
      const before = db
        .prepare('SELECT turn_count FROM chat_contexts WHERE id = ?')
        .get(context.id);
      expect(before.turn_count).toBe(0);

      await contextManager.addTurn(context.id, 'user', 'Hello');

      const after = db.prepare('SELECT turn_count FROM chat_contexts WHERE id = ?').get(context.id);
      expect(after.turn_count).toBe(1);
    });

    it('should throw error for non-existent context', async () => {
      await expect(contextManager.addTurn('INVALID-ID', 'user', 'Hello')).rejects.toThrow(
        'Context not found'
      );
    });
  });

  describe('Context Listing', () => {
    beforeEach(async () => {
      // Create mix of contexts
      await contextManager.getOrCreateContext('ask', { contextName: 'python-tips' });
      await contextManager.getOrCreateContext('agent', { contextName: 'aws-notes' });

      // Create project context
      const projectDir = join(tempDir, 'myapp');
      await mkdir(projectDir, { recursive: true });
      await mkdir(join(projectDir, '.taskwerk'));
      process.chdir(projectDir);
      await contextManager.getOrCreateContext('ask', { firstPrompt: 'project task' });
    });

    it('should list all contexts', async () => {
      const contexts = await contextManager.listContexts({ all: true });
      expect(contexts).toHaveLength(3);
    });

    it('should list only global contexts', async () => {
      const contexts = await contextManager.listContexts({ global: true });
      expect(contexts).toHaveLength(2);
      expect(contexts.every(c => c.project_id === 'GLOBAL')).toBe(true);
    });

    it('should list only project contexts', async () => {
      const contexts = await contextManager.listContexts({ projectId: 'myapp' });
      expect(contexts).toHaveLength(1);
      expect(contexts[0].project_id).toBe('myapp');
    });
  });

  describe('Context Operations', () => {
    it('should rename context', async () => {
      const context = await contextManager.getOrCreateContext('ask', {
        contextName: 'old-name',
      });

      await contextManager.renameContext(context.id, 'new-name');

      const updated = await contextManager.findContextByName('new-name', 'GLOBAL');
      expect(updated).toBeTruthy();
      expect(updated.id).toBe(context.id);
    });

    it('should get context details with stats', async () => {
      const context = await contextManager.getOrCreateContext('ask');

      // Add some turns
      await contextManager.addTurn(context.id, 'user', 'Hello');
      await contextManager.addTurn(context.id, 'assistant', 'Hi!');

      // Create a task linked to this context
      db.prepare(
        `
        INSERT INTO tasks (id, name, context_id) 
        VALUES ('TASK-001', 'Test task', ?)
      `
      ).run(context.id);

      const details = await contextManager.getContextDetails(context.id);

      expect(details.task_count).toBe(1);
      expect(details.recent_turns).toHaveLength(2);
      expect(details.turn_count).toBe(2);
    });

    it('should cleanup old contexts', async () => {
      // Create context and manually set old timestamp
      const context = await contextManager.getOrCreateContext('ask');

      const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000); // 100 days ago
      db.prepare('UPDATE chat_contexts SET last_active = ? WHERE id = ?').run(
        oldDate.toISOString(),
        context.id
      );

      const result = await contextManager.cleanupContexts(90);

      expect(result.count).toBe(1);
      expect(result.contexts[0].id).toBe(context.id);

      // Verify it's gone
      const remaining = await contextManager.listContexts({ all: true });
      expect(remaining).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Close database to cause errors
      db.close();

      await expect(contextManager.getOrCreateContext('ask')).rejects.toThrow();
    });

    it('should validate context type', async () => {
      // Direct database insert with invalid type should fail
      expect(() => {
        db.prepare(
          `
          INSERT INTO chat_contexts (id, name, project_id, type)
          VALUES ('CHAT-999', 'test', 'GLOBAL', 'invalid')
        `
        ).run();
      }).toThrow();
    });
  });
});
