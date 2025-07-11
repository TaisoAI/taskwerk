import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exportCommand } from '../../src/commands/export.js';
import { setupCommandTest, expectNotImplemented } from '../helpers/command-test-helper.js';

describe('export command', () => {
  let testSetup;

  beforeEach(() => {
    testSetup = setupCommandTest();
  });

  afterEach(() => {
    testSetup.cleanup();
  });

  it('should create command with correct name and description', () => {
    const command = exportCommand();
    expect(command.name()).toBe('export');
    expect(command.description()).toBe('Export tasks to a file');
  });

  it('should have all expected options', () => {
    const command = exportCommand();
    const optionNames = command.options.map(opt => opt.long);

    expect(optionNames).toContain('--format');
    expect(optionNames).toContain('--output');
    expect(optionNames).toContain('--status');
    expect(optionNames).toContain('--assignee');
    expect(optionNames).toContain('--all');
  });

  it('should output not implemented message when executed', () => {
    const command = exportCommand();
    command.parse(['export', '--format', 'json'], { from: 'user' });

    expectNotImplemented(
      testSetup.consoleLogSpy,
      testSetup.processExitSpy,
      'export',
      'Export tasks to json format'
    );
  });
});
