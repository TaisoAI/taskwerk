/**
 * Taskwerk Core API
 * 
 * @description Main API class that all interfaces use
 * @module taskwerk/core/api
 */

import TaskService from './services/task-service.js';
import NoteService from './services/note-service.js';
import QueryService from './services/query-service.js';
import ImportExportService from './services/import-export-service.js';

/**
 * Main API class for Taskwerk
 * All CLI commands and future interfaces go through this API
 */
export class TaskwerkAPI {
  /**
   * @param {Object} options - API options
   * @param {string} options.projectRoot - Project root directory
   */
  constructor(options = {}) {
    this.options = {
      projectRoot: process.cwd(),
      ...options
    };
    
    // Services will be initialized in TASK-002 when we add database
    this.tasks = new TaskService();
    this.notes = new NoteService();
    this.query = new QueryService();
    this.importExport = new ImportExportService();
  }

  // Task CRUD
  async createTask(data) {
    return this.tasks.createTask(data);
  }

  async getTask(id) {
    return this.tasks.getTask(id);
  }

  async updateTask(id, updates) {
    return this.tasks.updateTask(id, updates);
  }

  async deleteTask(id, force = false) {
    return this.tasks.deleteTask(id);
  }

  async listTasks(filters) {
    return this.tasks.listTasks(filters);
  }

  // Notes
  async addNote(taskId, note) {
    return this.notes.addNote(taskId, note);
  }

  async getTaskNotes(taskId) {
    return this.notes.getTaskNotes(taskId);
  }

  // Queries
  async search(query) {
    return this.query.search(query);
  }

  async getTasksByStatus(status) {
    return this.query.getTasksByStatus(status);
  }

  async getTasksByDate(dateFilter) {
    return this.query.getTasksByDate(dateFilter);
  }

  // Import/Export
  async exportTasks(options) {
    return this.importExport.exportTasks(options);
  }

  async importTasks(data) {
    return this.importExport.importTasks(data);
  }
}