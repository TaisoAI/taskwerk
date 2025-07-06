/**
 * Taskwerk Core API
 * 
 * @description Main API class that all interfaces use
 * @module taskwerk/core/api
 */

import { TaskService } from './services/task-service.js';
import { NoteService } from './services/note-service.js';
import { QueryService } from './services/query-service.js';
import { ImportExportService } from './services/import-export-service.js';

/**
 * Main API class for Taskwerk
 * All CLI commands and future interfaces go through this API
 */
export class TaskwerkAPI {
  /**
   * @param {Database} database - SQLite database instance
   */
  constructor(database) {
    this.db = database;
    this.tasks = new TaskService(database);
    this.notes = new NoteService(database);
    this.query = new QueryService(database);
    this.importExport = new ImportExportService(database);
  }

  // Task CRUD
  async createTask(data) {
    return this.tasks.create(data);
  }

  async getTask(id) {
    return this.tasks.get(id);
  }

  async updateTask(id, updates) {
    return this.tasks.update(id, updates);
  }

  async deleteTask(id, force = false) {
    return this.tasks.delete(id, force);
  }

  async listTasks(filters) {
    return this.query.listTasks(filters);
  }

  // Relationships
  async addDependency(taskId, dependsOnId) {
    return this.tasks.addDependency(taskId, dependsOnId);
  }

  async removeDependency(taskId, dependsOnId) {
    return this.tasks.removeDependency(taskId, dependsOnId);
  }

  async getTaskTree(id) {
    return this.query.getTaskTree(id);
  }

  // Notes
  async appendNote(taskId, note) {
    return this.notes.appendNote(taskId, note);
  }

  async addTaskNote(taskId, note) {
    return this.notes.addTaskNote(taskId, note);
  }

  // Queries
  async queryTasks(query) {
    return this.query.queryTasks(query);
  }

  async searchTasks(text) {
    return this.query.searchTasks(text);
  }

  async getStats() {
    return this.query.getStats();
  }

  // Import/Export
  async exportTasks(format, filters) {
    return this.importExport.export(format, filters);
  }

  async importTasks(data, format, options) {
    return this.importExport.import(data, format, options);
  }
}