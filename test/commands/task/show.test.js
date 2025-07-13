import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { taskShowCommand } from '../../../src/commands/task/show.js';
import { setupCommandTest, expectNotImplemented } from '../../helpers/command-test-helper.js';
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
    const task = createTestTask(testSetup.dbSetup.db, { id: 'TASK-123', name: 'Test task to show' });
    
    const command = taskShowCommand();
    command.parse(['TASK-123'], { from: 'user' });

    // Should show the task details
    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('📋 Task TASK-123')
    );
  });
});
