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

  /**
   * Add a note to a task (simple implementation for now)
   * @param {string} taskId - Task ID
   * @param {string} note - Note content
   */
  async addNote(taskId, note) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Get the task
    const taskStmt = this.db.prepare(`
      SELECT id, notes FROM tasks 
      WHERE string_id = @taskId OR id = @taskId
    `);
    const task = taskStmt.get({ taskId });
    
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // For now, just append to the notes field with a timestamp
    const timestamp = new Date().toISOString();
    const noteEntry = `\n---\n${timestamp}\n${note}`;
    
    const currentNotes = task.notes || '';
    const updatedNotes = currentNotes + noteEntry;
    
    // Update the task notes
    const updateStmt = this.db.prepare(`
      UPDATE tasks SET notes = @notes WHERE id = @id
    `);
    updateStmt.run({ notes: updatedNotes, id: task.id });
  }

  async getTaskNotes(taskId) {
    throw new Error('Not implemented');
  }

  async deleteNote(noteId) {
    throw new Error('Not implemented');
  }
}