import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { gitCommitCommand } from '../../../src/commands/git/commit.js';
import { setupCommandTest, expectNotImplemented } from '../../helpers/command-test-helper.js';

describe('git commit command', () => {
  let testSetup;

  beforeEach(() => {
    testSetup = setupCommandTest();
  });

  afterEach(() => {
    testSetup.cleanup();
  });

  it('should create command with correct name and description', () => {
    const command = gitCommitCommand();
    expect(command.name()).toBe('commit');
    expect(command.description()).toBe('Create a git commit linked to a task');
  });

  it('should have all expected options', () => {
    const command = gitCommitCommand();
    const optionNames = command.options.map(opt => opt.long);

    expect(optionNames).toContain('--message');
    expect(optionNames).toContain('--all');
    expect(optionNames).toContain('--amend');
    expect(optionNames).toContain('--co-author');
  });

  it('should output not implemented message when executed', () => {
    const command = gitCommitCommand();
    command.parse(['123'], { from: 'user' });

    expectNotImplemented(
      testSetup.consoleLogSpy,
      testSetup.processExitSpy,
      'git commit',
      'Create commit for task 123'
    );
  });
});
