import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initCommand } from '../../src/commands/init.js';
import { setupCommandTest } from '../helpers/command-test-helper.js';

describe('init command', () => {
  let testSetup;

  beforeEach(() => {
    testSetup = setupCommandTest();
  });

  afterEach(() => {
    testSetup.cleanup();
  });

  it('should create command with correct name and description', () => {
    const command = initCommand();
    expect(command.name()).toBe('init');
    expect(command.description()).toBe('Initialize taskwerk in the current directory');
  });

  it('should have expected options', () => {
    const command = initCommand();
    const optionNames = command.options.map(opt => opt.long);

    expect(optionNames).toContain('--force');
  });

  it('should initialize taskwerk when executed', () => {
    const command = initCommand();
    command.parse(['init'], { from: 'user' });

    // Check for initialization message
    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('🚀 Initializing taskwerk')
    );
  });
});
