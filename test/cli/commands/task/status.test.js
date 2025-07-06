import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeStatusCommand } from '../../../../src/cli/commands/task/status.js';
import { initializeStorage } from '../../../../src/storage/index.js';
import { TaskwerkAPI } from '../../../../src/core/api.js';
import { rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('task status command', () => {
  let testDir;
  let storage;
  let api;
  
  beforeEach(async () => {
    testDir = join(tmpdir(), `taskwerk-test-${Date.now()}`);
    process.chdir(testDir);
    storage = await initializeStorage(testDir);
    api = new TaskwerkAPI({ database: storage.db });
    
    // Create test tasks with different statuses
    await api.createTask({ name: 'Todo task', status: 'todo' });
    await api.createTask({ name: 'Active task', status: 'active' });
    await api.createTask({ name: 'Completed task', status: 'completed' });
  });
  
  afterEach(() => {
    if (storage?.db) {
      storage.close();
    }
    rmSync(testDir, { recursive: true, force: true });
  });
  
  it('should change task status', async () => {
    const command = makeStatusCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', 'TASK-001', 'active']);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('✓'));
    expect(consoleLog).toHaveBeenCalledWith(
      expect.stringContaining('Changed TASK-001 status from todo to active')
    );
    
    // Verify the change
    const task = await api.getTask('TASK-001');
    expect(task.status).toBe('active');
    
    consoleLog.mockRestore();
  });
  
  it('should require reason when blocking', async () => {
    const command = makeStatusCommand();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Try to block without reason
    await command.parseAsync(['node', 'test', 'TASK-002', 'blocked']);
    
    expect(consoleError).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Blocked reason is required')
    );
    
    consoleError.mockRestore();
  });
  
  it('should block with reason', async () => {
    const command = makeStatusCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync([
      'node', 'test', 'TASK-002', 'blocked',
      '--reason', 'Waiting for dependencies'
    ]);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('✓'));
    expect(consoleLog).toHaveBeenCalledWith(
      expect.stringContaining('Changed TASK-002 status from active to blocked')
    );
    
    // Verify the change
    const task = await api.getTask('TASK-002');
    expect(task.status).toBe('blocked');
    expect(task.blocked_reason).toBe('Waiting for dependencies');
    
    consoleLog.mockRestore();
  });
  
  it('should handle cascade option', async () => {
    // Create parent and child tasks
    const parent = await api.createTask({ name: 'Parent', status: 'active' });
    await api.createTask({ name: 'Child', status: 'active', parent_id: parent.id });
    
    const command = makeStatusCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync([
      'node', 'test', 'TASK-004', 'blocked',
      '--reason', 'Parent blocked',
      '--cascade'
    ]);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('✓'));
    expect(consoleLog).toHaveBeenCalledWith(
      expect.stringContaining('Changed TASK-004 status from active to blocked')
    );
    
    // Verify child is also blocked
    const child = await api.getTask('TASK-005');
    expect(child.status).toBe('blocked');
    
    consoleLog.mockRestore();
  });
  
  it('should validate status transitions', async () => {
    const command = makeStatusCommand();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Try invalid transition: completed -> todo
    await command.parseAsync(['node', 'test', 'TASK-003', 'todo']);
    
    expect(consoleError).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Invalid status transition')
    );
    
    consoleError.mockRestore();
  });
  
  it('should set completed_at when completing', async () => {
    const command = makeStatusCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', 'TASK-002', 'completed']);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('✓'));
    
    // Verify completed_at is set
    const task = await api.getTask('TASK-002');
    expect(task.status).toBe('completed');
    expect(task.completed_at).toBeTruthy();
    
    consoleLog.mockRestore();
  });
  
  it('should handle non-existent task', async () => {
    const command = makeStatusCommand();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', 'TASK-999', 'active']);
    
    expect(consoleError).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Task not found')
    );
    
    consoleError.mockRestore();
  });
  
  it('should show allowed transitions when no status provided', async () => {
    const command = makeStatusCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', 'TASK-001']);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Current status: todo'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Allowed transitions:'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('active'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('blocked'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('completed'));
    
    consoleLog.mockRestore();
  });
});