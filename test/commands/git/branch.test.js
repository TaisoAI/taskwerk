import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { gitBranchCommand } from '../../../src/commands/git/branch.js';
import { setupCommandTest, expectNotImplemented } from '../../helpers/command-test-helper.js';

describe('git branch command', () => {
  let testSetup;

  beforeEach(() => {
    testSetup = setupCommandTest();
  });

  afterEach(() => {
    testSetup.cleanup();
  });

  it('should create command with correct name and description', () => {
    const command = gitBranchCommand();
    expect(command.name()).toBe('branch');
    expect(command.description()).toBe('Create a git branch for a task');
  });

  it('should have required task-id argument', () => {
    const command = gitBranchCommand();
    const arg = command._args[0];
    expect(arg.name()).toBe('task-id');
    expect(arg.required).toBe(true);
  });

  it('should output not implemented message when executed', () => {
    const command = gitBranchCommand();
    command.parse(['123'], { from: 'user' });

    expectNotImplemented(
      testSetup.consoleLogSpy,
      testSetup.processExitSpy,
      'git branch',
      'Create branch for task 123'
    );
  });
});
