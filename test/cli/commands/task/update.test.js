import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeUpdateCommand } from '../../../../src/cli/commands/task/update.js';
import { initializeStorage } from '../../../../src/storage/index.js';
import { TaskwerkAPI } from '../../../../src/core/api.js';
import { rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('task update command', () => {
  let testDir;
  let storage;
  let api;
  let testTask;
  
  beforeEach(async () => {
    testDir = join(tmpdir(), `taskwerk-test-${Date.now()}`);
    process.chdir(testDir);
    storage = await initializeStorage(testDir);
    api = new TaskwerkAPI({ database: storage.db });
    
    // Create a test task
    testTask = await api.createTask({
      name: 'Original task',
      description: 'Original description',
      status: 'todo',
      priority: 'medium',
      assignee: 'alice',
      tags: ['frontend']
    });
  });
  
  afterEach(() => {
    if (storage?.db) {
      storage.close();
    }
    rmSync(testDir, { recursive: true, force: true });
  });
  
  it('should update task name', async () => {
    const command = makeUpdateCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', 'TASK-001', '--name', 'Updated task']);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('✓'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Updated TASK-001'));
    
    // Verify the change
    const updated = await api.getTask('TASK-001');
    expect(updated.name).toBe('Updated task');
    
    consoleLog.mockRestore();
  });
  
  it('should update multiple fields', async () => {
    const command = makeUpdateCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync([
      'node', 'test', 'TASK-001',
      '--name', 'New name',
      '--description', 'New description',
      '--priority', 'high',
      '--assignee', 'bob',
      '--estimate', '6h'
    ]);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('✓'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Updated TASK-001'));
    
    const updated = await api.getTask('TASK-001');
    expect(updated.name).toBe('New name');
    expect(updated.description).toBe('New description');
    expect(updated.priority).toBe('high');
    expect(updated.assignee).toBe('bob');
    expect(updated.estimate).toBe('6h');
    
    consoleLog.mockRestore();
  });
  
  it('should update tags', async () => {
    const command = makeUpdateCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync([
      'node', 'test', 'TASK-001',
      '--tags', 'backend,database'
    ]);
    
    const updated = await api.getTask('TASK-001');
    expect(updated.tags).toEqual(['backend', 'database']);
    
    consoleLog.mockRestore();
  });
  
  it('should add tags with --add-tags', async () => {
    const command = makeUpdateCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync([
      'node', 'test', 'TASK-001',
      '--add-tags', 'testing,docs'
    ]);
    
    const updated = await api.getTask('TASK-001');
    expect(updated.tags).toContain('frontend'); // Original tag
    expect(updated.tags).toContain('testing');
    expect(updated.tags).toContain('docs');
    
    consoleLog.mockRestore();
  });
  
  it('should remove tags with --remove-tags', async () => {
    // Add more tags first
    await api.updateTask('TASK-001', { tags: ['frontend', 'testing', 'docs'] });
    
    const command = makeUpdateCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync([
      'node', 'test', 'TASK-001',
      '--remove-tags', 'testing,docs'
    ]);
    
    const updated = await api.getTask('TASK-001');
    expect(updated.tags).toEqual(['frontend']);
    
    consoleLog.mockRestore();
  });
  
  it('should update progress', async () => {
    const command = makeUpdateCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync([
      'node', 'test', 'TASK-001',
      '--progress', '75'
    ]);
    
    const updated = await api.getTask('TASK-001');
    expect(updated.progress).toBe(75);
    
    consoleLog.mockRestore();
  });
  
  it('should handle due date', async () => {
    const command = makeUpdateCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync([
      'node', 'test', 'TASK-001',
      '--due', '2025-12-31'
    ]);
    
    const updated = await api.getTask('TASK-001');
    expect(updated.due_date).toContain('2025-12-31');
    
    consoleLog.mockRestore();
  });
  
  it('should handle parent task update', async () => {
    // Create another task to be parent
    const parent = await api.createTask({ name: 'Parent task' });
    
    const command = makeUpdateCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync([
      'node', 'test', 'TASK-001',
      '--parent', 'TASK-002'
    ]);
    
    const updated = await api.getTask('TASK-001');
    expect(updated.parent_id).toBe(parent.id);
    
    consoleLog.mockRestore();
  });
  
  it('should handle milestone and template flags', async () => {
    const command = makeUpdateCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync([
      'node', 'test', 'TASK-001',
      '--milestone',
      '--template'
    ]);
    
    const updated = await api.getTask('TASK-001');
    expect(updated.is_milestone).toBe(true);
    expect(updated.is_template).toBe(true);
    
    consoleLog.mockRestore();
  });
  
  it('should handle non-existent task', async () => {
    const command = makeUpdateCommand();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', 'TASK-999', '--name', 'New name']);
    
    expect(consoleError).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Task not found')
    );
    
    consoleError.mockRestore();
  });
  
  it('should validate progress value', async () => {
    const command = makeUpdateCommand();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    await command.parseAsync([
      'node', 'test', 'TASK-001',
      '--progress', '150' // Invalid - over 100
    ]);
    
    expect(consoleError).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Progress must be between 0 and 100')
    );
    
    consoleError.mockRestore();
  });
});