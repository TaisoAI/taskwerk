import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { taskShowCommand } from '../../../src/commands/task/show.js';
import { setupCommandTest, expectNotImplemented } from '../../helpers/command-test-helper.js';

describe('task show command', () => {
  let testSetup;

  beforeEach(() => {
    testSetup = setupCommandTest();
  });

  afterEach(() => {
    testSetup.cleanup();
  });

  it('should create command with correct name and description', () => {
    const command = taskShowCommand();
    expect(command.name()).toBe('show');
    expect(command.description()).toBe('Show task details');
  });

  it('should output not implemented message when executed', () => {
    const command = taskShowCommand();
    command.parse(['123'], { from: 'user' });

    expectNotImplemented(
      testSetup.consoleLogSpy,
      testSetup.processExitSpy,
      'task show',
      'Show details for task 123'
    );
  });
});
