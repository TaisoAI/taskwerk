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
      'Not implemented: config - List all configuration values'
    );
  });

  it('should handle get config', () => {
    const command = configCommand();
    command.parse(['user.name'], { from: 'user' });

    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(
      'Not implemented: config - Get configuration value for user.name'
    );
  });

  it('should handle set config', () => {
    const command = configCommand();
    command.parse(['user.name', 'John Doe'], { from: 'user' });

    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(
      'Not implemented: config - Set configuration user.name=John Doe'
    );
  });

  it('should handle unset config', () => {
    const command = configCommand();
    command.parse(['user.name', '--unset'], { from: 'user' });

    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(
      'Not implemented: config - Unset configuration user.name'
    );
  });
});
