import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeNoteCommand } from '../../../../src/cli/commands/task/note.js';
import { initializeStorage } from '../../../../src/storage/index.js';
import { TaskwerkAPI } from '../../../../src/core/api.js';
import { rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('task note command', () => {
  let testDir;
  let storage;
  let api;
  let testTask;
  
  beforeEach(async () => {
    testDir = join(tmpdir(), `taskwerk-test-${Date.now()}`);
    process.chdir(testDir);
    storage = await initializeStorage(testDir);
    api = new TaskwerkAPI({ database: storage.db });
    
    // Create a test task
    testTask = await api.createTask({ name: 'Task with notes' });
    
    // Add some existing notes
    await api.addNote(testTask.id, 'First note');
    await api.addNote(testTask.id, {
      content: 'Plan note',
      metadata: { type: 'plan' }
    });
  });
  
  afterEach(() => {
    if (storage?.db) {
      storage.close();
    }
    rmSync(testDir, { recursive: true, force: true });
  });
  
  describe('note add', () => {
    it('should add a simple note', async () => {
      const command = makeNoteCommand();
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await command.parseAsync(['node', 'test', 'add', 'TASK-001', 'New note content']);
      
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('✓'));
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Added note to TASK-001'));
      
      // Verify note was added
      const notes = await api.getTaskNotes('TASK-001');
      expect(notes).toHaveLength(3);
      expect(notes[2].content).toBe('New note content');
      
      consoleLog.mockRestore();
    });
    
    it('should add note with type', async () => {
      const command = makeNoteCommand();
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await command.parseAsync([
        'node', 'test', 'add', 'TASK-001', 'Update note',
        '--type', 'update'
      ]);
      
      const notes = await api.getTaskNotes('TASK-001');
      const lastNote = notes[notes.length - 1];
      expect(lastNote.type).toBe('update');
      
      consoleLog.mockRestore();
    });
    
    it('should add note from stdin', async () => {
      const command = makeNoteCommand();
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // Mock stdin
      const originalStdin = process.stdin;
      process.stdin = {
        isTTY: false,
        setEncoding: vi.fn(),
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            callback('Note from stdin\nMultiline content');
          } else if (event === 'end') {
            callback();
          }
        }),
        resume: vi.fn()
      };
      
      await command.parseAsync(['node', 'test', 'add', 'TASK-001', '--stdin']);
      
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Added note to TASK-001'));
      
      process.stdin = originalStdin;
      consoleLog.mockRestore();
    });
  });
  
  describe('note list', () => {
    it('should list all notes', async () => {
      const command = makeNoteCommand();
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await command.parseAsync(['node', 'test', 'list', 'TASK-001']);
      
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Notes for TASK-001'));
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('First note'));
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Plan note'));
      
      consoleLog.mockRestore();
    });
    
    it('should filter by type', async () => {
      const command = makeNoteCommand();
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await command.parseAsync(['node', 'test', 'list', 'TASK-001', '--type', 'plan']);
      
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Plan note'));
      expect(consoleLog).not.toHaveBeenCalledWith(expect.stringContaining('First note'));
      
      consoleLog.mockRestore();
    });
    
    it('should show in reverse order', async () => {
      const command = makeNoteCommand();
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await command.parseAsync(['node', 'test', 'list', 'TASK-001', '--reverse']);
      
      // Check that notes appear in reverse chronological order
      const calls = consoleLog.mock.calls.map(call => call[0]);
      const planIndex = calls.findIndex(call => call.includes('Plan note'));
      const firstIndex = calls.findIndex(call => call.includes('First note'));
      
      expect(planIndex).toBeLessThan(firstIndex);
      
      consoleLog.mockRestore();
    });
  });
  
  describe('note show', () => {
    it('should show a specific note', async () => {
      const notes = await api.getTaskNotes('TASK-001');
      const noteId = notes[0].id;
      
      const command = makeNoteCommand();
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await command.parseAsync(['node', 'test', 'show', noteId.toString()]);
      
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('First note'));
      
      consoleLog.mockRestore();
    });
    
    it('should handle non-existent note', async () => {
      const command = makeNoteCommand();
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      await command.parseAsync(['node', 'test', 'show', '999999']);
      
      expect(consoleError).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Note not found')
      );
      
      consoleError.mockRestore();
    });
  });
  
  describe('note update', () => {
    it('should update note content', async () => {
      const notes = await api.getTaskNotes('TASK-001');
      const noteId = notes[0].id;
      
      const command = makeNoteCommand();
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await command.parseAsync(['node', 'test', 'update', noteId.toString(), 'Updated content']);
      
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('✓'));
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Updated note'));
      
      // Verify update
      const updated = await api.getNote(noteId);
      expect(updated.content).toBe('Updated content');
      
      consoleLog.mockRestore();
    });
    
    it('should update note type', async () => {
      const notes = await api.getTaskNotes('TASK-001');
      const noteId = notes[0].id;
      
      const command = makeNoteCommand();
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await command.parseAsync([
        'node', 'test', 'update', noteId.toString(),
        'Updated content', '--type', 'decision'
      ]);
      
      const updated = await api.getNote(noteId);
      expect(updated.metadata.type).toBe('decision');
      
      consoleLog.mockRestore();
    });
  });
  
  describe('note delete', () => {
    it('should delete a note', async () => {
      const notes = await api.getTaskNotes('TASK-001');
      const noteId = notes[0].id;
      
      const command = makeNoteCommand();
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await command.parseAsync(['node', 'test', 'delete', noteId.toString()]);
      
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('✓'));
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Deleted note'));
      
      // Verify deletion
      const remainingNotes = await api.getTaskNotes('TASK-001');
      expect(remainingNotes).toHaveLength(1);
      
      consoleLog.mockRestore();
    });
  });
  
  describe('note search', () => {
    it('should search notes by content', async () => {
      const command = makeNoteCommand();
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await command.parseAsync(['node', 'test', 'search', 'Plan']);
      
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Found 1 note'));
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Plan note'));
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('TASK-001'));
      
      consoleLog.mockRestore();
    });
    
    it('should filter search by task', async () => {
      // Create another task with notes
      const task2 = await api.createTask({ name: 'Another task' });
      await api.addNote(task2.id, 'Another Plan note');
      
      const command = makeNoteCommand();
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await command.parseAsync(['node', 'test', 'search', 'Plan', '--task', 'TASK-001']);
      
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Found 1 note'));
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('TASK-001'));
      expect(consoleLog).not.toHaveBeenCalledWith(expect.stringContaining('TASK-002'));
      
      consoleLog.mockRestore();
    });
  });
});