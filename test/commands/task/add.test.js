import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { taskAddCommand } from '../../../src/commands/task/add.js';
import { setupCommandTest, expectNotImplemented } from '../../helpers/command-test-helper.js';

describe('task add command', () => {
  let testSetup;

  beforeEach(() => {
    testSetup = setupCommandTest();
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

  it('should output not implemented message when executed', () => {
    const command = taskAddCommand();
    command.parse(['Test task'], { from: 'user' });

    expectNotImplemented(
      testSetup.consoleLogSpy,
      testSetup.processExitSpy,
      'task add',
      'Add new task "Test task"'
    );
  });

  it('should handle all options', () => {
    const command = taskAddCommand();
    command.parse(
      [
        'Test task',
        '--priority',
        'high',
        '--assignee',
        'john',
        '--estimate',
        '4',
        '--parent',
        '123',
        '--tags',
        'urgent',
        'backend',
        '--description',
        'Test description',
      ],
      { from: 'user' }
    );

    expectNotImplemented(
      testSetup.consoleLogSpy,
      testSetup.processExitSpy,
      'task add',
      'Add new task "Test task"'
    );
  });
});
