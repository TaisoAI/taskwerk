import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { taskUpdateCommand } from '../../../src/commands/task/update.js';
import { setupCommandTest, expectNotImplemented } from '../../helpers/command-test-helper.js';

describe('task update command', () => {
  let testSetup;

  beforeEach(() => {
    testSetup = setupCommandTest();
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

  it('should output not implemented message when executed', () => {
    const command = taskUpdateCommand();
    command.parse(['123'], { from: 'user' });

    expectNotImplemented(
      testSetup.consoleLogSpy,
      testSetup.processExitSpy,
      'task update',
      'Update task 123'
    );
  });
});