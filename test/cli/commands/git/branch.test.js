import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createGitBranchCommand } from '../../../../src/cli/commands/git/branch.js';
import { initializeStorage } from '../../../../src/storage/index.js';
import { TaskwerkAPI } from '../../../../src/core/api.js';
import { execSync } from 'child_process';
import { rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('git branch command', () => {
  let testDir;
  let storage;
  let api;
  let originalCwd;
  
  beforeEach(async () => {
    originalCwd = process.cwd();
    testDir = join(tmpdir(), `taskwerk-test-${Date.now()}`);
    
    // Create test directory and initialize git
    execSync(`mkdir -p ${testDir}`, { stdio: 'pipe' });
    process.chdir(testDir);
    execSync('git init', { stdio: 'pipe' });
    execSync('git config user.email "test@example.com"', { stdio: 'pipe' });
    execSync('git config user.name "Test User"', { stdio: 'pipe' });
    
    // Create initial commit
    execSync('touch README.md', { stdio: 'pipe' });
    execSync('git add README.md', { stdio: 'pipe' });
    execSync('git commit -m "Initial commit"', { stdio: 'pipe' });
    
    storage = await initializeStorage(testDir);
    api = new TaskwerkAPI({ database: storage.db });
    
    // Create test task
    await api.createTask({
      name: 'Test task for git',
      status: 'todo'
    });
  });
  
  afterEach(() => {
    if (storage?.db) {
      storage.close();
    }
    process.chdir(originalCwd);
    rmSync(testDir, { recursive: true, force: true });
  });
  
  it('should create and checkout a new branch', async () => {
    const command = createGitBranchCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', 'TASK-001']);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('✓'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Created branch: feature/TASK-001'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Switched to branch: feature/TASK-001'));
    
    // Verify branch was created
    const currentBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    expect(currentBranch).toBe('feature/TASK-001');
    
    // Verify task was updated with branch
    const task = await api.getTask('TASK-001');
    expect(task.branch).toBe('feature/TASK-001');
    
    consoleLog.mockRestore();
  });
  
  it('should create branch without checkout', async () => {
    const command = createGitBranchCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', 'TASK-001', '--no-checkout']);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Created branch: feature/TASK-001'));
    expect(consoleLog).not.toHaveBeenCalledWith(expect.stringContaining('Switched to branch'));
    
    // Verify we're still on main/master
    const currentBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    expect(['main', 'master']).toContain(currentBranch);
    
    consoleLog.mockRestore();
  });
  
  it('should use custom prefix', async () => {
    const command = createGitBranchCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', 'TASK-001', '--prefix', 'bugfix/']);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Created branch: bugfix/TASK-001'));
    
    const currentBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    expect(currentBranch).toBe('bugfix/TASK-001');
    
    consoleLog.mockRestore();
  });
  
  it('should create branch from specific base', async () => {
    // Create another branch first
    execSync('git checkout -b other-branch', { stdio: 'pipe' });
    execSync('touch other.txt && git add other.txt && git commit -m "Other commit"', { stdio: 'pipe' });
    execSync('git checkout -', { stdio: 'pipe' }); // Back to main/master
    
    const command = createGitBranchCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', 'TASK-001', '--base', 'other-branch']);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Created branch: feature/TASK-001'));
    
    // Verify the branch includes the commit from other-branch
    const log = execSync('git log --oneline -n 2', { encoding: 'utf8' });
    expect(log).toContain('Other commit');
    
    consoleLog.mockRestore();
  });
  
  it('should switch to existing branch', async () => {
    // Create the branch first
    execSync('git checkout -b feature/TASK-001', { stdio: 'pipe' });
    execSync('git checkout -', { stdio: 'pipe' }); // Back to main/master
    
    const command = createGitBranchCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', 'TASK-001']);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Branch already exists: feature/TASK-001'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Switched to branch: feature/TASK-001'));
    
    consoleLog.mockRestore();
  });
  
  it('should handle non-existent task', async () => {
    const command = createGitBranchCommand();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', 'TASK-999']);
    
    expect(consoleError).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Task TASK-999 not found')
    );
    
    consoleError.mockRestore();
  });
  
  it('should handle non-git directory', async () => {
    // Create a non-git directory
    const nonGitDir = join(testDir, 'non-git');
    execSync(`mkdir -p ${nonGitDir}`, { stdio: 'pipe' });
    process.chdir(nonGitDir);
    
    const command = createGitBranchCommand();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', 'TASK-001']);
    
    expect(consoleError).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Not in a git repository')
    );
    
    consoleError.mockRestore();
  });
});