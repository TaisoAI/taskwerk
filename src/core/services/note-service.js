/**
 * Note Service
 * 
 * @description Handles note management with dual approach (field + table)
 * @module taskwerk/core/services/note-service
 */

export default class NoteService {
  constructor(database) {
    this.db = database;
  }

  // TODO: Implement in TASK-006
  async addNote(taskId, note) {
    throw new Error('Not implemented');
  }

  async getTaskNotes(taskId) {
    throw new Error('Not implemented');
  }

  async deleteNote(noteId) {
    throw new Error('Not implemented');
  }
}