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

    it('should delegate deleteTask to TaskService', async () => {
      api.tasks.deleteTask = vi.fn();
      
      await api.deleteTask('TASK-001', true);
      expect(api.tasks.deleteTask).toHaveBeenCalledWith('TASK-001');
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
});