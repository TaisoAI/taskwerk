import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeTaskCommand } from '../../src/cli/commands/task/index.js';
import { makeInitCommand } from '../../src/cli/commands/system/init.js';
import { makeAboutCommand } from '../../src/cli/commands/system/about.js';
import { initializeStorage } from '../../src/storage/index.js';
import { TaskwerkAPI } from '../../src/core/api.js';
import { rmSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('CLI Coverage Tests', () => {
  let testDir;
  let storage;
  let originalCwd;
  
  beforeEach(async () => {
    originalCwd = process.cwd();
    testDir = join(tmpdir(), `taskwerk-test-${Date.now()}`);
    
    // Create directory and change to it
    mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);
    
    // Initialize storage
    storage = await initializeStorage(testDir);
  });
  
  afterEach(() => {
    if (storage?.db) {
      storage.close();
    }
    process.chdir(originalCwd);
    rmSync(testDir, { recursive: true, force: true });
  });
  
  it('should execute init command', async () => {
    const command = makeInitCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test']);
    
    expect(consoleLog).toHaveBeenCalled();
    consoleLog.mockRestore();
  });
  
  it('should execute about command', async () => {
    const command = makeAboutCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test']);
    
    expect(consoleLog).toHaveBeenCalled();
    consoleLog.mockRestore();
  });
  
  it('should add task', async () => {
    const command = makeTaskCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', 'add', 'Test task']);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('✓'));
    consoleLog.mockRestore();
  });
  
  it('should list tasks', async () => {
    const api = new TaskwerkAPI({ database: storage.db });
    await api.createTask({ name: 'Test task', status: 'todo' });
    
    const command = makeTaskCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', 'list']);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Test task'));
    consoleLog.mockRestore();
  });
  
  it('should show task', async () => {
    const api = new TaskwerkAPI({ database: storage.db });
    await api.createTask({ name: 'Show me', status: 'todo' });
    
    const command = makeTaskCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', 'show', 'TASK-001']);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Show me'));
    consoleLog.mockRestore();
  });
  
  it('should update task', async () => {
    const api = new TaskwerkAPI({ database: storage.db });
    await api.createTask({ name: 'Update me', status: 'todo' });
    
    const command = makeTaskCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', 'update', 'TASK-001', '--name', 'Updated']);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('✓'));
    consoleLog.mockRestore();
  });
  
  it('should change task status', async () => {
    const api = new TaskwerkAPI({ database: storage.db });
    await api.createTask({ name: 'Change status', status: 'todo' });
    
    const command = makeTaskCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', 'status', 'TASK-001', 'active']);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('✓'));
    consoleLog.mockRestore();
  });
  
  it('should delete task', async () => {
    const api = new TaskwerkAPI({ database: storage.db });
    await api.createTask({ name: 'Delete me', status: 'todo' });
    
    const command = makeTaskCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', 'delete', 'TASK-001']);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('✓'));
    consoleLog.mockRestore();
  });
  
  it('should add note', async () => {
    const api = new TaskwerkAPI({ database: storage.db });
    await api.createTask({ name: 'Note task', status: 'todo' });
    
    const command = makeTaskCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', 'note', 'add', 'TASK-001', 'Test note']);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('✓'));
    consoleLog.mockRestore();
  });
  
  it('should list notes', async () => {
    const api = new TaskwerkAPI({ database: storage.db });
    await api.createTask({ name: 'Note task', status: 'todo' });
    await api.addNote('TASK-001', 'Test note');
    
    const command = makeTaskCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', 'note', 'list', 'TASK-001']);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Test note'));
    consoleLog.mockRestore();
  });
});