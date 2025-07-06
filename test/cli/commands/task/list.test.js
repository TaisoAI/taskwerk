import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeListCommand } from '../../../../src/cli/commands/task/list.js';
import { initializeStorage } from '../../../../src/storage/index.js';
import { TaskwerkAPI } from '../../../../src/core/api.js';
import { rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('task list command', () => {
  let testDir;
  let storage;
  let api;
  
  beforeEach(async () => {
    testDir = join(tmpdir(), `taskwerk-test-${Date.now()}`);
    process.chdir(testDir);
    storage = await initializeStorage(testDir);
    api = new TaskwerkAPI({ database: storage.db });
    
    // Create some test tasks
    await api.createTask({ name: 'Active task', status: 'active', priority: 'high' });
    await api.createTask({ name: 'Todo task', status: 'todo', priority: 'medium' });
    await api.createTask({ name: 'Completed task', status: 'completed', priority: 'low' });
    await api.createTask({ name: 'Archived task', status: 'archived', priority: 'medium' });
  });
  
  afterEach(() => {
    if (storage?.db) {
      storage.close();
    }
    rmSync(testDir, { recursive: true, force: true });
  });
  
  it('should list all non-archived tasks by default', async () => {
    const command = makeListCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test']);
    
    // Should show active, todo, and completed tasks
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Active task'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Todo task'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Completed task'));
    
    // Should not show archived task
    expect(consoleLog).not.toHaveBeenCalledWith(expect.stringContaining('Archived task'));
    
    consoleLog.mockRestore();
  });
  
  it('should filter by status', async () => {
    const command = makeListCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', '--status', 'active']);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Active task'));
    expect(consoleLog).not.toHaveBeenCalledWith(expect.stringContaining('Todo task'));
    expect(consoleLog).not.toHaveBeenCalledWith(expect.stringContaining('Completed task'));
    
    consoleLog.mockRestore();
  });
  
  it('should filter by priority', async () => {
    const command = makeListCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', '--priority', 'high']);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Active task'));
    expect(consoleLog).not.toHaveBeenCalledWith(expect.stringContaining('Todo task'));
    
    consoleLog.mockRestore();
  });
  
  it('should show all tasks including archived with --all', async () => {
    const command = makeListCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', '--all']);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Active task'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Todo task'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Completed task'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Archived task'));
    
    consoleLog.mockRestore();
  });
  
  it('should support different output formats', async () => {
    const command = makeListCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    // Test JSON format
    await command.parseAsync(['node', 'test', '--format', 'json']);
    
    const jsonOutput = consoleLog.mock.calls.find(call => 
      call[0].includes('[') && call[0].includes(']')
    );
    expect(jsonOutput).toBeDefined();
    
    // Test that it's valid JSON
    const parsed = JSON.parse(jsonOutput[0]);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(3); // active, todo, completed
    
    consoleLog.mockRestore();
  });
  
  it('should handle empty task list', async () => {
    // Delete all tasks
    const tasks = await api.listTasks({ includeArchived: true });
    for (const task of tasks) {
      await api.deleteTask(task.id, true);
    }
    
    const command = makeListCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test']);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('No tasks found'));
    
    consoleLog.mockRestore();
  });
});