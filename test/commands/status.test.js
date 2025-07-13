import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { statusCommand } from '../../src/commands/status.js';
import { setupCommandTest, expectNotImplemented } from '../helpers/command-test-helper.js';

describe('status command', () => {
  let testSetup;

  beforeEach(() => {
    testSetup = setupCommandTest(true); // Enable database
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

  it('should show taskwerk status when executed', async () => {
    const command = statusCommand();
    await command.parseAsync(['status'], { from: 'user' });

    // Check for status output
    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('📊 Taskwerk Status')
    );
  });
});
