import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { taskStatusCommand } from '../../../src/commands/task/status.js';
import { setupCommandTest, expectNotImplemented } from '../../helpers/command-test-helper.js';

describe('task status command', () => {
  let testSetup;

  beforeEach(() => {
    testSetup = setupCommandTest();
  });

  afterEach(() => {
    testSetup.cleanup();
  });

  it('should create command with correct name and description', () => {
    const command = taskStatusCommand();
    expect(command.name()).toBe('status');
    expect(command.description()).toBe('Change task status');
  });

  it('should output not implemented message when executed', () => {
    const command = taskStatusCommand();
    command.parse(['123', 'completed'], { from: 'user' });

    expectNotImplemented(
      testSetup.consoleLogSpy,
      testSetup.processExitSpy,
      'task status',
      'Change status of task 123 to completed'
    );
  });
});