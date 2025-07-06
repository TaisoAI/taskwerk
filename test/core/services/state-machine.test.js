/**
 * State Machine Service Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initializeStorage } from '../../../src/storage/index.js';
import StateMachine from '../../../src/core/services/state-machine.js';
import TaskService from '../../../src/core/services/task-service.js';
import { TaskStatus } from '../../../src/core/constants.js';

describe('StateMachine', () => {
  let db;
  let storage;
  let stateMachine;
  let taskService;

  beforeEach(async () => {
    // Create in-memory database
    db = new Database(':memory:');
    
    // Initialize schema - this properly initializes the database
    storage = await initializeStorage({ database: db, directory: ':memory:' });
    
    // Create services with the initialized database
    stateMachine = new StateMachine(storage.db);
    taskService = new TaskService(storage.db);
    
    // Update db reference to the initialized one
    db = storage.db;
  });

  afterEach(() => {
    if (storage && storage.close) {
      storage.close();
    }
  });

  describe('isValidTransition', () => {
    it('should validate allowed transitions', () => {
      expect(stateMachine.isValidTransition('todo', 'active')).toBe(true);
      expect(stateMachine.isValidTransition('active', 'completed')).toBe(true);
      expect(stateMachine.isValidTransition('completed', 'archived')).toBe(true);
    });

    it('should reject invalid transitions', () => {
      expect(stateMachine.isValidTransition('todo', 'paused')).toBe(false);
      expect(stateMachine.isValidTransition('completed', 'active')).toBe(false);
      expect(stateMachine.isValidTransition('archived', 'todo')).toBe(false);
    });
  });

  describe('getAllowedTransitions', () => {
    it('should return allowed transitions for each status', () => {
      expect(stateMachine.getAllowedTransitions('todo')).toEqual(['active', 'blocked', 'completed', 'archived']);
      expect(stateMachine.getAllowedTransitions('active')).toEqual(['paused', 'blocked', 'completed']);
      expect(stateMachine.getAllowedTransitions('archived')).toEqual([]);
    });
  });

  describe('transitionTask', () => {
    let task;

    beforeEach(async () => {
      task = await taskService.createTask({
        name: 'Test task',
        status: 'todo'
      });
    });

    it('should transition task to active', async () => {
      const result = await stateMachine.transitionTask(task.id, 'active');
      
      expect(result.taskId).toBe(task.id);
      expect(result.oldStatus).toBe('todo');
      expect(result.newStatus).toBe('active');
      
      const updated = await taskService.getTask(task.string_id);
      expect(updated.status).toBe('active');
    });

    it('should require reason when blocking', async () => {
      await expect(
        stateMachine.transitionTask(task.id, 'blocked')
      ).rejects.toThrow('Blocked reason is required');
    });

    it('should set blocked reason when blocking with reason', async () => {
      const result = await stateMachine.transitionTask(task.id, 'blocked', {
        reason: 'Waiting for dependencies'
      });
      
      expect(result.newStatus).toBe('blocked');
      
      const updated = await taskService.getTask(task.string_id);
      expect(updated.status).toBe('blocked');
      expect(updated.blocked_reason).toBe('Waiting for dependencies');
    });

    it('should clear blocked reason when unblocking', async () => {
      // First block the task
      await stateMachine.transitionTask(task.id, 'blocked', {
        reason: 'Test block'
      });
      
      // Then activate it
      await stateMachine.transitionTask(task.id, 'active');
      
      const updated = await taskService.getTask(task.string_id);
      expect(updated.status).toBe('active');
      expect(updated.blocked_reason).toBeNull();
    });

    it('should set completed_at when completing', async () => {
      await stateMachine.transitionTask(task.id, 'active');
      const result = await stateMachine.transitionTask(task.id, 'completed');
      
      expect(result.newStatus).toBe('completed');
      
      const updated = await taskService.getTask(task.string_id);
      expect(updated.status).toBe('completed');
      expect(updated.completed_at).toBeTruthy();
    });

    it('should record history for transitions', async () => {
      await stateMachine.transitionTask(task.id, 'active');
      
      const history = db.prepare(
        'SELECT * FROM task_history WHERE task_id = ? AND change_type = ?'
      ).all(task.id, 'status_change');
      
      expect(history).toHaveLength(1);
      expect(history[0].old_value).toBe('todo');
      expect(history[0].new_value).toBe('active');
    });

    it('should reject invalid transitions', async () => {
      await expect(
        stateMachine.transitionTask(task.id, 'paused')
      ).rejects.toThrow('Invalid status transition: todo → paused');
    });

    it('should only allow archiving completed tasks', async () => {
      await expect(
        stateMachine.transitionTask(task.id, 'archived')
      ).rejects.toThrow('Only completed tasks can be archived');
    });
  });

  describe('cascading transitions', () => {
    let parent, child1, child2;

    beforeEach(async () => {
      parent = await taskService.createTask({
        name: 'Parent task',
        status: 'active'
      });
      
      child1 = await taskService.createTask({
        name: 'Child 1',
        status: 'active',
        parent_id: parent.id
      });
      
      child2 = await taskService.createTask({
        name: 'Child 2',
        status: 'todo',
        parent_id: parent.id
      });
    });

    it('should cascade blocked status to children', async () => {
      const result = await stateMachine.transitionTask(parent.id, 'blocked', {
        reason: 'Parent blocked',
        cascade: true
      });
      
      expect(result.sideEffects).toHaveLength(2);
      
      const updatedChild1 = await taskService.getTask(child1.string_id);
      const updatedChild2 = await taskService.getTask(child2.string_id);
      
      expect(updatedChild1.status).toBe('blocked');
      expect(updatedChild2.status).toBe('blocked');
    });

    it('should not cascade without cascade option', async () => {
      await stateMachine.transitionTask(parent.id, 'blocked', {
        reason: 'Parent blocked',
        cascade: false
      });
      
      const updatedChild1 = await taskService.getTask(child1.string_id);
      expect(updatedChild1.status).toBe('active');
    });

    it('should cascade archive to completed children only', async () => {
      // Complete parent and child1
      await stateMachine.transitionTask(parent.id, 'completed');
      await stateMachine.transitionTask(child1.id, 'completed');
      
      // Archive parent with cascade
      const result = await stateMachine.transitionTask(parent.id, 'archived', {
        cascade: true
      });
      
      const updatedChild1 = await taskService.getTask(child1.string_id);
      const updatedChild2 = await taskService.getTask(child2.string_id);
      
      expect(updatedChild1.status).toBe('archived');
      expect(updatedChild2.status).toBe('todo'); // Not completed, so not archived
    });
  });

  describe('getTaskState', () => {
    it('should return current state info', async () => {
      const task = await taskService.createTask({
        name: 'Test task',
        status: 'active'
      });
      
      const state = await stateMachine.getTaskState(task.id);
      
      expect(state.currentStatus).toBe('active');
      expect(state.allowedTransitions).toEqual(['paused', 'blocked', 'completed']);
      expect(state.isTerminal).toBe(false);
    });

    it('should identify terminal states', async () => {
      const task = await taskService.createTask({
        name: 'Test task',
        status: 'completed'
      });
      
      await stateMachine.transitionTask(task.id, 'archived');
      
      const state = await stateMachine.getTaskState(task.id);
      expect(state.isTerminal).toBe(true);
    });
  });

  describe('validateBulkTransitions', () => {
    it('should validate multiple transitions', async () => {
      const task1 = await taskService.createTask({ name: 'Task 1', status: 'todo' });
      const task2 = await taskService.createTask({ name: 'Task 2', status: 'active' });
      
      const result = await stateMachine.validateBulkTransitions([
        { taskId: task1.id, newStatus: 'active' },
        { taskId: task2.id, newStatus: 'completed' },
        { taskId: 999, newStatus: 'active' }
      ]);
      
      expect(result.valid).toBe(false);
      expect(result.results[0].valid).toBe(true);
      expect(result.results[1].valid).toBe(true);
      expect(result.results[2].valid).toBe(false);
      expect(result.results[2].error).toBe('Task not found');
    });
  });

  describe('edge cases', () => {
    it('should handle database not initialized', async () => {
      const sm = new StateMachine(null);
      await expect(
        sm.transitionTask(1, 'active')
      ).rejects.toThrow('Database not initialized');
    });

    it('should handle non-existent task', async () => {
      await expect(
        stateMachine.transitionTask(999, 'active')
      ).rejects.toThrow('Task not found: 999');
    });
  });
});