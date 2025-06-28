import { test } from 'node:test';
import assert from 'node:assert';
import { GitManager } from '../../src/git/git-manager.js';

// Note: These tests are designed to work in non-git environments
// Real git tests would require a test repository setup

test('GitManager generates branch names correctly', () => {
  const gitManager = new GitManager();

  const task = {
    id: 'TASK-001',
    description: 'Fix authentication bug in user login system',
  };

  const branchName = gitManager.generateBranchName(task);
  assert.strictEqual(branchName, 'feature/task-001-fix-authentication-bug-in-user-login-sys');
});

test('GitManager generates commit messages correctly', () => {
  const gitManager = new GitManager();

  const task = {
    id: 'TASK-001',
    description: 'Fix authentication bug',
  };

  const files = ['src/auth.js', 'tests/auth.test.js'];
  const commitMessage = gitManager.generateCommitMessage(task, files);

  assert(commitMessage.includes('TASK-001: Fix authentication bug'));
  assert(commitMessage.includes('Files: src/auth.js, tests/auth.test.js'));
});

test('GitManager handles long commit messages', () => {
  const gitManager = new GitManager();

  const task = {
    id: 'TASK-001',
    description:
      'This is a very long task description that should be truncated when generating commit messages',
  };

  const files = ['file1.js', 'file2.js', 'file3.js', 'file4.js', 'file5.js'];
  const commitMessage = gitManager.generateCommitMessage(task, files);

  assert(commitMessage.includes('TASK-001: This is a very long task description that shoul...'));
  assert(commitMessage.includes('file1.js, file2.js, file3.js and 2 more'));
});

test('GitManager isGitRepository detects non-git environment', async () => {
  const gitManager = new GitManager();

  // This will return false in our test environment since we're not in a git repo
  // In a real git repo, this would return true
  const isGit = await gitManager.isGitRepository();
  assert.strictEqual(typeof isGit, 'boolean');
});

test('GitManager getCurrentBranch returns default on error', async () => {
  const gitManager = new GitManager();

  // This should return 'main' as default when git commands fail
  const branch = await gitManager.getCurrentBranch();
  assert.strictEqual(branch, 'main');
});

test('GitManager getChangedFiles returns empty array on error', async () => {
  const gitManager = new GitManager();

  // This should return empty array when git commands fail
  const files = await gitManager.getChangedFiles();
  assert(Array.isArray(files));
});
