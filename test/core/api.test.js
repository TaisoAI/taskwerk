/**
 * Core API Tests
 * 
 * @description Tests for the main Taskwerk API
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskwerkAPI } from '../../src/core/api.js';

describe('TaskwerkAPI', () => {
  describe('API Construction', () => {
    it('should create API instance with default options', () => {
      const api = new TaskwerkAPI();
      expect(api).toBeInstanceOf(TaskwerkAPI);
      expect(api.options.projectRoot).toBe(process.cwd());
      expect(api.db).toBe(null);
    });

    it('should create API instance with custom options', () => {
      const customRoot = '/custom/root';
      const api = new TaskwerkAPI({ projectRoot: customRoot });
      expect(api.options.projectRoot).toBe(customRoot);
    });

    it('should accept database instance', () => {
      const mockDb = { prepare: vi.fn() };
      const api = new TaskwerkAPI({ database: mockDb });
      expect(api.db).toBe(mockDb);
    });

    it('should set database after construction', () => {
      const api = new TaskwerkAPI();
      const mockDb = { prepare: vi.fn() };
      
      api.setDatabase(mockDb);
      expect(api.db).toBe(mockDb);
      expect(api.tasks.db).toBe(mockDb);
      expect(api.notes.db).toBe(mockDb);
      expect(api.query.db).toBe(mockDb);
      expect(api.importExport.db).toBe(mockDb);
    });
  });

  describe('Service Delegation', () => {
    let api;

    beforeEach(() => {
      api = new TaskwerkAPI();
    });

    it('should delegate createTask to TaskService', async () => {
      const taskData = { name: 'Test task' };
      api.tasks.createTask = vi.fn();
      
      await api.createTask(taskData);
      expect(api.tasks.createTask).toHaveBeenCalledWith(taskData);
    });

    it('should delegate getTask to TaskService', async () => {
      api.tasks.getTask = vi.fn();
      
      await api.getTask('TASK-001');
      expect(api.tasks.getTask).toHaveBeenCalledWith('TASK-001');
    });

    it('should delegate updateTask to TaskService', async () => {
      const updates = { status: 'active' };
      api.tasks.updateTask = vi.fn();
      
      await api.updateTask('TASK-001', updates);
      expect(api.tasks.updateTask).toHaveBeenCalledWith('TASK-001', updates);
    });

    it('should delegate deleteTask to TaskService with force parameter', async () => {
      api.tasks.deleteTask = vi.fn();
      
      await api.deleteTask('TASK-001', true);
      expect(api.tasks.deleteTask).toHaveBeenCalledWith('TASK-001', true);
    });

    it('should delegate deleteTask with default force=false', async () => {
      api.tasks.deleteTask = vi.fn();
      
      await api.deleteTask('TASK-001');
      expect(api.tasks.deleteTask).toHaveBeenCalledWith('TASK-001', false);
    });

    it('should delegate listTasks to TaskService', async () => {
      const filters = { status: 'active' };
      api.tasks.listTasks = vi.fn();
      
      await api.listTasks(filters);
      expect(api.tasks.listTasks).toHaveBeenCalledWith(filters);
    });

    it('should delegate addNote to NoteService', async () => {
      const note = 'Test note';
      api.notes.addNote = vi.fn();
      
      await api.addNote('TASK-001', note);
      expect(api.notes.addNote).toHaveBeenCalledWith('TASK-001', note);
    });

    it('should delegate getTaskNotes to NoteService', async () => {
      api.notes.getTaskNotes = vi.fn();
      
      await api.getTaskNotes('TASK-001');
      expect(api.notes.getTaskNotes).toHaveBeenCalledWith('TASK-001');
    });

    it('should delegate search to QueryService', async () => {
      const query = 'test query';
      api.query.search = vi.fn();
      
      await api.search(query);
      expect(api.query.search).toHaveBeenCalledWith(query);
    });

    it('should delegate getTasksByStatus to QueryService', async () => {
      api.query.getTasksByStatus = vi.fn();
      
      await api.getTasksByStatus('active');
      expect(api.query.getTasksByStatus).toHaveBeenCalledWith('active');
    });

    it('should delegate getTasksByDate to QueryService', async () => {
      const dateFilter = { after: '2024-01-01' };
      api.query.getTasksByDate = vi.fn();
      
      await api.getTasksByDate(dateFilter);
      expect(api.query.getTasksByDate).toHaveBeenCalledWith(dateFilter);
    });

    it('should delegate exportTasks to ImportExportService', async () => {
      const options = { format: 'json' };
      api.importExport.exportTasks = vi.fn();
      
      await api.exportTasks(options);
      expect(api.importExport.exportTasks).toHaveBeenCalledWith(options);
    });

    it('should delegate importTasks to ImportExportService', async () => {
      const data = { tasks: [] };
      api.importExport.importTasks = vi.fn();
      
      await api.importTasks(data);
      expect(api.importExport.importTasks).toHaveBeenCalledWith(data);
    });
  });

  describe('Return Value Propagation', () => {
    let api;

    beforeEach(() => {
      api = new TaskwerkAPI();
    });

    it('should return value from createTask', async () => {
      const mockTask = { id: 1, name: 'Test' };
      api.tasks.createTask = vi.fn().mockResolvedValue(mockTask);
      
      const result = await api.createTask({ name: 'Test' });
      expect(result).toBe(mockTask);
    });

    it('should return value from getTask', async () => {
      const mockTask = { id: 1, name: 'Test' };
      api.tasks.getTask = vi.fn().mockResolvedValue(mockTask);
      
      const result = await api.getTask('TASK-001');
      expect(result).toBe(mockTask);
    });

    it('should return value from updateTask', async () => {
      const mockTask = { id: 1, name: 'Updated' };
      api.tasks.updateTask = vi.fn().mockResolvedValue(mockTask);
      
      const result = await api.updateTask('TASK-001', { name: 'Updated' });
      expect(result).toBe(mockTask);
    });

    it('should return value from deleteTask', async () => {
      api.tasks.deleteTask = vi.fn().mockResolvedValue(undefined);
      
      const result = await api.deleteTask('TASK-001');
      expect(result).toBeUndefined();
    });

    it('should return value from listTasks', async () => {
      const mockTasks = [{ id: 1 }, { id: 2 }];
      api.tasks.listTasks = vi.fn().mockResolvedValue(mockTasks);
      
      const result = await api.listTasks({});
      expect(result).toBe(mockTasks);
    });

    it('should return value from addNote', async () => {
      api.notes.addNote = vi.fn().mockResolvedValue(undefined);
      
      const result = await api.addNote('TASK-001', 'Note');
      expect(result).toBeUndefined();
    });

    it('should return value from getTaskNotes', async () => {
      const mockNotes = ['Note 1', 'Note 2'];
      api.notes.getTaskNotes = vi.fn().mockResolvedValue(mockNotes);
      
      const result = await api.getTaskNotes('TASK-001');
      expect(result).toBe(mockNotes);
    });

    it('should return value from search', async () => {
      const mockResults = [{ id: 1 }];
      api.query.search = vi.fn().mockResolvedValue(mockResults);
      
      const result = await api.search('test');
      expect(result).toBe(mockResults);
    });

    it('should return value from getTasksByStatus', async () => {
      const mockTasks = [{ id: 1, status: 'active' }];
      api.query.getTasksByStatus = vi.fn().mockResolvedValue(mockTasks);
      
      const result = await api.getTasksByStatus('active');
      expect(result).toBe(mockTasks);
    });

    it('should return value from getTasksByDate', async () => {
      const mockTasks = [{ id: 1 }];
      api.query.getTasksByDate = vi.fn().mockResolvedValue(mockTasks);
      
      const result = await api.getTasksByDate({ after: '2024-01-01' });
      expect(result).toBe(mockTasks);
    });

    it('should return value from exportTasks', async () => {
      const mockExport = { tasks: [] };
      api.importExport.exportTasks = vi.fn().mockResolvedValue(mockExport);
      
      const result = await api.exportTasks({});
      expect(result).toBe(mockExport);
    });

    it('should return value from importTasks', async () => {
      const mockResult = { imported: 5 };
      api.importExport.importTasks = vi.fn().mockResolvedValue(mockResult);
      
      const result = await api.importTasks({ tasks: [] });
      expect(result).toBe(mockResult);
    });
  });

  describe('Error Propagation', () => {
    let api;

    beforeEach(() => {
      api = new TaskwerkAPI();
    });

    it('should propagate errors from service methods', async () => {
      const error = new Error('Service error');
      api.tasks.createTask = vi.fn().mockRejectedValue(error);
      
      await expect(api.createTask({ name: 'Test' })).rejects.toThrow('Service error');
    });
  });

  describe('Service Initialization', () => {
    it('should initialize all services with null database', () => {
      const api = new TaskwerkAPI();
      
      expect(api.tasks).toBeDefined();
      expect(api.tasks.db).toBe(null);
      expect(api.notes).toBeDefined();
      expect(api.notes.db).toBe(null);
      expect(api.query).toBeDefined();
      expect(api.query.db).toBe(null);
      expect(api.importExport).toBeDefined();
      expect(api.importExport.db).toBe(null);
    });

    it('should initialize all services with provided database', () => {
      const mockDb = { prepare: vi.fn() };
      const api = new TaskwerkAPI({ database: mockDb });
      
      expect(api.tasks.db).toBe(mockDb);
      expect(api.notes.db).toBe(mockDb);
      expect(api.query.db).toBe(mockDb);
      expect(api.importExport.db).toBe(mockDb);
    });
  });
});