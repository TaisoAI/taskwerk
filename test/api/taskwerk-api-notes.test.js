import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase } from '../helpers/database-test-helper.js';
import { TaskwerkAPI } from '../../src/api/taskwerk-api.js';

describe('TaskwerkAPI - Notes', () => {
  let testSetup;
  let api;

  beforeEach(async () => {
    testSetup = createTestDatabase();
    api = new TaskwerkAPI(testSetup.database);
  });

  afterEach(() => {
    testSetup.cleanup();
  });

  it('should add a note to a task', async () => {
    const task = await api.createTask({ 
      name: 'Task with notes',
      created_by: 'test'
    });
    
    const result = await api.addTaskNote(task.id, 'This is a test note', 'testuser');
    
    expect(result).toBe(true);
    
    // Verify timeline event was created
    const timeline = api.getTaskTimeline(task.id);
    const noteEvent = timeline.find(e => e.action === 'note_added');
    expect(noteEvent).toBeTruthy();
    expect(noteEvent.user).toBe('testuser');
    expect(noteEvent.note).toContain('This is a test note');
  });

  it('should retrieve notes for a task', async () => {
    const task = await api.createTask({ 
      name: 'Task with notes',
      created_by: 'test'
    });
    
    await api.addTaskNote(task.id, 'First note', 'user1');
    // Add delay to ensure different timestamps (SQLite only has second precision)
    await new Promise(resolve => setTimeout(resolve, 1100));
    await api.addTaskNote(task.id, 'Second note', 'user2', 'This is a longer content\nwith multiple lines');
    
    const notes = api.getTaskNotes(task.id);
    
    expect(notes).toHaveLength(2);
    
    // Notes should be ordered by created_at DESC (newest first)
    expect(notes[0].note).toBe('Second note');
    expect(notes[0].user).toBe('user2');
    expect(notes[0].content).toBe('This is a longer content\nwith multiple lines');
    
    expect(notes[1].note).toBe('First note');
    expect(notes[1].user).toBe('user1');
    expect(notes[1].content).toBeNull();
  });

  it('should return empty array for task with no notes', () => {
    const task = api.createTask({ 
      name: 'Task without notes',
      created_by: 'test'
    });
    
    const notes = api.getTaskNotes(task.id);
    
    expect(notes).toHaveLength(0);
  });

  it('should throw error when adding note to non-existent task', async () => {
    await expect(
      api.addTaskNote('INVALID-TASK', 'Test note', 'user')
    ).rejects.toThrow();
  });

  it('should handle notes with special characters', async () => {
    const task = await api.createTask({ 
      name: 'Task with special notes',
      created_by: 'test'
    });
    
    const specialNote = 'Note with "quotes" and \'apostrophes\' and\nnewlines';
    await api.addTaskNote(task.id, specialNote, 'user');
    
    const notes = api.getTaskNotes(task.id);
    expect(notes[0].note).toBe(specialNote);
  });
});