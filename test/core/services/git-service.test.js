import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GitService } from '../../../src/core/services/git-service.js';
import { TaskService } from '../../../src/core/services/task-service.js';
import { execSync } from 'child_process';

vi.mock('child_process');

describe('GitService', () => {
  let gitService;
  let mockTaskService;
  
  beforeEach(() => {
    gitService = new GitService({ cwd: '/test/dir' });
    mockTaskService = {
      getTask: vi.fn(),
      getTaskByStringId: vi.fn(),
      updateTask: vi.fn(),
      getStateMachine: vi.fn()
    };
    
    // Reset all mocks
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe('isGitRepository', () => {
    it('should return true when in a git repository', () => {
      vi.mocked(execSync).mockReturnValue('.git');
      
      const result = gitService.isGitRepository();
      
      expect(result).toBe(true);
      expect(execSync).toHaveBeenCalledWith('git rev-parse --git-dir', expect.any(Object));
    });
    
    it('should return false when not in a git repository', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('Not a git repository');
      });
      
      const result = gitService.isGitRepository();
      
      expect(result).toBe(false);
    });
  });
  
  describe('getCurrentBranch', () => {
    it('should return current branch name', () => {
      vi.mocked(execSync).mockReturnValue('main\n');
      
      const result = gitService.getCurrentBranch();
      
      expect(result).toBe('main');
      expect(execSync).toHaveBeenCalledWith('git branch --show-current', expect.any(Object));
    });
    
    it('should return null on error', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('Error');
      });
      
      const result = gitService.getCurrentBranch();
      
      expect(result).toBeNull();
    });
  });
  
  describe('getStatus', () => {
    it('should parse git status output', () => {
      vi.mocked(execSync).mockReturnValue('M  src/file1.js\nA  src/file2.js\n');
      
      const result = gitService.getStatus();
      
      expect(result).toEqual([
        { status: 'M', file: 'src/file1.js' },
        { status: 'A', file: 'src/file2.js' }
      ]);
    });
    
    it('should return empty array on error', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('Error');
      });
      
      const result = gitService.getStatus();
      
      expect(result).toEqual([]);
    });
  });
  
  describe('createBranch', () => {
    beforeEach(() => {
      // Mock isGitRepository to return true
      vi.mocked(execSync).mockImplementation((cmd) => {
        if (cmd === 'git rev-parse --git-dir') return '.git';
        if (cmd === 'git branch --show-current') return 'main';
        if (cmd.startsWith('git rev-parse --verify')) throw new Error('Branch not found');
        return '';
      });
    });
    
    it('should create and checkout new branch', () => {
      const result = gitService.createBranch('feature/test', { checkout: true });
      
      expect(result).toEqual({
        created: true,
        checked_out: true,
        branch: 'feature/test'
      });
      expect(execSync).toHaveBeenCalledWith('git checkout -b feature/test main', expect.any(Object));
    });
    
    it('should create branch without checkout', () => {
      const result = gitService.createBranch('feature/test', { checkout: false });
      
      expect(result).toEqual({
        created: true,
        checked_out: false,
        branch: 'feature/test'
      });
      expect(execSync).toHaveBeenCalledWith('git branch feature/test main', expect.any(Object));
    });
    
    it('should checkout existing branch if checkout is true', () => {
      vi.mocked(execSync).mockImplementation((cmd) => {
        if (cmd === 'git rev-parse --git-dir') return '.git';
        if (cmd === 'git branch --show-current') return 'main';
        if (cmd.startsWith('git rev-parse --verify')) return 'abc123'; // Branch exists
        return '';
      });
      
      const result = gitService.createBranch('feature/test', { checkout: true });
      
      expect(result).toEqual({
        created: false,
        checked_out: true,
        branch: 'feature/test'
      });
      expect(execSync).toHaveBeenCalledWith('git checkout feature/test', expect.any(Object));
    });
    
    it('should throw error if not in git repository', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('Not a git repository');
      });
      
      expect(() => gitService.createBranch('feature/test')).toThrow('Not a git repository');
    });
  });
  
  describe('createTaskBranch', () => {
    it('should create branch for task', async () => {
      const mockTask = { id: 1, string_id: 'TASK-001' };
      mockTaskService.getTask.mockResolvedValue(mockTask);
      
      vi.mocked(execSync).mockImplementation((cmd) => {
        if (cmd === 'git rev-parse --git-dir') return '.git';
        if (cmd === 'git branch --show-current') return 'main';
        if (cmd.startsWith('git rev-parse --verify')) throw new Error('Branch not found');
        return '';
      });
      
      const result = await gitService.createTaskBranch('TASK-001', mockTaskService);
      
      expect(result).toEqual({
        created: true,
        checked_out: true,
        branch: 'feature/TASK-001'
      });
      expect(mockTaskService.updateTask).toHaveBeenCalledWith(1, { branch: 'feature/TASK-001' });
    });
    
    it('should throw error if task not found', async () => {
      mockTaskService.getTask.mockResolvedValue(null);
      
      await expect(gitService.createTaskBranch('TASK-999', mockTaskService))
        .rejects.toThrow('Task TASK-999 not found');
    });
  });
  
  describe('commit', () => {
    beforeEach(() => {
      vi.mocked(execSync).mockImplementation((cmd) => {
        if (cmd === 'git rev-parse --git-dir') return '.git';
        if (cmd === 'git diff --cached --name-only') return 'file1.js\nfile2.js';
        return '';
      });
    });
    
    it('should create commit', () => {
      const result = gitService.commit('Test commit');
      
      expect(result).toEqual({ committed: true, pushed: false });
      expect(execSync).toHaveBeenCalledWith('git commit -m "Test commit"', expect.any(Object));
    });
    
    it('should add all files if requested', () => {
      const result = gitService.commit('Test commit', { addAll: true });
      
      expect(execSync).toHaveBeenCalledWith('git add -A', expect.any(Object));
      expect(result).toEqual({ committed: true, pushed: false });
    });
    
    it('should push if requested', () => {
      vi.mocked(execSync).mockImplementation((cmd) => {
        if (cmd === 'git rev-parse --git-dir') return '.git';
        if (cmd === 'git diff --cached --name-only') return 'file1.js';
        if (cmd === 'git branch --show-current') return 'main';
        return '';
      });
      
      const result = gitService.commit('Test commit', { push: true });
      
      expect(result).toEqual({ committed: true, pushed: true });
      expect(execSync).toHaveBeenCalledWith('git push origin main', expect.any(Object));
    });
    
    it('should throw error if no staged changes', () => {
      vi.mocked(execSync).mockImplementation((cmd) => {
        if (cmd === 'git rev-parse --git-dir') return '.git';
        if (cmd === 'git diff --cached --name-only') return '';
        return '';
      });
      
      expect(() => gitService.commit('Test commit')).toThrow('No staged changes to commit');
    });
  });
  
  describe('commitWithTask', () => {
    const mockTask = {
      id: 1,
      string_id: 'TASK-001',
      name: 'Test task',
      description: 'Test description'
    };
    
    beforeEach(() => {
      mockTaskService.getTask.mockResolvedValue(mockTask);
      
      vi.mocked(execSync).mockImplementation((cmd) => {
        if (cmd === 'git rev-parse --git-dir') return '.git';
        if (cmd === 'git diff --cached --name-only') return 'src/file1.js\nsrc/file2.js';
        return '';
      });
    });
    
    it('should generate commit message with task context', async () => {
      const result = await gitService.commitWithTask('TASK-001', mockTaskService);
      
      expect(result).toMatchObject({
        committed: true,
        pushed: false,
        message: expect.stringContaining('TASK-001')
      });
      expect(result.message).toContain('Task: Test task');
      expect(result.message).toContain('Test description');
    });
    
    it('should use custom message if provided', async () => {
      const result = await gitService.commitWithTask('TASK-001', mockTaskService, {
        message: 'Custom message'
      });
      
      expect(result.message).toBe('TASK-001: Custom message');
    });
    
    it('should close task if requested', async () => {
      const mockStateMachine = {
        transitionTask: vi.fn()
      };
      mockTaskService.getStateMachine.mockResolvedValue(mockStateMachine);
      
      await gitService.commitWithTask('TASK-001', mockTaskService, { close: true });
      
      expect(mockStateMachine.transitionTask).toHaveBeenCalledWith(1, 'completed');
    });
    
    it('should throw error if no staged changes', async () => {
      vi.mocked(execSync).mockImplementation((cmd) => {
        if (cmd === 'git rev-parse --git-dir') return '.git';
        if (cmd === 'git diff --cached --name-only') return '';
        return '';
      });
      
      await expect(gitService.commitWithTask('TASK-001', mockTaskService))
        .rejects.toThrow('No staged changes to commit');
    });
  });
  
  describe('getBranchesForTasks', () => {
    it('should extract task IDs from branch names', () => {
      vi.mocked(execSync).mockReturnValue(
        '  main\n' +
        '* feature/TASK-001\n' +
        '  feature/TASK-002\n' +
        '  bugfix/TASK-001-fix\n' +
        '  remotes/origin/feature/TASK-003\n'
      );
      
      const result = gitService.getBranchesForTasks();
      
      expect(result).toEqual({
        'TASK-001': ['feature/TASK-001', 'bugfix/TASK-001-fix'],
        'TASK-002': ['feature/TASK-002'],
        'TASK-003': ['remotes/origin/feature/TASK-003']
      });
    });
    
    it('should return empty object on error', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('Error');
      });
      
      const result = gitService.getBranchesForTasks();
      
      expect(result).toEqual({});
    });
  });
  
  describe('syncTaskBranches', () => {
    beforeEach(() => {
      vi.mocked(execSync).mockImplementation((cmd) => {
        if (cmd === 'git rev-parse --git-dir') return '.git';
        if (cmd === 'git branch -a') {
          return '  main\n* feature/TASK-001\n  feature/TASK-002\n';
        }
        if (cmd === 'git branch --merged') {
          return '  main\n  feature/TASK-002\n';
        }
        return '';
      });
    });
    
    it('should update tasks with branch info', async () => {
      const mockTask1 = { id: 1, string_id: 'TASK-001' };
      const mockTask2 = { id: 2, string_id: 'TASK-002' };
      
      mockTaskService.getTaskByStringId.mockImplementation((id) => {
        if (id === 'TASK-001') return Promise.resolve(mockTask1);
        if (id === 'TASK-002') return Promise.resolve(mockTask2);
        return Promise.resolve(null);
      });
      
      const results = await gitService.syncTaskBranches(mockTaskService, { update: true });
      
      expect(results.updated).toHaveLength(2);
      expect(mockTaskService.updateTask).toHaveBeenCalledWith(1, { branch: 'feature/TASK-001' });
      expect(mockTaskService.updateTask).toHaveBeenCalledWith(2, { branch: 'feature/TASK-002' });
    });
    
    it('should prune merged branches for completed tasks', async () => {
      const mockTask = { id: 2, string_id: 'TASK-002', status: 'completed', branch: 'feature/TASK-002' };
      
      mockTaskService.getTaskByStringId.mockResolvedValue(mockTask);
      
      const results = await gitService.syncTaskBranches(mockTaskService, { prune: true, update: true });
      
      expect(results.pruned).toHaveLength(1);
      expect(results.pruned[0]).toEqual({ taskId: 'TASK-002', branch: 'feature/TASK-002' });
      expect(execSync).toHaveBeenCalledWith('git branch -d feature/TASK-002', expect.any(Object));
    });
    
    it('should handle errors gracefully', async () => {
      mockTaskService.getTaskByStringId.mockRejectedValue(new Error('Database error'));
      
      const results = await gitService.syncTaskBranches(mockTaskService, { update: true });
      
      expect(results.errors).toHaveLength(2);
      expect(results.errors[0].error).toBe('Database error');
    });
  });
});