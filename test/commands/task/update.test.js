import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { taskUpdateCommand } from '../../../src/commands/task/update.js';
import { setupCommandTest, expectNotImplemented } from '../../helpers/command-test-helper.js';
import { createTestTask } from '../../helpers/database-test-helper.js';

describe('task update command', () => {
  let testSetup;

  beforeEach(() => {
    testSetup = setupCommandTest(true); // Enable database
  });

  afterEach(() => {
    testSetup.cleanup();
  });

  it('should create command with correct name and description', () => {
    const command = taskUpdateCommand();
    expect(command.name()).toBe('update');
    expect(command.description()).toBe('Update a task');
  });

  it('should have all expected options', () => {
    const command = taskUpdateCommand();
    const optionNames = command.options.map(opt => opt.long);

    expect(optionNames).toContain('--name');
    expect(optionNames).toContain('--priority');
    expect(optionNames).toContain('--assignee');
    expect(optionNames).toContain('--estimate');
    expect(optionNames).toContain('--add-tags');
    expect(optionNames).toContain('--remove-tags');
    expect(optionNames).toContain('--note');
  });

  it('should handle updating task with valid task ID', async () => {
    // Create a test task first
    const task = createTestTask(testSetup.dbSetup.db, { id: 'TASK-123', name: 'Test task to update' });
    
    const command = taskUpdateCommand();
    await command.parseAsync(['TASK-123', '--status', 'in-progress'], { from: 'user' });

    // Should successfully update the task
    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('✅ Updated task TASK-123')
    );
  });
});
