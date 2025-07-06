import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeStatusCommand } from '../../../../src/cli/commands/system/status.js';
import { initializeStorage } from '../../../../src/storage/index.js';
import { TaskwerkAPI } from '../../../../src/core/api.js';
import { rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('system status command', () => {
  let testDir;
  let storage;
  let api;
  
  beforeEach(async () => {
    testDir = join(tmpdir(), `taskwerk-test-${Date.now()}`);
    process.chdir(testDir);
    storage = await initializeStorage(testDir);
    api = new TaskwerkAPI({ database: storage.db });
    
    // Create various tasks for statistics
    await api.createTask({ name: 'Todo 1', status: 'todo' });
    await api.createTask({ name: 'Todo 2', status: 'todo', priority: 'high' });
    await api.createTask({ name: 'Active 1', status: 'active' });
    await api.createTask({ name: 'Active 2', status: 'active', assignee: 'alice' });
    await api.createTask({ name: 'Blocked', status: 'blocked', blocked_reason: 'Waiting' });
    await api.createTask({ name: 'Completed', status: 'completed' });
    await api.createTask({ name: 'Archived', status: 'archived' });
    
    // Add some notes
    await api.addNote('TASK-001', 'Note 1');
    await api.addNote('TASK-003', 'Note 2');
  });
  
  afterEach(() => {
    if (storage?.db) {
      storage.close();
    }
    rmSync(testDir, { recursive: true, force: true });
  });
  
  it('should show project status overview', async () => {
    const command = makeStatusCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test']);
    
    // Check header
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Taskwerk Project Status'));
    
    // Check task statistics
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Total Tasks: 7'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Todo: 2'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Active: 2'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Blocked: 1'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Completed: 1'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Archived: 1'));
    
    // Check priority breakdown
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Priority Breakdown'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('High: 1'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Medium: 5'));
    
    consoleLog.mockRestore();
  });
  
  it('should show active assignees', async () => {
    // Add more tasks with assignees
    await api.createTask({ name: 'Bob task 1', assignee: 'bob', status: 'active' });
    await api.createTask({ name: 'Bob task 2', assignee: 'bob', status: 'todo' });
    await api.createTask({ name: 'Alice task 2', assignee: 'alice', status: 'todo' });
    
    const command = makeStatusCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test']);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Active Assignees'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('alice: 2 tasks'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('bob: 2 tasks'));
    
    consoleLog.mockRestore();
  });
  
  it('should show recent activity', async () => {
    const command = makeStatusCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test']);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Recent Activity'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Created today: 7'));
    
    consoleLog.mockRestore();
  });
  
  it('should show JSON output', async () => {
    const command = makeStatusCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', '--json']);
    
    const jsonOutput = consoleLog.mock.calls[0][0];
    const stats = JSON.parse(jsonOutput);
    
    expect(stats.tasks.total).toBe(7);
    expect(stats.tasks.by_status.todo).toBe(2);
    expect(stats.tasks.by_status.active).toBe(2);
    expect(stats.tasks.by_status.blocked).toBe(1);
    expect(stats.tasks.by_status.completed).toBe(1);
    expect(stats.tasks.by_status.archived).toBe(1);
    expect(stats.tasks.by_priority.high).toBe(1);
    expect(stats.tasks.by_priority.medium).toBe(5);
    expect(stats.notes.total).toBe(2);
    
    consoleLog.mockRestore();
  });
  
  it('should handle empty project', async () => {
    // Delete all tasks
    const tasks = await api.listTasks({ includeArchived: true });
    for (const task of tasks) {
      await api.deleteTask(task.id, true);
    }
    
    const command = makeStatusCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test']);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Total Tasks: 0'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('No active tasks'));
    
    consoleLog.mockRestore();
  });
});