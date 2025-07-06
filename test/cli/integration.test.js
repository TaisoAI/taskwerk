import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeTaskCommand } from '../../src/cli/commands/task/index.js';
import { makeInitCommand } from '../../src/cli/commands/system/init.js';
import { makeStatusCommand } from '../../src/cli/commands/system/status.js';
import { initializeStorage } from '../../src/storage/index.js';
import { TaskwerkAPI } from '../../src/core/api.js';
import { rmSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('CLI Integration Tests', () => {
  let testDir;
  let storage;
  let originalCwd;
  
  beforeEach(async () => {
    originalCwd = process.cwd();
    testDir = join(tmpdir(), `taskwerk-test-${Date.now()}`);
    
    // Create directory and change to it
    mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);
  });
  
  afterEach(() => {
    if (storage?.db) {
      storage.close();
    }
    process.chdir(originalCwd);
    rmSync(testDir, { recursive: true, force: true });
  });
  
  describe('init command', () => {
    it('should initialize taskwerk project', async () => {
      const command = makeInitCommand();
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await command.parseAsync(['node', 'test']);
      
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('✓'));
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Taskwerk initialized'));
      
      consoleLog.mockRestore();
    });
  });
  
  describe('task commands', () => {
    beforeEach(async () => {
      storage = await initializeStorage(testDir);
    });
    
    it('should add a new task', async () => {
      const command = makeTaskCommand();
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await command.parseAsync(['node', 'test', 'add', 'Test integration task']);
      
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('✓'));
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('TASK-001'));
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Test integration task'));
      
      consoleLog.mockRestore();
    });
    
    it('should list tasks', async () => {
      // Create some tasks first
      const api = new TaskwerkAPI({ database: storage.db });
      await api.createTask({ name: 'Task 1', status: 'todo' });
      await api.createTask({ name: 'Task 2', status: 'active' });
      
      const command = makeTaskCommand();
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await command.parseAsync(['node', 'test', 'list']);
      
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Task 1'));
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Task 2'));
      
      consoleLog.mockRestore();
    });
    
    it('should show task details', async () => {
      const api = new TaskwerkAPI({ database: storage.db });
      await api.createTask({
        name: 'Detailed task',
        description: 'A task with details',
        priority: 'high',
        status: 'active'
      });
      
      const command = makeTaskCommand();
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await command.parseAsync(['node', 'test', 'show', 'TASK-001']);
      
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Detailed task'));
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('A task with details'));
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('high'));
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('active'));
      
      consoleLog.mockRestore();
    });
    
    it('should update task', async () => {
      const api = new TaskwerkAPI({ database: storage.db });
      await api.createTask({ name: 'Original name', status: 'todo' });
      
      const command = makeTaskCommand();
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await command.parseAsync(['node', 'test', 'update', 'TASK-001', '--name', 'Updated name']);
      
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('✓'));
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Updated TASK-001'));
      
      // Verify the update
      const updated = await api.getTask('TASK-001');
      expect(updated.name).toBe('Updated name');
      
      consoleLog.mockRestore();
    });
    
    it('should change task status', async () => {
      const api = new TaskwerkAPI({ database: storage.db });
      await api.createTask({ name: 'Status test', status: 'todo' });
      
      const command = makeTaskCommand();
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await command.parseAsync(['node', 'test', 'status', 'TASK-001', 'active']);
      
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('✓'));
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Changed TASK-001 status from todo to active'));
      
      // Verify the change
      const updated = await api.getTask('TASK-001');
      expect(updated.status).toBe('active');
      
      consoleLog.mockRestore();
    });
    
    it('should delete task', async () => {
      const api = new TaskwerkAPI({ database: storage.db });
      await api.createTask({ name: 'Delete me', status: 'todo' });
      
      const command = makeTaskCommand();
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await command.parseAsync(['node', 'test', 'delete', 'TASK-001']);
      
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('✓'));
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Archived TASK-001'));
      
      // Verify task is archived
      const task = await api.getTask('TASK-001');
      expect(task.status).toBe('archived');
      
      consoleLog.mockRestore();
    });
  });
  
  describe('status command', () => {
    beforeEach(async () => {
      storage = await initializeStorage(testDir);
    });
    
    it('should show project status', async () => {
      // Create some test data
      const api = new TaskwerkAPI({ database: storage.db });
      await api.createTask({ name: 'Todo task', status: 'todo' });
      await api.createTask({ name: 'Active task', status: 'active' });
      await api.createTask({ name: 'Completed task', status: 'completed' });
      
      const command = makeStatusCommand();
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await command.parseAsync(['node', 'test']);
      
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Taskwerk Project Status'));
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Total Tasks: 3'));
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Todo: 1'));
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Active: 1'));
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Completed: 1'));
      
      consoleLog.mockRestore();
    });
  });
  
  describe('error handling', () => {
    beforeEach(async () => {
      storage = await initializeStorage(testDir);
    });
    
    it('should handle non-existent task', async () => {
      const command = makeTaskCommand();
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      await command.parseAsync(['node', 'test', 'show', 'TASK-999']);
      
      expect(consoleError).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Task not found')
      );
      
      consoleError.mockRestore();
    });
    
    it('should validate required fields', async () => {
      const command = makeTaskCommand();
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Try to create task without name
      await command.parseAsync(['node', 'test', 'add']);
      
      expect(consoleError).toHaveBeenCalled();
      
      consoleError.mockRestore();
    });
  });
});