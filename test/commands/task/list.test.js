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
    
    try {
      await command.parseAsync(['list'], { from: 'user' });
    } catch (error) {
      // Command might exit(0) which throws in test environment
      // This is OK as long as it logged the expected output
    }

    // Wait a bit for any async console operations
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check that console.log was called at least once
    expect(testSetup.consoleLogSpy).toHaveBeenCalled();
    
    // Check for either task list header or no tasks message
    const calls = testSetup.consoleLogSpy.mock.calls;
    const allOutput = calls.map(call => call.join(' ')).join('\n');
    
    const hasExpectedOutput = 
      allOutput.includes('📋 Tasks') || 
      allOutput.includes('📝 No tasks found') ||
      allOutput.includes('No tasks found');
    
    expect(hasExpectedOutput).toBe(true);
  });
});
