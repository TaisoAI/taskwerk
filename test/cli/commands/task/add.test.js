import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeAddCommand } from '../../../../src/cli/commands/task/add.js';
import { initializeStorage } from '../../../../src/storage/index.js';
import { rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('task add command', () => {
  let testDir;
  let storage;
  
  beforeEach(async () => {
    testDir = join(tmpdir(), `taskwerk-test-${Date.now()}`);
    process.chdir(testDir);
    storage = await initializeStorage(testDir);
  });
  
  afterEach(() => {
    if (storage?.db) {
      storage.close();
    }
    rmSync(testDir, { recursive: true, force: true });
  });
  
  it('should create a task with minimal options', async () => {
    const command = makeAddCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', 'Test task']);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('✓'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('TASK-001'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Test task'));
    
    consoleLog.mockRestore();
  });
  
  it('should create a task with all options', async () => {
    const command = makeAddCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync([
      'node', 'test', 'Complex task',
      '-d', 'This is a description',
      '-n', 'Initial note',
      '-a', 'john',
      '-p', 'high',
      '-e', '4h',
      '--due', '2025-12-31',
      '--tags', 'backend,urgent',
      '--milestone'
    ]);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('✓'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('TASK-001'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Complex task'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Priority: high'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Tags: backend, urgent'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Milestone'));
    
    consoleLog.mockRestore();
  });
  
  it('should handle parent task option', async () => {
    const command = makeAddCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    // Create parent task first
    await command.parseAsync(['node', 'test', 'Parent task']);
    
    // Create child task
    await command.parseAsync([
      'node', 'test', 'Child task',
      '--parent', 'TASK-001'
    ]);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('TASK-002'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Parent: TASK-001'));
    
    consoleLog.mockRestore();
  });
  
  it('should handle errors gracefully', async () => {
    const command = makeAddCommand();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Try to create task with invalid priority
    await command.parseAsync([
      'node', 'test', 'Bad task',
      '-p', 'invalid'
    ]);
    
    expect(consoleError).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Invalid priority')
    );
    
    consoleError.mockRestore();
  });
});