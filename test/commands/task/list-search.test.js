import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { taskListCommand } from '../../../src/commands/task/list.js';
import { setupCommandTest } from '../../helpers/command-test-helper.js';

describe('task list command - search functionality', () => {
  let testSetup;

  beforeEach(async () => {
    testSetup = setupCommandTest(true); // Enable database

    // Create test tasks with searchable content
    const { TaskwerkAPI } = await import('../../../src/api/taskwerk-api.js');
    const api = new TaskwerkAPI();

    // Task 1: Search in name
    await api.createTask({
      id: 'TASK-100',
      name: 'Backend API development',
      created_by: 'test',
    });

    // Task 2: Search in description
    await api.createTask({
      id: 'TASK-101',
      name: 'Frontend work',
      description: 'Implement search functionality in the UI',
      created_by: 'test',
    });

    // Task 3: Search in content
    await api.createTask({
      id: 'TASK-102',
      name: 'Documentation',
      content: 'Update docs to explain the new search feature',
      created_by: 'test',
    });

    // Task 4: No search match
    await api.createTask({
      id: 'TASK-103',
      name: 'Database migration',
      description: 'Migrate user data',
      created_by: 'test',
    });
  });

  afterEach(() => {
    testSetup.cleanup();
  });

  it('should search tasks by name', () => {
    const command = taskListCommand();
    command.parse(['--search', 'backend'], { from: 'user' });

    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('🔍 Search results for "backend"')
    );
    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('TASK-100'));
    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Backend API development')
    );
  });

  it('should search tasks by description', () => {
    const command = taskListCommand();
    command.parse(['--search', 'search functionality'], { from: 'user' });

    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('🔍 Search results for "search functionality"')
    );
    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('TASK-101'));
  });

  it('should search tasks by content', () => {
    const command = taskListCommand();
    command.parse(['--search', 'search feature'], { from: 'user' });

    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('TASK-102'));
  });

  it('should combine search with other filters', () => {
    const command = taskListCommand();
    command.parse(['--search', 'search', '--status', 'todo'], { from: 'user' });

    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('🔍 Search results for "search" (status: todo)')
    );
  });

  it('should show no results message when no matches found', () => {
    const command = taskListCommand();
    command.parse(['--search', 'nonexistent'], { from: 'user' });

    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('📝 No tasks found')
    );
  });

  it('should support case-insensitive search', () => {
    const command = taskListCommand();
    command.parse(['--search', 'BACKEND'], { from: 'user' });

    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('TASK-100'));
  });
});
