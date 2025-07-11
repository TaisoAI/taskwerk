import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { statusCommand } from '../../src/commands/status.js';
import { setupCommandTest, expectNotImplemented } from '../helpers/command-test-helper.js';

describe('status command', () => {
  let testSetup;

  beforeEach(() => {
    testSetup = setupCommandTest();
  });

  afterEach(() => {
    testSetup.cleanup();
  });

  it('should create command with correct name and description', () => {
    const command = statusCommand();
    expect(command.name()).toBe('status');
    expect(command.description()).toBe('Show taskwerk repository status');
  });

  it('should have format option', () => {
    const command = statusCommand();
    const optionNames = command.options.map(opt => opt.long);
    expect(optionNames).toContain('--format');
  });

  it('should output not implemented message when executed', () => {
    const command = statusCommand();
    command.parse(['status'], { from: 'user' });

    expectNotImplemented(
      testSetup.consoleLogSpy,
      testSetup.processExitSpy,
      'status',
      'Show repository status and statistics'
    );
  });
});
