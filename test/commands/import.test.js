import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { importCommand } from '../../src/commands/import.js';
import { setupCommandTest, expectNotImplemented } from '../helpers/command-test-helper.js';

describe('import command', () => {
  let testSetup;

  beforeEach(() => {
    testSetup = setupCommandTest();
  });

  afterEach(() => {
    testSetup.cleanup();
  });

  it('should create command with correct name and description', () => {
    const command = importCommand();
    expect(command.name()).toBe('import');
    expect(command.description()).toBe('Import tasks from a file');
  });

  it('should have required file argument', () => {
    const command = importCommand();
    const fileArg = command._args[0];
    expect(fileArg.name()).toBe('file');
    expect(fileArg.required).toBe(true);
  });

  it('should output not implemented message when executed', () => {
    const command = importCommand();
    command.parse(['tasks.json'], { from: 'user' });

    expectNotImplemented(
      testSetup.consoleLogSpy,
      testSetup.processExitSpy,
      'import',
      'Import tasks from tasks.json'
    );
  });
});
