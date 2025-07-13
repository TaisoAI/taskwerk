import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { taskAddCommand } from '../../../src/commands/task/add.js';
import { setupCommandTest, expectNotImplemented } from '../../helpers/command-test-helper.js';
import { createTestTask } from '../../helpers/database-test-helper.js';

describe('task add command', () => {
  let testSetup;

  beforeEach(() => {
    testSetup = setupCommandTest(true); // Enable database
  });

  afterEach(() => {
    testSetup.cleanup();
  });

  it('should create command with correct name and description', () => {
    const command = taskAddCommand();
    expect(command.name()).toBe('add');
    expect(command.description()).toBe('Add a new task');
  });

  it('should have required name argument', () => {
    const command = taskAddCommand();
    const nameArg = command._args[0];
    expect(nameArg.name()).toBe('name');
    expect(nameArg.description).toBe('Task name');
    expect(nameArg.required).toBe(true);
  });

  it('should have all expected options', () => {
    const command = taskAddCommand();
    const optionNames = command.options.map(opt => opt.long);

    expect(optionNames).toContain('--priority');
    expect(optionNames).toContain('--assignee');
    expect(optionNames).toContain('--estimate');
    expect(optionNames).toContain('--parent');
    expect(optionNames).toContain('--tags');
    expect(optionNames).toContain('--description');
  });

  it('should set default priority to medium', () => {
    const command = taskAddCommand();
    const priorityOption = command.options.find(opt => opt.long === '--priority');
    expect(priorityOption.defaultValue).toBe('medium');
  });

  it('should create a task when executed', async () => {
    const command = taskAddCommand();
    
    // Parse returns a promise for async commands
    await command.parseAsync(['Test task'], { from: 'user' });
    
    // Check for success message
    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('✅ Created task')
    );
  });

  it('should handle all options', async () => {
    // Create parent task first
    const parent = createTestTask(testSetup.dbSetup.db, { id: 'TASK-123', name: 'Parent task' });
    
    const command = taskAddCommand();
    
    // Note: parent '123' is invalid, should be 'TASK-123'
    // This test should fail with validation error
    await command.parseAsync(
      [
        'Test task',
        '--priority',
        'high',
        '--assignee',
        'john',
        '--estimate',
        '4',
        '--parent',
        'TASK-123',
        '--tags',
        'urgent',
        'backend',
        '--description',
        'Test description',
      ],
      { from: 'user' }
    );

    // Should create task with valid parent ID
    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('✅ Created task')
    );
  });
});
