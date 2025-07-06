import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeDeleteCommand } from '../../../../src/cli/commands/task/delete.js';
import { initializeStorage } from '../../../../src/storage/index.js';
import { TaskwerkAPI } from '../../../../src/core/api.js';
import { rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('task delete command', () => {
  let testDir;
  let storage;
  let api;
  
  beforeEach(async () => {
    testDir = join(tmpdir(), `taskwerk-test-${Date.now()}`);
    process.chdir(testDir);
    storage = await initializeStorage(testDir);
    api = new TaskwerkAPI({ database: storage.db });
    
    // Create test tasks
    await api.createTask({ name: 'Task to delete', status: 'todo' });
    await api.createTask({ name: 'Task with children', status: 'active' });
    await api.createTask({ name: 'Child task', parent_id: 2 });
  });
  
  afterEach(() => {
    if (storage?.db) {
      storage.close();
    }
    rmSync(testDir, { recursive: true, force: true });
  });
  
  it('should archive task by default', async () => {
    const command = makeDeleteCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', 'TASK-001']);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('✓'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Archived TASK-001'));
    
    // Verify task is archived, not deleted
    const task = await api.getTask('TASK-001');
    expect(task.status).toBe('archived');
    
    consoleLog.mockRestore();
  });
  
  it('should permanently delete with --force', async () => {
    const command = makeDeleteCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', 'TASK-001', '--force']);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('✓'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Permanently deleted TASK-001'));
    
    // Verify task is actually deleted
    const task = await api.getTask('TASK-001');
    expect(task).toBeNull();
    
    consoleLog.mockRestore();
  });
  
  it('should handle task with children', async () => {
    const command = makeDeleteCommand();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    // Try to delete parent without force
    await command.parseAsync(['node', 'test', 'TASK-002']);
    
    // Should still work (archive doesn't have dependency restrictions)
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Archived TASK-002'));
    
    consoleError.mockRestore();
    consoleLog.mockRestore();
  });
  
  it('should force delete task with children', async () => {
    const command = makeDeleteCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', 'TASK-002', '--force']);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Permanently deleted TASK-002'));
    
    // Verify task is deleted
    const task = await api.getTask('TASK-002');
    expect(task).toBeNull();
    
    consoleLog.mockRestore();
  });
  
  it('should delete multiple tasks', async () => {
    const command = makeDeleteCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', 'TASK-001', 'TASK-003']);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Archived TASK-001'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Archived TASK-003'));
    
    consoleLog.mockRestore();
  });
  
  it('should handle non-existent task', async () => {
    const command = makeDeleteCommand();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', 'TASK-999']);
    
    expect(consoleError).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Task not found: TASK-999')
    );
    
    consoleError.mockRestore();
  });
  
  it('should only allow archiving completed tasks', async () => {
    // Complete a task first
    await api.changeTaskStatus('TASK-001', 'completed');
    
    const command = makeDeleteCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', 'TASK-001']);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Archived TASK-001'));
    
    consoleLog.mockRestore();
  });
});