import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { taskShowCommand } from '../../../src/commands/task/show.js';
import { setupCommandTest } from '../../helpers/command-test-helper.js';
import { createTestTask } from '../../helpers/database-test-helper.js';

describe('task show command', () => {
  let testSetup;

  beforeEach(() => {
    testSetup = setupCommandTest(true); // Enable database
  });

  afterEach(() => {
    testSetup.cleanup();
  });

  it('should create command with correct name and description', () => {
    const command = taskShowCommand();
    expect(command.name()).toBe('show');
    expect(command.description()).toBe('Show task details');
  });

  it('should handle showing task with valid task ID', () => {
    // Create a test task first
    createTestTask(testSetup.dbSetup.db, { id: 'TASK-123', name: 'Test task to show' });
    
    const command = taskShowCommand();
    command.parse(['TASK-123'], { from: 'user' });

    // Should show the task details
    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('📋 Task TASK-123')
    );
  });

  it('should display task notes when present', async () => {
    // Create a test task and add notes using the database directly
    createTestTask(testSetup.dbSetup.db, { 
      id: 'TASK-456', 
      name: 'Task with notes' 
    });
    
    // Add notes directly to the database
    testSetup.dbSetup.db.prepare(`
      INSERT INTO task_notes (task_id, note, user) 
      VALUES (?, ?, ?)
    `).run('TASK-456', 'First note on the task', 'user1');
    
    testSetup.dbSetup.db.prepare(`
      INSERT INTO task_notes (task_id, note, content, user) 
      VALUES (?, ?, ?, ?)
    `).run('TASK-456', 'Second note with details', 'Additional content\nwith multiple lines', 'user2');
    
    const command = taskShowCommand();
    command.parse(['TASK-456'], { from: 'user' });

    // Should show the notes section
    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('💬 Notes:')
    );
    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('@user1: First note on the task')
    );
    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('@user2: Second note with details')
    );
  });
});
