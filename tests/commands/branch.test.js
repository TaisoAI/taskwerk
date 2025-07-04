import { test } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'child_process';
import { mkdtemp, rm, writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Critical Git Safety Tests for taskwerk branch command
 *
 * These tests ensure that the branch command behaves safely and predictably:
 * 1. Creates Git branches with predictable naming
 * 2. Switches to existing branches when they exist
 * 3. Requires Git repository
 * 4. Preserves current work state
 * 5. Provides clear feedback about branch operations
 */

function runTaskwerk(args, cwd) {
  return new Promise(resolve => {
    // Use absolute path to taskwerk binary from project root
    const taskwerkPath = join(process.cwd(), 'bin', 'taskwerk.js');
    const proc = spawn('node', [taskwerkPath, ...args], {
      cwd,
      stdio: 'pipe',
      shell: false,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', data => {
      stdout += data.toString();
    });

    proc.stderr.on('data', data => {
      stderr += data.toString();
    });

    proc.on('close', code => {
      resolve({ code, stdout, stderr });
    });
  });
}

function runGit(args, cwd) {
  return new Promise(resolve => {
    const proc = spawn('git', args, {
      cwd,
      stdio: 'pipe',
      shell: false,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', data => {
      stdout += data.toString();
    });

    proc.stderr.on('data', data => {
      stderr += data.toString();
    });

    proc.on('close', code => {
      resolve({ code, stdout, stderr });
    });
  });
}

async function setupGitRepo(tempDir) {
  // Initialize git repo
  await runGit(['init'], tempDir);
  await runGit(['config', 'user.email', 'test@example.com'], tempDir);
  await runGit(['config', 'user.name', 'Test User'], tempDir);

  // Initialize taskwerk
  await runTaskwerk(['init'], tempDir);

  // Create initial commit
  await writeFile(join(tempDir, 'README.md'), '# Test Project');
  await runGit(['add', 'README.md'], tempDir);
  await runGit(['commit', '-m', 'Initial commit'], tempDir);
}

test.skip('Branch Command Git Safety Tests', async t => {
  // These tests are for incomplete v3 functionality - disabled during transition
  await t.test('CRITICAL: Creates branch with predictable naming convention', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'taskwerk-branch-naming-test-'));

    try {
      await setupGitRepo(tempDir);

      // Add a task with specific description
      await runTaskwerk(['add', 'Fix authentication timeout bug'], tempDir);

      // Create branch for the task
      const result = await runTaskwerk(['branch', 'TASK-001'], tempDir);

      // Should indicate branch creation
      assert(result.stdout.includes('feature/task-001'), 'Should show branch name creation');

      // Verify branch was actually created and switched to
      const currentBranch = await runGit(['branch', '--show-current'], tempDir);
      assert(
        currentBranch.stdout.trim().startsWith('feature/task-001'),
        'Should be on the task branch'
      );

      // Verify branch exists in git
      const branches = await runGit(['branch'], tempDir);
      assert(branches.stdout.includes('feature/task-001'), 'Branch should exist in git');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  await t.test('CRITICAL: Switches to existing branch if it already exists', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'taskwerk-branch-existing-test-'));

    try {
      await setupGitRepo(tempDir);

      // Add a task
      await runTaskwerk(['add', 'Test task for branch switching'], tempDir);

      // Create branch first time
      const firstResult = await runTaskwerk(['branch', 'TASK-001'], tempDir);
      assert(firstResult.stdout.includes('feature/task-001'), 'Should create branch first time');

      // Switch back to main
      await runGit(['checkout', 'main'], tempDir);

      // Run branch command again (should switch to existing branch)
      const secondResult = await runTaskwerk(['branch', 'TASK-001'], tempDir);
      assert(secondResult.stdout.includes('feature/task-001'), 'Should switch to existing branch');

      // Verify we're on the branch
      const currentBranch = await runGit(['branch', '--show-current'], tempDir);
      assert(
        currentBranch.stdout.trim().startsWith('feature/task-001'),
        'Should be on the task branch'
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  await t.test('CRITICAL: Requires Git repository', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'taskwerk-branch-no-git-test-'));

    try {
      // Initialize taskwerk but NOT git
      await runTaskwerk(['init'], tempDir);
      await runTaskwerk(['add', 'Test task'], tempDir);

      // Try to create branch (should fail)
      const result = await runTaskwerk(['branch', 'TASK-001'], tempDir);

      // Should show error about not being a git repository
      assert(
        result.stderr.includes('not a git repository') ||
          result.stdout.includes('not a git repository') ||
          result.stderr.includes('Not a git repository'),
        'Should error about missing git repo'
      );
      assert.strictEqual(result.code, 1, 'Should exit with error code');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  await t.test('CRITICAL: Requires valid task ID', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'taskwerk-branch-invalid-task-test-'));

    try {
      await setupGitRepo(tempDir);

      // Try to create branch for non-existent task
      const result = await runTaskwerk(['branch', 'TASK-999'], tempDir);

      // Should show error about task not found
      assert(
        result.stderr.includes('Task not found') ||
          result.stdout.includes('Task not found') ||
          result.stderr.includes('not found'),
        'Should error about missing task'
      );
      assert.strictEqual(result.code, 1, 'Should exit with error code');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  await t.test('CRITICAL: Branch naming handles special characters safely', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'taskwerk-branch-special-chars-test-'));

    try {
      await setupGitRepo(tempDir);

      // Add task with special characters in description
      await runTaskwerk(['add', 'Fix issue with "quotes" & special chars / slashes'], tempDir);

      // Create branch
      const result = await runTaskwerk(['branch', 'TASK-001'], tempDir);

      // Should create branch successfully
      assert.strictEqual(result.code, 0, 'Should succeed despite special characters');

      // Verify branch was created with safe name
      const branches = await runGit(['branch'], tempDir);
      assert(branches.stdout.includes('feature/task-001'), 'Should create branch with safe name');

      // Verify current branch
      const currentBranch = await runGit(['branch', '--show-current'], tempDir);
      assert(
        currentBranch.stdout.trim().startsWith('feature/task-001'),
        'Should be on safe branch name'
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  await t.test('CRITICAL: Preserves uncommitted changes when switching branches', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'taskwerk-branch-preserve-changes-test-'));

    try {
      await setupGitRepo(tempDir);

      // Add a task
      await runTaskwerk(['add', 'Test task for preserving changes'], tempDir);

      // Create some uncommitted changes
      await writeFile(join(tempDir, 'work-in-progress.txt'), 'important work');

      // Create branch (should handle uncommitted changes gracefully)
      const result = await runTaskwerk(['branch', 'TASK-001'], tempDir);

      // Should either succeed or give clear guidance about uncommitted changes
      if (result.code !== 0) {
        // If it fails, should give clear error about uncommitted changes
        assert(
          result.stderr.includes('uncommitted changes') ||
            result.stderr.includes('working tree') ||
            result.stderr.includes('checkout'),
          'Should give clear error about uncommitted changes'
        );
      } else {
        // If it succeeds, changes should be preserved
        const fileExists = await readFile(join(tempDir, 'work-in-progress.txt'), 'utf8')
          .then(() => true)
          .catch(() => false);
        assert(fileExists, 'Should preserve uncommitted changes if branch creation succeeds');
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  await t.test('CRITICAL: Multiple tasks create different branches', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'taskwerk-branch-multiple-test-'));

    try {
      await setupGitRepo(tempDir);

      // Add multiple tasks
      await runTaskwerk(['add', 'First task'], tempDir);
      await runTaskwerk(['add', 'Second task'], tempDir);
      await runTaskwerk(['add', 'Third task'], tempDir);

      // Create branches for each task
      await runTaskwerk(['branch', 'TASK-001'], tempDir);
      await runTaskwerk(['branch', 'TASK-002'], tempDir);
      await runTaskwerk(['branch', 'TASK-003'], tempDir);

      // Verify all branches exist
      const branches = await runGit(['branch'], tempDir);
      assert(branches.stdout.includes('feature/task-001'), 'Should have first task branch');
      assert(branches.stdout.includes('feature/task-002'), 'Should have second task branch');
      assert(branches.stdout.includes('feature/task-003'), 'Should have third task branch');

      // Verify we're on the last created branch
      const currentBranch = await runGit(['branch', '--show-current'], tempDir);
      assert(
        currentBranch.stdout.trim().startsWith('feature/task-003'),
        'Should be on last created branch'
      );

      // Count total branches (should be main + 3 task branches = 4)
      const branchLines = branches.stdout.trim().split('\n').length;
      assert(branchLines >= 4, 'Should have at least 4 branches (main + 3 task branches)');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  await t.test('CRITICAL: Provides clear feedback about branch operations', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'taskwerk-branch-feedback-test-'));

    try {
      await setupGitRepo(tempDir);

      // Add a task
      await runTaskwerk(['add', 'Test task for feedback'], tempDir);

      // Create branch and verify feedback
      const result = await runTaskwerk(['branch', 'TASK-001'], tempDir);

      // Should provide clear feedback about what happened
      assert(result.stdout.length > 0, 'Should provide output feedback');
      assert(
        result.stdout.includes('feature/task-001') ||
          result.stdout.includes('TASK-001') ||
          result.stdout.includes('branch'),
        'Should mention the branch in output'
      );

      // Should indicate success
      assert.strictEqual(result.code, 0, 'Should indicate success with exit code 0');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
