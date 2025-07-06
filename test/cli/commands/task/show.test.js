import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeShowCommand } from '../../../../src/cli/commands/task/show.js';
import { initializeStorage } from '../../../../src/storage/index.js';
import { TaskwerkAPI } from '../../../../src/core/api.js';
import { rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('task show command', () => {
  let testDir;
  let storage;
  let api;
  let testTask;
  
  beforeEach(async () => {
    testDir = join(tmpdir(), `taskwerk-test-${Date.now()}`);
    process.chdir(testDir);
    storage = await initializeStorage(testDir);
    api = new TaskwerkAPI({ database: storage.db });
    
    // Create a test task with full details
    testTask = await api.createTask({
      name: 'Test task',
      description: 'This is a test task',
      status: 'active',
      priority: 'high',
      assignee: 'john',
      estimate: '4h',
      tags: ['backend', 'urgent']
    });
    
    // Add some notes
    await api.addNote(testTask.id, 'First note');
    await api.addNote(testTask.id, {
      content: 'Update note',
      metadata: { type: 'update' }
    });
  });
  
  afterEach(() => {
    if (storage?.db) {
      storage.close();
    }
    rmSync(testDir, { recursive: true, force: true });
  });
  
  it('should show task details', async () => {
    const command = makeShowCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', 'TASK-001']);
    
    // Check task details are shown
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Test task'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Status:'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('active'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Priority:'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('high'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Assignee:'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('john'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Tags:'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('backend, urgent'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('This is a test task'));
    
    consoleLog.mockRestore();
  });
  
  it('should show notes when requested', async () => {
    const command = makeShowCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', 'TASK-001', '--notes']);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Notes (2)'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('First note'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Update note'));
    
    consoleLog.mockRestore();
  });
  
  it('should show history when requested', async () => {
    // Update the task to create history
    await api.updateTask(testTask.id, { priority: 'medium' });
    
    const command = makeShowCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', 'TASK-001', '--history']);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('History'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('priority'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('high → medium'));
    
    consoleLog.mockRestore();
  });
  
  it('should support JSON format', async () => {
    const command = makeShowCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', 'TASK-001', '--format', 'json']);
    
    const jsonOutput = consoleLog.mock.calls[0][0];
    const parsed = JSON.parse(jsonOutput);
    
    expect(parsed.string_id).toBe('TASK-001');
    expect(parsed.name).toBe('Test task');
    expect(parsed.status).toBe('active');
    expect(parsed.priority).toBe('high');
    
    consoleLog.mockRestore();
  });
  
  it('should handle non-existent task', async () => {
    const command = makeShowCommand();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', 'TASK-999']);
    
    expect(consoleError).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Task not found')
    );
    
    consoleError.mockRestore();
  });
  
  it('should show child tasks', async () => {
    // Create child tasks
    await api.createTask({
      name: 'Child 1',
      parent_id: testTask.id
    });
    await api.createTask({
      name: 'Child 2',
      parent_id: testTask.id
    });
    
    const command = makeShowCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', 'TASK-001']);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Children (2)'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('TASK-002'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Child 1'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('TASK-003'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Child 2'));
    
    consoleLog.mockRestore();
  });
});