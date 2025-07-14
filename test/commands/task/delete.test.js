import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { taskDeleteCommand } from '../../../src/commands/task/delete.js';
import { setupCommandTest } from '../../helpers/command-test-helper.js';
import { createTestTask } from '../../helpers/database-test-helper.js';

describe('task delete command', () => {
  let testSetup;

  beforeEach(() => {
    testSetup = setupCommandTest(true); // Enable database
  });

  afterEach(() => {
    testSetup.cleanup();
  });

  it('should create command with correct name and description', () => {
    const command = taskDeleteCommand();
    expect(command.name()).toBe('delete');
    expect(command.description()).toBe('Delete a task');
  });

  it('should handle task deletion with valid task ID', async () => {
    // Create a test task first
    createTestTask(testSetup.dbSetup.db, { id: 'TASK-123', name: 'Test task to delete' });

    const command = taskDeleteCommand();
    await command.parseAsync(['TASK-123', '--force'], { from: 'user' });

    // Should successfully delete the task
    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('✅ Deleted task TASK-123')
    );
  });
});
