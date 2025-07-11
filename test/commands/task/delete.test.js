import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { taskDeleteCommand } from '../../../src/commands/task/delete.js';
import { setupCommandTest, expectNotImplemented } from '../../helpers/command-test-helper.js';

describe('task delete command', () => {
  let testSetup;

  beforeEach(() => {
    testSetup = setupCommandTest();
  });

  afterEach(() => {
    testSetup.cleanup();
  });

  it('should create command with correct name and description', () => {
    const command = taskDeleteCommand();
    expect(command.name()).toBe('delete');
    expect(command.description()).toBe('Delete a task');
  });

  it('should output not implemented message when executed', () => {
    const command = taskDeleteCommand();
    command.parse(['123'], { from: 'user' });

    expectNotImplemented(
      testSetup.consoleLogSpy,
      testSetup.processExitSpy,
      'task delete',
      'Delete task 123'
    );
  });
});
