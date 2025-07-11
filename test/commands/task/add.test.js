import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { taskAddCommand } from '../../../src/commands/task/add.js';

describe('task add command', () => {
  let consoleLogSpy;
  let processExitSpy;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
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

    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Not implemented: task add - Add new task "Test task"'
    );
    expect(processExitSpy).toHaveBeenCalledWith(0);
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

    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Not implemented: task add - Add new task "Test task"'
    );
  });
});
