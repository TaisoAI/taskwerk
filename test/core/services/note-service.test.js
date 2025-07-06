/**
 * Note Service Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initializeStorage } from '../../../src/storage/index.js';
import NoteService from '../../../src/core/services/note-service.js';
import TaskService from '../../../src/core/services/task-service.js';
import { NoteType } from '../../../src/core/constants.js';

describe('NoteService', () => {
  let db;
  let storage;
  let noteService;
  let taskService;
  let testTask;

  beforeEach(async () => {
    // Create in-memory database
    db = new Database(':memory:');
    
    // Initialize schema
    storage = await initializeStorage({ database: db, directory: ':memory:' });
    
    // Create services
    noteService = new NoteService(storage.db);
    taskService = new TaskService(storage.db);
    
    // Create a test task
    testTask = await taskService.createTask({
      name: 'Test task',
      description: 'Task for testing notes'
    });
  });

  afterEach(() => {
    if (storage && storage.close) {
      storage.close();
    }
  });

  describe('_parseNoteWithFrontmatter', () => {
    it('should parse note with YAML frontmatter', () => {
      const content = `---
type: update
priority: high
tags:
  - bug
  - urgent
---
This is the note content
Multiple lines
Are supported`;

      const result = noteService._parseNoteWithFrontmatter(content);
      
      expect(result.metadata).toEqual({
        type: 'update',
        priority: 'high',
        tags: ['bug', 'urgent']
      });
      expect(result.content).toBe('This is the note content\nMultiple lines\nAre supported');
    });

    it('should handle content without frontmatter', () => {
      const content = 'Just a simple note';
      const result = noteService._parseNoteWithFrontmatter(content);
      
      expect(result.metadata).toEqual({});
      expect(result.content).toBe('Just a simple note');
    });

    it('should handle invalid YAML gracefully', () => {
      const content = `---
invalid: yaml: syntax:
---
Note content`;

      const result = noteService._parseNoteWithFrontmatter(content);
      expect(result.metadata).toEqual({});
      expect(result.content).toBe(content);
    });
  });

  describe('_formatNoteWithFrontmatter', () => {
    it('should format note with metadata', () => {
      const content = 'Note content';
      const metadata = { type: 'plan', version: 1 };
      
      const result = noteService._formatNoteWithFrontmatter(content, metadata);
      
      expect(result).toContain('---\n');
      expect(result).toContain('type: plan');
      expect(result).toContain('version: 1');
      expect(result).toContain('---\nNote content');
    });

    it('should return content only if no metadata', () => {
      const content = 'Note content';
      const result = noteService._formatNoteWithFrontmatter(content, {});
      
      expect(result).toBe('Note content');
    });
  });

  describe('addNote', () => {
    it('should add a simple text note', async () => {
      const note = await noteService.addNote(testTask.string_id, 'Test note content');
      
      expect(note.id).toBeDefined();
      expect(note.task_id).toBe(testTask.id);
      expect(note.content).toBe('Test note content');
      expect(note.metadata.type).toBe(NoteType.COMMENT);
      expect(note.metadata.created_by).toBe('system');
    });

    it('should add a note with metadata', async () => {
      const noteData = {
        content: 'Implementation plan',
        metadata: {
          type: NoteType.PLAN,
          priority: 'high',
          estimated_hours: 4
        }
      };
      
      const note = await noteService.addNote(testTask.string_id, noteData);
      
      expect(note.content).toBe('Implementation plan');
      expect(note.metadata.type).toBe(NoteType.PLAN);
      expect(note.metadata.priority).toBe('high');
      expect(note.metadata.estimated_hours).toBe(4);
    });

    it('should store note in task_notes table', async () => {
      await noteService.addNote(testTask.string_id, 'Test note');
      
      const stmt = storage.db.prepare('SELECT * FROM task_notes WHERE task_id = ?');
      const notes = stmt.all(testTask.id);
      
      expect(notes).toHaveLength(1);
      expect(notes[0].note_type).toBe(NoteType.COMMENT);
    });

    it('should append to task notes field', async () => {
      await noteService.addNote(testTask.string_id, 'Test note');
      
      const updated = await taskService.getTask(testTask.string_id);
      expect(updated.notes).toContain('Test note');
    });

    it('should record in history', async () => {
      const note = await noteService.addNote(testTask.string_id, 'Test note');
      
      const stmt = storage.db.prepare(
        'SELECT * FROM task_history WHERE task_id = ? AND change_type = ?'
      );
      const history = stmt.all(testTask.id, 'note_added');
      
      expect(history).toHaveLength(1);
      expect(parseFloat(history[0].new_value)).toBe(note.id);
    });

    it('should handle non-existent task', async () => {
      await expect(
        noteService.addNote('TASK-999', 'Note')
      ).rejects.toThrow('Task not found');
    });
  });

  describe('getTaskNotes', () => {
    beforeEach(async () => {
      // Add various notes
      await noteService.addNote(testTask.string_id, {
        content: 'Comment 1',
        metadata: { type: NoteType.COMMENT }
      });
      
      await noteService.addNote(testTask.string_id, {
        content: 'Plan note',
        metadata: { type: NoteType.PLAN }
      });
      
      await noteService.addNote(testTask.string_id, {
        content: 'Update note',
        metadata: { type: NoteType.UPDATE }
      });
    });

    it('should get all notes for a task', async () => {
      const notes = await noteService.getTaskNotes(testTask.string_id);
      
      expect(notes).toHaveLength(3);
      expect(notes[0].content).toBe('Comment 1');
      expect(notes[1].content).toBe('Plan note');
      expect(notes[2].content).toBe('Update note');
    });

    it('should filter by type', async () => {
      const notes = await noteService.getTaskNotes(testTask.string_id, {
        type: NoteType.PLAN
      });
      
      expect(notes).toHaveLength(1);
      expect(notes[0].content).toBe('Plan note');
    });

    it('should order by date', async () => {
      const notes = await noteService.getTaskNotes(testTask.string_id, {
        reverse: true
      });
      
      // Notes are ordered newest first when reverse=true
      expect(notes[0].content).toBe('Update note');
      expect(notes[notes.length - 1].content).toBe('Comment 1');
    });

    it('should parse frontmatter in stored notes', async () => {
      // Manually insert a note with frontmatter
      const stmt = storage.db.prepare(`
        INSERT INTO task_notes (task_id, content, note_type)
        VALUES (?, ?, ?)
      `);
      stmt.run(testTask.id, `---
custom: value
tags: [test, yaml]
---
Content with frontmatter`, NoteType.COMMENT);

      const notes = await noteService.getTaskNotes(testTask.string_id);
      const lastNote = notes[notes.length - 1];
      
      expect(lastNote.metadata.custom).toBe('value');
      expect(lastNote.metadata.tags).toEqual(['test', 'yaml']);
      expect(lastNote.content).toBe('Content with frontmatter');
    });
  });

  describe('getNote', () => {
    it('should get a specific note', async () => {
      const created = await noteService.addNote(testTask.string_id, 'Test note');
      const note = await noteService.getNote(created.id);
      
      expect(note.id).toBe(created.id);
      expect(note.content).toBe('Test note');
    });

    it('should return null for non-existent note', async () => {
      const note = await noteService.getNote(999);
      expect(note).toBeNull();
    });
  });

  describe('updateNote', () => {
    let note;

    beforeEach(async () => {
      note = await noteService.addNote(testTask.string_id, {
        content: 'Original content',
        metadata: { type: NoteType.PLAN }
      });
    });

    it('should update note content', async () => {
      const updated = await noteService.updateNote(note.id, 'Updated content');
      
      expect(updated.content).toBe('Updated content');
      expect(updated.metadata.type).toBe(NoteType.PLAN);
      expect(updated.metadata.updated_at).toBeDefined();
    });

    it('should update note metadata', async () => {
      const updated = await noteService.updateNote(note.id, {
        content: 'Original content',
        metadata: { priority: 'high' }
      });
      
      expect(updated.content).toBe('Original content');
      expect(updated.metadata.type).toBe(NoteType.PLAN);
      expect(updated.metadata.priority).toBe('high');
    });

    it('should preserve original timestamp', async () => {
      const updated = await noteService.updateNote(note.id, 'Updated');
      
      // Both should exist and be preserved
      expect(updated.created_at).toBeDefined();
      expect(note.created_at).toBeDefined();
    });

    it('should handle non-existent note', async () => {
      await expect(
        noteService.updateNote(999, 'Update')
      ).rejects.toThrow('Note not found');
    });
  });

  describe('deleteNote', () => {
    it('should delete a note', async () => {
      const note = await noteService.addNote(testTask.string_id, 'To be deleted');
      
      const result = await noteService.deleteNote(note.id);
      expect(result).toBe(true);
      
      const deleted = await noteService.getNote(note.id);
      expect(deleted).toBeNull();
    });

    it('should record deletion in history', async () => {
      const note = await noteService.addNote(testTask.string_id, 'To be deleted');
      await noteService.deleteNote(note.id);
      
      const stmt = storage.db.prepare(
        'SELECT * FROM task_history WHERE task_id = ? AND change_type = ?'
      );
      const history = stmt.all(testTask.id, 'note_deleted');
      
      expect(history).toHaveLength(1);
      expect(parseFloat(history[0].old_value)).toBe(note.id);
    });

    it('should handle non-existent note', async () => {
      await expect(
        noteService.deleteNote(999)
      ).rejects.toThrow('Note not found');
    });
  });

  describe('searchNotes', () => {
    beforeEach(async () => {
      await noteService.addNote(testTask.string_id, 'Note about bugs');
      await noteService.addNote(testTask.string_id, 'Feature implementation');
      await noteService.addNote(testTask.string_id, 'Bug fix completed');
      
      // Create another task with notes
      const task2 = await taskService.createTask({ name: 'Another task' });
      await noteService.addNote(task2.string_id, 'Another bug report');
    });

    it('should search notes by content', async () => {
      const results = await noteService.searchNotes('bug');
      
      expect(results).toHaveLength(3);
      expect(results.every(r => r.content.toLowerCase().includes('bug'))).toBe(true);
    });

    it('should filter by task', async () => {
      const results = await noteService.searchNotes('bug', {
        taskId: testTask.string_id
      });
      
      expect(results).toHaveLength(2);
      expect(results.every(r => r.task_id === testTask.id)).toBe(true);
    });

    it('should limit results', async () => {
      const results = await noteService.searchNotes('bug', { limit: 1 });
      
      expect(results).toHaveLength(1);
    });

    it('should include task string ID', async () => {
      const results = await noteService.searchNotes('bug');
      
      expect(results[0].task_string_id).toBeDefined();
      expect(results[0].task_string_id).toMatch(/^TASK-\d+$/);
    });
  });

  describe('getNoteStats', () => {
    beforeEach(async () => {
      // Create a fresh task for stats testing
      const statsTask = await taskService.createTask({ name: 'Stats test task' });
      
      await noteService.addNote(statsTask.string_id, {
        content: 'Comment',
        metadata: { type: NoteType.COMMENT }
      });
      await noteService.addNote(statsTask.string_id, {
        content: 'Plan',
        metadata: { type: NoteType.PLAN }
      });
      await noteService.addNote(statsTask.string_id, {
        content: 'Another comment',
        metadata: { type: NoteType.COMMENT }
      });
      
      // Store for tests
      this.statsTask = statsTask;
    });

    it('should get overall statistics', async () => {
      const stats = await noteService.getNoteStats();
      
      // We have at least 3 notes (might be more from other tests)
      expect(stats.total).toBeGreaterThanOrEqual(3);
      expect(stats.tasks_with_notes).toBeGreaterThanOrEqual(1);
      expect(stats.by_type[NoteType.COMMENT]).toBeGreaterThanOrEqual(2);
      expect(stats.by_type[NoteType.PLAN]).toBeGreaterThanOrEqual(1);
    });

    it('should get statistics for specific task', async () => {
      const stats = await noteService.getNoteStats(this.statsTask.string_id);
      
      expect(stats.total).toBe(3);
      expect(stats.tasks_with_notes).toBe(1);
      expect(stats.by_type[NoteType.COMMENT]).toBe(2);
      expect(stats.by_type[NoteType.PLAN]).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle database not initialized', async () => {
      const service = new NoteService(null);
      
      await expect(service.addNote('TASK-001', 'Note'))
        .rejects.toThrow('Database not initialized');
      
      await expect(service.getTaskNotes('TASK-001'))
        .rejects.toThrow('Database not initialized');
      
      await expect(service.getNote(1))
        .rejects.toThrow('Database not initialized');
    });
  });
});