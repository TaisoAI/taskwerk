import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { TaskwerkDatabase } from '../../src/db/database.js';
import { applySchema } from '../../src/db/schema.js';
import { TaskwerkAPI } from '../../src/api/taskwerk-api.js';
import { TaskNotFoundError, TaskValidationError, TaskConflictError } from '../../src/errors/task-errors.js';

describe('TaskwerkAPI', () => {
  let tempDir;
  let db;
  let api;

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'taskwerk-api-test-'));
    const dbPath = join(tempDir, 'test.db');
    
    const database = new TaskwerkDatabase(dbPath);
    db = database.connect();
    applySchema(db);
    
    api = new TaskwerkAPI(database);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Task Creation', () => {
    it('should create a task with minimal data', async () => {
      const taskData = {
        name: 'Test task'
      };

      const task = await api.createTask(taskData);
      
      expect(task.id).toMatch(/^TASK-\d+$/);
      expect(task.name).toBe('Test task');
      expect(task.status).toBe('todo');
      expect(task.priority).toBe('medium');
      expect(task.created_by).toBe('system');
      expect(task.metadata).toEqual({});
      expect(task.context).toEqual({});
    });

    it('should create a task with custom ID', async () => {
      const taskData = {
        id: 'CUSTOM-123',
        name: 'Custom task'
      };

      const task = await api.createTask(taskData);
      
      expect(task.id).toBe('CUSTOM-123');
      expect(task.name).toBe('Custom task');
    });

    it('should create a task with all fields', async () => {
      const taskData = {
        name: 'Full task',
        description: 'Full description',
        status: 'in-progress',
        priority: 'high',
        assignee: 'user1',
        created_by: 'user1',
        estimate: 120,
        progress: 25,
        due_date: '2024-12-31T23:59:59.999Z',
        content: '# Task Content\\n\\nSome markdown content',
        category: 'feature',
        metadata: { custom: 'field' },
        context: { branch: 'feature/test' }
      };

      const task = await api.createTask(taskData);
      
      expect(task.name).toBe('Full task');
      expect(task.description).toBe('Full description');
      expect(task.status).toBe('in-progress');
      expect(task.priority).toBe('high');
      expect(task.assignee).toBe('user1');
      expect(task.created_by).toBe('user1');
      expect(task.estimate).toBe(120);
      expect(task.progress).toBe(25);
      expect(task.due_date).toBe('2024-12-31T23:59:59.999Z');
      expect(task.content).toBe('# Task Content\\n\\nSome markdown content');
      expect(task.category).toBe('feature');
      expect(task.metadata).toEqual({ custom: 'field' });
      expect(task.context).toEqual({ branch: 'feature/test' });
    });

    it('should validate required fields', async () => {
      const taskData = {};

      await expect(api.createTask(taskData))
        .rejects.toThrow(TaskValidationError);
    });

    it('should validate task ID format', async () => {
      const taskData = {
        id: 'invalid-id',
        name: 'Test task'
      };

      await expect(api.createTask(taskData))
        .rejects.toThrow(TaskValidationError);
    });

    it('should prevent duplicate task IDs', async () => {
      const taskData = {
        id: 'TASK-100',
        name: 'First task'
      };

      await api.createTask(taskData);
      
      await expect(api.createTask(taskData))
        .rejects.toThrow(TaskConflictError);
    });

    it('should validate status values', async () => {
      const taskData = {
        name: 'Test task',
        status: 'invalid-status'
      };

      await expect(api.createTask(taskData))
        .rejects.toThrow(TaskValidationError);
    });

    it('should validate priority values', async () => {
      const taskData = {
        name: 'Test task',
        priority: 'invalid-priority'
      };

      await expect(api.createTask(taskData))
        .rejects.toThrow(TaskValidationError);
    });
  });

  describe('Task Retrieval', () => {
    it('should get a task by ID', async () => {
      const taskData = {
        name: 'Get test task',
        description: 'Description for get test'
      };

      const created = await api.createTask(taskData);
      const retrieved = api.getTask(created.id);
      
      expect(retrieved.id).toBe(created.id);
      expect(retrieved.name).toBe('Get test task');
      expect(retrieved.description).toBe('Description for get test');
    });

    it('should throw error for non-existent task', () => {
      expect(() => api.getTask('TASK-999'))
        .toThrow(TaskNotFoundError);
    });

    it('should parse JSON fields correctly', async () => {
      const taskData = {
        name: 'JSON test task',
        metadata: { key: 'value', number: 42 },
        context: { env: 'test' }
      };

      const task = await api.createTask(taskData);
      const retrieved = api.getTask(task.id);
      
      expect(retrieved.metadata).toEqual({ key: 'value', number: 42 });
      expect(retrieved.context).toEqual({ env: 'test' });
    });
  });

  describe('Task Updates', () => {
    let taskId;

    beforeEach(async () => {
      const task = await api.createTask({
        name: 'Update test task',
        status: 'todo',
        priority: 'medium'
      });
      taskId = task.id;
    });

    it('should update task fields', async () => {
      const updates = {
        name: 'Updated task name',
        status: 'in-progress',
        priority: 'high',
        progress: 50
      };

      const updated = await api.updateTask(taskId, updates, 'user1');
      
      expect(updated.name).toBe('Updated task name');
      expect(updated.status).toBe('in-progress');
      expect(updated.priority).toBe('high');
      expect(updated.progress).toBe(50);
      expect(updated.updated_by).toBe('user1');
    });

    it('should validate update data', async () => {
      const updates = {
        status: 'invalid-status'
      };

      await expect(api.updateTask(taskId, updates))
        .rejects.toThrow(TaskValidationError);
    });

    it('should prevent updating task ID', async () => {
      const updates = {
        id: 'NEW-ID'
      };

      await expect(api.updateTask(taskId, updates))
        .rejects.toThrow(TaskValidationError);
    });

    it('should throw error for non-existent task', async () => {
      const updates = { name: 'New name' };

      await expect(api.updateTask('TASK-999', updates))
        .rejects.toThrow(TaskNotFoundError);
    });

    it('should update JSON fields', async () => {
      const updates = {
        metadata: { updated: true, count: 5 },
        context: { branch: 'feature/update' }
      };

      const updated = await api.updateTask(taskId, updates);
      
      expect(updated.metadata).toEqual({ updated: true, count: 5 });
      expect(updated.context).toEqual({ branch: 'feature/update' });
    });
  });

  describe('Task Deletion', () => {
    let taskId;

    beforeEach(async () => {
      const task = await api.createTask({
        name: 'Delete test task'
      });
      taskId = task.id;
    });

    it('should delete a task', async () => {
      const result = await api.deleteTask(taskId, 'user1');
      
      expect(result).toBe(true);
      expect(() => api.getTask(taskId))
        .toThrow(TaskNotFoundError);
    });

    it('should throw error for non-existent task', async () => {
      await expect(api.deleteTask('TASK-999'))
        .rejects.toThrow(TaskNotFoundError);
    });
  });

  describe('Task Listing', () => {
    beforeEach(async () => {
      // Create test tasks
      await api.createTask({
        name: 'Task 1',
        status: 'todo',
        priority: 'high',
        assignee: 'user1',
        category: 'feature'
      });

      await api.createTask({
        name: 'Task 2',
        status: 'in-progress',
        priority: 'medium',
        assignee: 'user2',
        category: 'bug'
      });

      await api.createTask({
        name: 'Task 3',
        status: 'done',
        priority: 'low',
        assignee: 'user1',
        category: 'feature'
      });
    });

    it('should list all tasks', () => {
      const tasks = api.listTasks();
      
      expect(tasks).toHaveLength(3);
      expect(tasks.map(t => t.name)).toContain('Task 1');
      expect(tasks.map(t => t.name)).toContain('Task 2');
      expect(tasks.map(t => t.name)).toContain('Task 3');
    });

    it('should filter by status', () => {
      const tasks = api.listTasks({ status: 'todo' });
      
      expect(tasks).toHaveLength(1);
      expect(tasks[0].name).toBe('Task 1');
    });

    it('should filter by priority', () => {
      const tasks = api.listTasks({ priority: 'high' });
      
      expect(tasks).toHaveLength(1);
      expect(tasks[0].name).toBe('Task 1');
    });

    it('should filter by assignee', () => {
      const tasks = api.listTasks({ assignee: 'user1' });
      
      expect(tasks).toHaveLength(2);
      expect(tasks.map(t => t.name)).toContain('Task 1');
      expect(tasks.map(t => t.name)).toContain('Task 3');
    });

    it('should filter by category', () => {
      const tasks = api.listTasks({ category: 'feature' });
      
      expect(tasks).toHaveLength(2);
      expect(tasks.map(t => t.name)).toContain('Task 1');
      expect(tasks.map(t => t.name)).toContain('Task 3');
    });

    it('should apply limit and offset', () => {
      const tasks = api.listTasks({ limit: 2, offset: 1 });
      
      expect(tasks).toHaveLength(2);
    });

    it('should order results', () => {
      const tasks = api.listTasks({ 
        order_by: 'name', 
        order_dir: 'ASC' 
      });
      
      expect(tasks[0].name).toBe('Task 1');
      expect(tasks[1].name).toBe('Task 2');
      expect(tasks[2].name).toBe('Task 3');
    });
  });

  describe('Timeline', () => {
    let taskId;

    beforeEach(async () => {
      const task = await api.createTask({
        name: 'Timeline test task'
      });
      taskId = task.id;
    });

    it('should add timeline events on create', () => {
      const timeline = api.getTaskTimeline(taskId);
      
      expect(timeline).toHaveLength(1);
      expect(timeline[0].action).toBe('created');
      expect(timeline[0].note).toBe('Task created');
    });

    it('should add timeline events on update', async () => {
      await api.updateTask(taskId, { status: 'in-progress' }, 'user1');
      
      const timeline = api.getTaskTimeline(taskId);
      
      expect(timeline).toHaveLength(2);
      expect(timeline[0].action).toBe('updated');
      expect(timeline[0].user).toBe('user1');
      expect(timeline[0].note).toBe('Task updated');
    });

    it('should manually add timeline events', async () => {
      await api.addTimelineEvent(taskId, 'commented', 'user1', 'Added a comment');
      
      const timeline = api.getTaskTimeline(taskId);
      
      expect(timeline).toHaveLength(2);
      expect(timeline[0].action).toBe('commented');
      expect(timeline[0].user).toBe('user1');
      expect(timeline[0].note).toBe('Added a comment');
    });
  });

  describe('Advanced Queries', () => {
    beforeEach(async () => {
      // Create test data
      await api.createTask({
        name: 'Search task 1',
        description: 'This is a test description',
        status: 'todo',
        priority: 'high'
      });

      await api.createTask({
        name: 'Different task',
        content: 'Contains search keyword',
        status: 'in-progress',
        priority: 'medium'
      });

      await api.createTask({
        name: 'Another task',
        status: 'done',
        priority: 'low'
      });
    });

    it('should search tasks by text', () => {
      const results = api.searchTasks('search');
      
      expect(results).toHaveLength(2);
      expect(results.map(t => t.name)).toContain('Search task 1');
      expect(results.map(t => t.name)).toContain('Different task');
    });

    it('should get tasks by status', () => {
      const results = api.getTasksByStatus('todo');
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Search task 1');
    });

    it('should get task statistics', () => {
      const stats = api.getTaskStats();
      
      expect(stats.total).toBe(3);
      expect(stats.by_status.todo).toBe(1);
      expect(stats.by_status['in-progress']).toBe(1);
      expect(stats.by_status.done).toBe(1);
      expect(stats.by_priority.high).toBe(1);
      expect(stats.by_priority.medium).toBe(1);
      expect(stats.by_priority.low).toBe(1);
    });
  });

  describe('Tags', () => {
    let taskId;

    beforeEach(async () => {
      const task = await api.createTask({
        name: 'Tag test task'
      });
      taskId = task.id;
    });

    it('should add tags to a task', async () => {
      await api.addTaskTags(taskId, ['bug', 'urgent', 'frontend']);
      
      const tags = api.getTaskTags(taskId);
      
      expect(tags).toHaveLength(3);
      expect(tags).toContain('bug');
      expect(tags).toContain('urgent');
      expect(tags).toContain('frontend');
    });

    it('should remove tags from a task', async () => {
      await api.addTaskTags(taskId, ['bug', 'urgent', 'frontend']);
      await api.removeTaskTags(taskId, ['urgent']);
      
      const tags = api.getTaskTags(taskId);
      
      expect(tags).toHaveLength(2);
      expect(tags).toContain('bug');
      expect(tags).toContain('frontend');
      expect(tags).not.toContain('urgent');
    });

    it('should handle duplicate tags gracefully', async () => {
      await api.addTaskTags(taskId, ['bug', 'bug', 'urgent']);
      
      const tags = api.getTaskTags(taskId);
      
      expect(tags).toHaveLength(2);
      expect(tags).toContain('bug');
      expect(tags).toContain('urgent');
    });
  });

  describe('Transactions', () => {
    it('should execute operations in a transaction', () => {
      const result = api.transaction((api) => {
        // Use direct database operations for sync transaction test
        const stmt1 = db.prepare(`
          INSERT INTO tasks (id, name, status, created_by, updated_by)
          VALUES ('TRANS-1', 'Transaction task 1', 'todo', 'system', 'system')
        `);
        stmt1.run();
        
        const stmt2 = db.prepare(`
          INSERT INTO tasks (id, name, status, created_by, updated_by)
          VALUES ('TRANS-2', 'Transaction task 2', 'todo', 'system', 'system')
        `);
        stmt2.run();
        
        const updateStmt = db.prepare(`
          UPDATE tasks SET status = 'in-progress' WHERE id = 'TRANS-1'
        `);
        updateStmt.run();
        
        return ['TRANS-1', 'TRANS-2'];
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toBe('TRANS-1');
      expect(result[1]).toBe('TRANS-2');
      
      const updated = api.getTask('TRANS-1');
      expect(updated.status).toBe('in-progress');
    });

    it('should rollback on error', () => {
      expect(() => {
        api.transaction((api) => {
          const stmt = db.prepare(`
            INSERT INTO tasks (id, name, status, created_by, updated_by)
            VALUES ('ERROR-1', 'Transaction task', 'todo', 'system', 'system')
          `);
          stmt.run();
          throw new Error('Intentional error');
        });
      }).toThrow('Intentional error');

      // Check that no tasks were created
      expect(() => api.getTask('ERROR-1')).toThrow(TaskNotFoundError);
    });
  });
});