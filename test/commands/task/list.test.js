import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { taskListCommand } from '../../../src/commands/task/list.js';
import { setupCommandTest } from '../../helpers/command-test-helper.js';

describe('task list command', () => {
  let testSetup;

  beforeEach(() => {
    testSetup = setupCommandTest();
  });

  afterEach(() => {
    testSetup.cleanup();
  });

  it('should create command with correct name and description', () => {
    const command = taskListCommand();
    expect(command.name()).toBe('list');
    expect(command.description()).toBe('List tasks');
  });

  it('should have all expected options', () => {
    const command = taskListCommand();
    const optionNames = command.options.map(opt => opt.long);

    expect(optionNames).toContain('--status');
    expect(optionNames).toContain('--assignee');
    expect(optionNames).toContain('--priority');
    expect(optionNames).toContain('--tags');
    expect(optionNames).toContain('--search');
    expect(optionNames).toContain('--sort');
    expect(optionNames).toContain('--format');
    expect(optionNames).toContain('--limit');
    expect(optionNames).toContain('--all');
  });

  it('should list tasks when executed', async () => {
    const command = taskListCommand();
    await command.parseAsync(['list'], { from: 'user' });

    // Check for task list header
    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('📋 Tasks'));
  });
});
