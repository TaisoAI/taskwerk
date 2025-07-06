/**
 * Note Service
 * 
 * @description Handles note management with dual approach (field + table)
 * @module taskwerk/core/services/note-service
 */

export class NoteService {
  constructor(database) {
    this.db = database;
  }

  // TODO: Implement in TASK-006
  async appendNote(taskId, note) {
    throw new Error('Not implemented');
  }

  async addTaskNote(taskId, note) {
    throw new Error('Not implemented');
  }
}