/**
 * Task Service Tests
 * 
 * @description Tests for task CRUD operations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initializeStorage } from '../../../src/storage/index.js';
import TaskService from '../../../src/core/services/task-service.js';
import { TaskStatus, Priority } from '../../../src/core/constants.js';
import { join } from 'path';
import { rmSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('TaskService', () => {
  let storage;
  let taskService;
  const testDir = join(__dirname, '../../temp/test-task-service');
  
  beforeEach(async () => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    
    // Initialize storage and service
    storage = await initializeStorage({ projectRoot: testDir });
    taskService = new TaskService(storage.db);
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

  describe('createTask', () => {
    it('should create a task with minimal data', async () => {
      const task = await taskService.createTask({
        name: 'Test task'
      });

      expect(task).toBeDefined();
      expect(task.string_id).toBe('TASK-001');
      expect(task.name).toBe('Test task');
      expect(task.status).toBe(TaskStatus.TODO);
      expect(task.priority).toBe(Priority.MEDIUM);
      expect(task.tags).toEqual([]);
      expect(task.created_at).toBeInstanceOf(Date);
      expect(task.updated_at).toBeInstanceOf(Date);
    });

    it('should create a task with full data', async () => {
      const taskData = {
        name: 'Complex task',
        description: 'This is a complex task',
        notes: 'Some initial notes',
        status: TaskStatus.ACTIVE,
        assignee: 'john',
        priority: Priority.HIGH,
        estimate: 8,
        due_date: '2024-12-31',
        tags: ['backend', 'api'],
        is_milestone: true
      };

      const task = await taskService.createTask(taskData);

      expect(task.string_id).toBe('TASK-001');
      expect(task.name).toBe(taskData.name);
      expect(task.description).toBe(taskData.description);
      expect(task.notes).toBe(taskData.notes);
      expect(task.status).toBe(taskData.status);
      expect(task.assignee).toBe(taskData.assignee);
      expect(task.priority).toBe(taskData.priority);
      expect(task.estimate).toBe(taskData.estimate);
      expect(task.tags).toEqual(taskData.tags);
      expect(task.is_milestone).toBe(true);
    });

    it('should increment task IDs', async () => {
      const task1 = await taskService.createTask({ name: 'Task 1' });
      const task2 = await taskService.createTask({ name: 'Task 2' });
      const task3 = await taskService.createTask({ name: 'Task 3' });

      expect(task1.string_id).toBe('TASK-001');
      expect(task2.string_id).toBe('TASK-002');
      expect(task3.string_id).toBe('TASK-003');
    });

    it('should validate required fields', async () => {
      await expect(taskService.createTask({})).rejects.toThrow('Task name is required');
    });

    it('should validate status', async () => {
      await expect(taskService.createTask({
        name: 'Test',
        status: 'invalid-status'
      })).rejects.toThrow('Invalid status: invalid-status');
    });

    it('should validate priority', async () => {
      await expect(taskService.createTask({
        name: 'Test',
        priority: 'invalid-priority'
      })).rejects.toThrow('Invalid priority: invalid-priority');
    });

    it('should record creation in history', async () => {
      const task = await taskService.createTask({ name: 'Test task' });
      
      const history = storage.db.prepare(
        'SELECT * FROM task_history WHERE task_id = ?'
      ).all(task.id);

      expect(history).toHaveLength(1);
      expect(history[0].field_name).toBe('create');
      expect(history[0].change_type).toBe('CREATE');
    });
  });

  describe('getTask', () => {
    it('should get task by string ID', async () => {
      const created = await taskService.createTask({ name: 'Test task' });
      const task = await taskService.getTask('TASK-001');

      expect(task).toBeDefined();
      expect(task.string_id).toBe(created.string_id);
      expect(task.name).toBe(created.name);
    });

    it('should get task by numeric ID', async () => {
      const created = await taskService.createTask({ name: 'Test task' });
      const task = await taskService.getTask(created.id);

      expect(task).toBeDefined();
      expect(task.id).toBe(created.id);
      expect(task.name).toBe(created.name);
    });

    it('should return null for non-existent task', async () => {
      const task = await taskService.getTask('TASK-999');
      expect(task).toBeNull();
    });

    it('should include tags', async () => {
      const created = await taskService.createTask({
        name: 'Test task',
        tags: ['frontend', 'urgent']
      });

      const task = await taskService.getTask(created.string_id);
      expect(task.tags).toEqual(['frontend', 'urgent']);
    });

    it('should convert timestamps to Date objects', async () => {
      const created = await taskService.createTask({ name: 'Test task' });
      const task = await taskService.getTask(created.string_id);

      expect(task.created_at).toBeInstanceOf(Date);
      expect(task.updated_at).toBeInstanceOf(Date);
    });
  });

  describe('updateTask', () => {
    it('should update task fields', async () => {
      const task = await taskService.createTask({ name: 'Original name' });
      
      const updated = await taskService.updateTask(task.string_id, {
        name: 'Updated name',
        description: 'Added description',
        priority: Priority.HIGH
      });

      expect(updated.name).toBe('Updated name');
      expect(updated.description).toBe('Added description');
      expect(updated.priority).toBe(Priority.HIGH);
    });

    it('should validate status transitions', async () => {
      const task = await taskService.createTask({
        name: 'Test task',
        status: TaskStatus.TODO
      });

      // Valid transition: todo → active
      const active = await taskService.updateTask(task.string_id, {
        status: TaskStatus.ACTIVE
      });
      expect(active.status).toBe(TaskStatus.ACTIVE);

      // Invalid transition: active → todo
      await expect(taskService.updateTask(task.string_id, {
        status: TaskStatus.TODO
      })).rejects.toThrow('Invalid status transition: active → todo');
    });

    it('should set completed_at when status changes to completed', async () => {
      const task = await taskService.createTask({ name: 'Test task' });
      
      const completed = await taskService.updateTask(task.string_id, {
        status: TaskStatus.COMPLETED
      });

      expect(completed.completed_at).toBeInstanceOf(Date);
    });

    it('should update tags', async () => {
      const task = await taskService.createTask({
        name: 'Test task',
        tags: ['old-tag']
      });

      // Verify initial tags
      expect(task.tags).toEqual(['old-tag']);

      const updated = await taskService.updateTask(task.string_id, {
        tags: ['new-tag', 'another-tag']
      });

      expect(updated.tags.sort()).toEqual(['another-tag', 'new-tag']);
    });

    it('should record history for changes', async () => {
      const task = await taskService.createTask({
        name: 'Test task',
        priority: Priority.LOW
      });

      await taskService.updateTask(task.string_id, {
        name: 'Updated task',
        priority: Priority.HIGH,
        status: TaskStatus.ACTIVE
      });

      const history = storage.db.prepare(
        'SELECT * FROM task_history WHERE task_id = ? ORDER BY id'
      ).all(task.id);

      // Should have: create, name update, priority update, status change
      expect(history.length).toBe(4);
      
      const nameChange = history.find(h => h.field_name === 'name');
      expect(nameChange.old_value).toBe('Test task');
      expect(nameChange.new_value).toBe('Updated task');
      
      const statusChange = history.find(h => h.field_name === 'status');
      expect(statusChange.change_type).toBe('STATUS_CHANGE');
    });

    it('should handle no changes', async () => {
      const task = await taskService.createTask({ name: 'Test task' });
      const updated = await taskService.updateTask(task.string_id, {});
      
      expect(updated).toEqual(task);
    });

    it('should throw for non-existent task', async () => {
      await expect(taskService.updateTask('TASK-999', {
        name: 'Updated'
      })).rejects.toThrow('Task not found: TASK-999');
    });
  });

  describe('deleteTask', () => {
    it('should delete a task', async () => {
      const task = await taskService.createTask({ name: 'To be deleted' });
      
      await taskService.deleteTask(task.string_id);
      
      const deleted = await taskService.getTask(task.string_id);
      expect(deleted).toBeNull();
    });

    it('should cascade delete related records', async () => {
      const task = await taskService.createTask({
        name: 'Task with relations',
        tags: ['test']
      });

      await taskService.deleteTask(task.string_id);

      // Check that tags association is deleted
      const taskTags = storage.db.prepare(
        'SELECT * FROM task_tags WHERE task_id = ?'
      ).all(task.id);
      expect(taskTags).toHaveLength(0);

      // Check that history is deleted
      const history = storage.db.prepare(
        'SELECT * FROM task_history WHERE task_id = ?'
      ).all(task.id);
      expect(history).toHaveLength(0);
    });

    it('should prevent deletion if task has dependencies', async () => {
      const task1 = await taskService.createTask({ name: 'Task 1' });
      const task2 = await taskService.createTask({ name: 'Task 2' });
      
      // Create dependency: task2 depends on task1
      storage.db.prepare(
        'INSERT INTO task_dependencies (task_id, depends_on_id) VALUES (?, ?)'
      ).run(task2.id, task1.id);

      await expect(taskService.deleteTask(task1.string_id)).rejects.toThrow(
        'Task TASK-001 has 1 dependent tasks'
      );
    });

    it('should prevent deletion if task has children', async () => {
      const parent = await taskService.createTask({ name: 'Parent task' });
      const child = await taskService.createTask({
        name: 'Child task',
        parent_id: parent.id
      });

      await expect(taskService.deleteTask(parent.string_id)).rejects.toThrow(
        'Task TASK-001 has 1 child tasks'
      );
    });

    it('should force delete with dependencies', async () => {
      const task1 = await taskService.createTask({ name: 'Task 1' });
      const task2 = await taskService.createTask({ name: 'Task 2' });
      
      storage.db.prepare(
        'INSERT INTO task_dependencies (task_id, depends_on_id) VALUES (?, ?)'
      ).run(task2.id, task1.id);

      await taskService.deleteTask(task1.string_id, true);
      
      const deleted = await taskService.getTask(task1.string_id);
      expect(deleted).toBeNull();
    });

    it('should throw for non-existent task', async () => {
      await expect(taskService.deleteTask('TASK-999')).rejects.toThrow(
        'Task not found: TASK-999'
      );
    });
  });

  describe('listTasks', () => {
    beforeEach(async () => {
      // Create test tasks
      await taskService.createTask({
        name: 'Active high priority',
        status: TaskStatus.ACTIVE,
        priority: Priority.HIGH,
        assignee: 'alice'
      });
      
      await taskService.createTask({
        name: 'Todo medium priority',
        status: TaskStatus.TODO,
        priority: Priority.MEDIUM,
        assignee: 'bob'
      });
      
      await taskService.createTask({
        name: 'Completed task',
        status: TaskStatus.COMPLETED,
        priority: Priority.LOW
      });
      
      await taskService.createTask({
        name: 'Archived task',
        status: TaskStatus.ARCHIVED
      });
      
      await taskService.createTask({
        name: 'Milestone task',
        is_milestone: true
      });
    });

    it('should list all non-archived tasks by default', async () => {
      const tasks = await taskService.listTasks();
      
      expect(tasks).toHaveLength(4); // Excludes archived
      expect(tasks.every(t => t.status !== TaskStatus.ARCHIVED)).toBe(true);
    });

    it('should filter by status', async () => {
      const activeTasks = await taskService.listTasks({
        status: TaskStatus.ACTIVE
      });
      
      expect(activeTasks).toHaveLength(1);
      expect(activeTasks[0].name).toBe('Active high priority');
    });

    it('should filter by multiple statuses', async () => {
      const tasks = await taskService.listTasks({
        status: [TaskStatus.ACTIVE, TaskStatus.COMPLETED]
      });
      
      expect(tasks).toHaveLength(2);
    });

    it('should filter by assignee', async () => {
      const aliceTasks = await taskService.listTasks({
        assignee: 'alice'
      });
      
      expect(aliceTasks).toHaveLength(1);
      expect(aliceTasks[0].assignee).toBe('alice');
    });

    it('should filter by priority', async () => {
      const highPriorityTasks = await taskService.listTasks({
        priority: Priority.HIGH
      });
      
      expect(highPriorityTasks).toHaveLength(1);
      expect(highPriorityTasks[0].priority).toBe(Priority.HIGH);
    });

    it('should filter by milestone', async () => {
      const milestones = await taskService.listTasks({
        is_milestone: true
      });
      
      expect(milestones).toHaveLength(1);
      expect(milestones[0].name).toBe('Milestone task');
    });

    it('should include archived when requested', async () => {
      const allTasks = await taskService.listTasks({
        include_archived: true
      });
      
      expect(allTasks).toHaveLength(5);
    });

    it('should include tags in results', async () => {
      await taskService.createTask({
        name: 'Tagged task',
        tags: ['feature', 'ui']
      });
      
      const tasks = await taskService.listTasks();
      const taggedTask = tasks.find(t => t.name === 'Tagged task');
      
      expect(taggedTask.tags).toEqual(['feature', 'ui']);
    });

    it('should order by created_at DESC by default', async () => {
      const tasks = await taskService.listTasks();
      
      // Most recently created should be first
      expect(tasks[0].name).toBe('Milestone task');
    });
  });

  describe('changeTaskStatus', () => {
    it('should change task status with validation', async () => {
      const task = await taskService.createTask({ name: 'Test task' });
      
      const updated = await taskService.changeTaskStatus(
        task.string_id,
        TaskStatus.ACTIVE
      );
      
      expect(updated.status).toBe(TaskStatus.ACTIVE);
    });

    it('should validate status transition', async () => {
      const task = await taskService.createTask({
        name: 'Test task',
        status: TaskStatus.COMPLETED
      });
      
      await expect(taskService.changeTaskStatus(
        task.string_id,
        TaskStatus.ACTIVE
      )).rejects.toThrow('Invalid status transition');
    });
  });

  describe('edge cases', () => {
    it('should handle database not initialized', async () => {
      const serviceWithoutDb = new TaskService(null);
      
      await expect(serviceWithoutDb.createTask({ name: 'Test' }))
        .rejects.toThrow('Database not initialized');
      
      await expect(serviceWithoutDb.getTask('TASK-001'))
        .rejects.toThrow('Database not initialized');
      
      await expect(serviceWithoutDb.updateTask('TASK-001', {}))
        .rejects.toThrow('Database not initialized');
      
      await expect(serviceWithoutDb.deleteTask('TASK-001'))
        .rejects.toThrow('Database not initialized');
      
      await expect(serviceWithoutDb.listTasks())
        .rejects.toThrow('Database not initialized');
    });
  });
});