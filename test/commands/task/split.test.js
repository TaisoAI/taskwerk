import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { taskSplitCommand } from '../../../src/commands/task/split.js';
import { setupCommandTest } from '../../helpers/command-test-helper.js';

describe('task split command', () => {
  let testSetup;

  beforeEach(async () => {
    testSetup = setupCommandTest(true); // Enable database
    
    // Create a parent task to split
    const { TaskwerkAPI } = await import('../../../src/api/taskwerk-api.js');
    const api = new TaskwerkAPI();
    
    await api.createTask({ 
      id: 'TASK-100', 
      name: 'Large feature implementation',
      status: 'todo',
      priority: 'high',
      estimate: 12,
      created_by: 'test'
    });
    
    // Add tags to test tag copying
    await api.addTaskTags('TASK-100', ['frontend', 'feature'], 'test');
  });

  afterEach(() => {
    testSetup.cleanup();
  });

  it('should create command with correct name and description', () => {
    const command = taskSplitCommand();
    expect(command.name()).toBe('split');
    expect(command.description()).toBe('Split a task into subtasks');
  });

  it('should have all expected options', () => {
    const command = taskSplitCommand();
    const optionNames = command.options.map(opt => opt.long);

    expect(optionNames).toContain('--names');
    expect(optionNames).toContain('--divide-estimate');
    expect(optionNames).toContain('--interactive');
  });

  it('should split task with provided names', async () => {
    const command = taskSplitCommand();
    await command.parseAsync([
      'TASK-100', 
      '--names', 'UI Design', 'API Integration', 'Testing',
      '--divide-estimate'
    ], { from: 'user' });

    // Verify output
    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('📋 Splitting task TASK-100')
    );
    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('✅ Created subtask')
    );
    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('UI Design')
    );
    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('API Integration')
    );
    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Testing')
    );
    
    // Verify summary
    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('📊 Split Summary:')
    );
    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Subtasks created: 3')
    );
    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Tags copied: feature, frontend')
    );
    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Estimate per subtask: 4 hours')
    );
  });

  it('should update parent task status to in-progress', async () => {
    const command = taskSplitCommand();
    await command.parseAsync([
      'TASK-100', 
      '--names', 'Subtask 1', 'Subtask 2'
    ], { from: 'user' });

    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('🔄 Updated parent task status to in-progress')
    );
    
    // Verify in database
    const { TaskwerkAPI } = await import('../../../src/api/taskwerk-api.js');
    const api = new TaskwerkAPI();
    const parentTask = api.getTask('TASK-100');
    expect(parentTask.status).toBe('in-progress');
  });

  it('should handle task not found error', async () => {
    const command = taskSplitCommand();
    
    // Mock process.exit to prevent test from exiting
    const originalExit = process.exit;
    process.exit = () => { throw new Error('Process exit called'); };
    
    try {
      await command.parseAsync(['INVALID-ID', '--names', 'Test'], { from: 'user' });
    } catch (error) {
      expect(error.message).toBe('Process exit called');
    }
    
    process.exit = originalExit;
    
    expect(testSetup.consoleErrorSpy).toHaveBeenCalledWith(
      '❌ Failed to split task:',
      expect.stringContaining('Task not found')
    );
  });

  it('should create subtasks with parent relationship', async () => {
    const command = taskSplitCommand();
    await command.parseAsync([
      'TASK-100', 
      '--names', 'Child 1', 'Child 2'
    ], { from: 'user' });
    
    // Verify subtasks have correct parent_id
    const { TaskwerkAPI } = await import('../../../src/api/taskwerk-api.js');
    const api = new TaskwerkAPI();
    const allTasks = api.listTasks({});
    
    const subtasks = allTasks.filter(t => t.parent_id === 'TASK-100');
    expect(subtasks).toHaveLength(2);
    expect(subtasks[0].description).toBe('Subtask of TASK-100');
    expect(subtasks[1].description).toBe('Subtask of TASK-100');
  });
});