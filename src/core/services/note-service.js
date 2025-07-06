/**
 * Note Service
 * 
 * @description Handles note management with YAML frontmatter support
 * @module taskwerk/core/services/note-service
 */

import yaml from 'yaml';
import { NoteType } from '../constants.js';

export default class NoteService {
  constructor(database) {
    this.db = database;
  }

  /**
   * Parse a note with YAML frontmatter
   * @private
   * @param {string} content - Raw note content
   * @returns {Object} Parsed note with metadata and content
   */
  _parseNoteWithFrontmatter(content) {
    if (!content || !content.trim()) {
      return { metadata: {}, content: '' };
    }

    // Check if content starts with YAML frontmatter
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (match) {
      try {
        const metadata = yaml.parse(match[1]) || {};
        const noteContent = match[2].trim();
        return { metadata, content: noteContent };
      } catch (err) {
        // If YAML parsing fails, treat entire content as note
        return { metadata: {}, content };
      }
    }

    // No frontmatter found
    return { metadata: {}, content };
  }

  /**
   * Format note with YAML frontmatter
   * @private
   * @param {string} content - Note content
   * @param {Object} metadata - Note metadata
   * @returns {string} Formatted note with frontmatter
   */
  _formatNoteWithFrontmatter(content, metadata = {}) {
    if (Object.keys(metadata).length === 0) {
      return content;
    }

    const frontmatter = yaml.stringify(metadata).trim();
    return `---\n${frontmatter}\n---\n${content}`;
  }

  /**
   * Add a note to a task
   * @param {string} taskId - Task ID (string or numeric)
   * @param {string|Object} noteData - Note content or object with content and metadata
   * @param {Object} options - Additional options
   * @returns {Object} Created note
   */
  async addNote(taskId, noteData, options = {}) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Get the task
    const taskStmt = this.db.prepare(`
      SELECT id FROM tasks 
      WHERE string_id = @taskId OR id = @taskId
    `);
    const task = taskStmt.get({ taskId });
    
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Prepare note data
    let content, metadata;
    if (typeof noteData === 'string') {
      content = noteData;
      metadata = {};
    } else {
      content = noteData.content || '';
      metadata = noteData.metadata || {};
    }

    // Add default metadata
    metadata.created_at = metadata.created_at || new Date().toISOString();
    metadata.created_by = metadata.created_by || options.created_by || 'system';
    metadata.type = metadata.type || options.type || NoteType.COMMENT;

    // Format note with frontmatter
    const formattedNote = this._formatNoteWithFrontmatter(content, metadata);

    // Insert into task_notes table
    const insertStmt = this.db.prepare(`
      INSERT INTO task_notes (task_id, content, created_by, note_type)
      VALUES (@task_id, @content, @created_by, @note_type)
    `);
    
    const info = insertStmt.run({
      task_id: task.id,
      content: formattedNote,
      created_by: metadata.created_by,
      note_type: metadata.type
    });

    // Also append to tasks.notes field for backward compatibility
    const noteEntry = `\n---\n${metadata.created_at}\n${content}`;
    const updateStmt = this.db.prepare(`
      UPDATE tasks 
      SET notes = notes || @note_entry
      WHERE id = @id
    `);
    updateStmt.run({ note_entry: noteEntry, id: task.id });

    // Record in history
    const historyStmt = this.db.prepare(`
      INSERT INTO task_history (task_id, field_name, old_value, new_value, change_type)
      VALUES (@task_id, 'note', NULL, @note_id, 'note_added')
    `);
    historyStmt.run({ task_id: task.id, note_id: info.lastInsertRowid });

    return {
      id: info.lastInsertRowid,
      task_id: task.id,
      content,
      metadata,
      created_at: metadata.created_at
    };
  }

  /**
   * Get all notes for a task
   * @param {string} taskId - Task ID
   * @param {Object} options - Filter options
   * @returns {Array} Array of notes
   */
  async getTaskNotes(taskId, options = {}) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Get the task
    const taskStmt = this.db.prepare(`
      SELECT id FROM tasks 
      WHERE string_id = @taskId OR id = @taskId
    `);
    const task = taskStmt.get({ taskId });
    
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Build query
    let query = `
      SELECT id, content, created_at, created_by, note_type
      FROM task_notes
      WHERE task_id = @task_id
    `;
    
    const params = { task_id: task.id };

    // Add type filter if specified
    if (options.type) {
      query += ` AND note_type = @type`;
      params.type = options.type;
    }

    // Add date range filters
    if (options.since) {
      query += ` AND created_at >= @since`;
      params.since = options.since;
    }
    if (options.until) {
      query += ` AND created_at <= @until`;
      params.until = options.until;
    }

    // Add ordering
    query += ` ORDER BY created_at ${options.reverse ? 'DESC' : 'ASC'}`;

    // Get notes
    const stmt = this.db.prepare(query);
    const notes = stmt.all(params);

    // Parse notes with frontmatter
    return notes.map(note => {
      const parsed = this._parseNoteWithFrontmatter(note.content);
      return {
        id: note.id,
        task_id: note.task_id,
        content: parsed.content,
        metadata: parsed.metadata,
        created_at: note.created_at,
        created_by: note.created_by,
        type: note.note_type
      };
    });
  }

  /**
   * Get a specific note by ID
   * @param {number} noteId - Note ID
   * @returns {Object|null} Note object or null
   */
  async getNote(noteId) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const stmt = this.db.prepare(`
      SELECT id, task_id, content, created_at, created_by, note_type
      FROM task_notes
      WHERE id = @id
    `);
    
    const note = stmt.get({ id: noteId });
    if (!note) return null;

    const parsed = this._parseNoteWithFrontmatter(note.content);
    return {
      id: note.id,
      task_id: note.task_id,
      content: parsed.content,
      metadata: parsed.metadata,
      created_at: note.created_at,
      created_by: note.created_by,
      type: note.note_type
    };
  }

  /**
   * Update a note (preserves original timestamp)
   * @param {number} noteId - Note ID
   * @param {string|Object} noteData - Updated content or object
   * @returns {Object} Updated note
   */
  async updateNote(noteId, noteData) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const existing = await this.getNote(noteId);
    if (!existing) {
      throw new Error(`Note not found: ${noteId}`);
    }

    // Prepare updated data
    let content, metadata;
    if (typeof noteData === 'string') {
      content = noteData;
      metadata = existing.metadata;
    } else {
      content = noteData.content !== undefined ? noteData.content : existing.content;
      metadata = { ...existing.metadata, ...noteData.metadata };
    }

    // Add update timestamp
    metadata.updated_at = new Date().toISOString();

    // Format with frontmatter
    const formattedNote = this._formatNoteWithFrontmatter(content, metadata);

    // Update note
    const stmt = this.db.prepare(`
      UPDATE task_notes
      SET content = @content
      WHERE id = @id
    `);
    
    stmt.run({ content: formattedNote, id: noteId });

    return {
      id: noteId,
      task_id: existing.task_id,
      content,
      metadata,
      created_at: existing.created_at
    };
  }

  /**
   * Delete a note
   * @param {number} noteId - Note ID
   * @returns {boolean} Success
   */
  async deleteNote(noteId) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const note = await this.getNote(noteId);
    if (!note) {
      throw new Error(`Note not found: ${noteId}`);
    }

    const stmt = this.db.prepare('DELETE FROM task_notes WHERE id = @id');
    stmt.run({ id: noteId });

    // Record deletion in history
    const historyStmt = this.db.prepare(`
      INSERT INTO task_history (task_id, field_name, old_value, new_value, change_type)
      VALUES (@task_id, 'note', @note_id, NULL, 'note_deleted')
    `);
    historyStmt.run({ task_id: note.task_id, note_id: noteId });

    return true;
  }

  /**
   * Search notes by content
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Array} Matching notes
   */
  async searchNotes(query, options = {}) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    let sql = `
      SELECT n.*, t.string_id as task_string_id
      FROM task_notes n
      JOIN tasks t ON n.task_id = t.id
      WHERE n.content LIKE @query
    `;
    
    const params = { query: `%${query}%` };

    // Add task filter if specified
    if (options.taskId) {
      sql += ` AND (t.string_id = @taskId OR t.id = @taskId)`;
      params.taskId = options.taskId;
    }

    sql += ` ORDER BY n.created_at DESC`;

    if (options.limit) {
      sql += ` LIMIT @limit`;
      params.limit = options.limit;
    }

    const stmt = this.db.prepare(sql);
    const results = stmt.all(params);

    return results.map(row => {
      const parsed = this._parseNoteWithFrontmatter(row.content);
      return {
        id: row.id,
        task_id: row.task_id,
        task_string_id: row.task_string_id,
        content: parsed.content,
        metadata: parsed.metadata,
        created_at: row.created_at,
        created_by: row.created_by,
        type: row.note_type
      };
    });
  }

  /**
   * Get notes statistics
   * @param {string} taskId - Optional task ID filter
   * @returns {Object} Statistics
   */
  async getNoteStats(taskId = null) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    let query = `
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT task_id) as tasks_with_notes,
        note_type,
        COUNT(*) as count_by_type
      FROM task_notes
    `;
    
    const params = {};
    
    if (taskId) {
      query = `
        SELECT 
          COUNT(*) as total,
          1 as tasks_with_notes,
          note_type,
          COUNT(*) as count_by_type
        FROM task_notes n
        JOIN tasks t ON n.task_id = t.id
        WHERE t.string_id = @taskId OR t.id = @taskId
      `;
      params.taskId = taskId;
    }
    
    query += ` GROUP BY note_type`;

    const stmt = this.db.prepare(query);
    const results = stmt.all(params);

    // Aggregate results
    const stats = {
      total: 0,
      tasks_with_notes: 0,
      by_type: {}
    };

    for (const row of results) {
      stats.total = row.total;
      stats.tasks_with_notes = row.tasks_with_notes;
      stats.by_type[row.note_type] = row.count_by_type;
    }

    return stats;
  }
}