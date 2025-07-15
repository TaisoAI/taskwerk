import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { taskStatusCommand } from '../../../src/commands/task/status.js';
import { setupCommandTest } from '../../helpers/command-test-helper.js';
import { createTestTask } from '../../helpers/database-test-helper.js';

describe('task status command', () => {
  let testSetup;

  beforeEach(() => {
    testSetup = setupCommandTest(true); // Enable database
  });

  afterEach(() => {
    testSetup.cleanup();
  });

  it('should create command with correct name and description', () => {
    const command = taskStatusCommand();
    expect(command.name()).toBe('status');
    expect(command.description()).toBe('Change task status');
  });

  it('should update task status successfully', async () => {
    // Create a test task
    createTestTask(testSetup.dbSetup.db, { id: 'TASK-123', name: 'Test task', status: 'todo' });

    const command = taskStatusCommand();
    await command.parseAsync(['TASK-123', 'in-progress'], { from: 'user' });

    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(
      '✅ Updated status of TASK-123 to in-progress'
    );
  });

  it('should reject invalid status', async () => {
    // Create a test task
    createTestTask(testSetup.dbSetup.db, { id: 'TASK-123', name: 'Test task' });

    const command = taskStatusCommand();
    await command.parseAsync(['TASK-123', 'invalid-status'], { from: 'user' });

    expect(testSetup.consoleErrorSpy).toHaveBeenCalledWith('❌ Invalid status: invalid-status');
    expect(testSetup.consoleErrorSpy).toHaveBeenCalledWith(
      'Valid statuses: todo, in-progress, blocked, done, cancelled'
    );
    expect(testSetup.processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should handle non-existent task', async () => {
    const command = taskStatusCommand();
    await command.parseAsync(['TASK-999', 'done'], { from: 'user' });

    // Check that error was logged (might have logger prefix)
    const errorCalls = testSetup.consoleErrorSpy.mock.calls;
    const hasErrorMessage = errorCalls.some(call =>
      call.some(arg => arg && arg.toString().includes('❌'))
    );
    expect(hasErrorMessage).toBe(true);
    expect(testSetup.processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should add note when provided', async () => {
    // Create a test task
    createTestTask(testSetup.dbSetup.db, { id: 'TASK-123', name: 'Test task' });

    const command = taskStatusCommand();
    await command.parseAsync(['TASK-123', 'blocked', '--note', 'Waiting for dependencies'], {
      from: 'user',
    });

    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(
      '✅ Updated status of TASK-123 to blocked'
    );
  });
});
