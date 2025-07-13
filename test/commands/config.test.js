import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { configCommand } from '../../src/commands/config.js';
import { setupCommandTest } from '../helpers/command-test-helper.js';

describe('config command', () => {
  let testSetup;

  beforeEach(() => {
    testSetup = setupCommandTest();
  });

  afterEach(() => {
    testSetup.cleanup();
  });

  it('should create command with correct name and description', () => {
    const command = configCommand();
    expect(command.name()).toBe('config');
    expect(command.description()).toBe('Manage taskwerk configuration');
  });

  it('should handle list option', () => {
    const command = configCommand();
    command.parse(['--list'], { from: 'user' });

    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('⚙️  Taskwerk Configuration')
    );
  });

  it('should handle get config', () => {
    const command = configCommand();
    command.parse(['general.defaultPriority'], { from: 'user' });

    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('general.defaultPriority:')
    );
  });

  it('should handle set config', () => {
    const command = configCommand();
    command.parse(['general.defaultPriority', 'high'], { from: 'user' });

    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('✅ Set general.defaultPriority')
    );
  });

  it('should handle unset config', () => {
    const command = configCommand();
    command.parse(['general.defaultPriority', '--unset'], { from: 'user' });

    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('✅ Unset general.defaultPriority')
    );
  });
});
