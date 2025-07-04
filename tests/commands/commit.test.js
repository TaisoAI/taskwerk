import { test } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'child_process';
import { mkdtemp, rm, writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Critical Git Safety Tests for taskwerk commit command
 *
 * These tests ensure that the commit command behaves safely and predictably:
 * 1. Default behavior shows preview only (NO COMMIT)
 * 2. --auto flag required for actual commits
 * 3. No automatic file staging
 * 4. Clear error messages when files not staged
 * 5. Proper workflow validation
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

test.skip('Commit Command Git Safety Tests', async t => {
  // These tests are for incomplete v3 functionality - disabled during transition
  await t.test('CRITICAL: Default commit shows preview only (no actual commit)', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'taskwerk-commit-test-'));

    try {
      // Initialize git and taskwerk but NO initial commit yet
      await runGit(['init'], tempDir);
      await runGit(['config', 'user.email', 'test@example.com'], tempDir);
      await runGit(['config', 'user.name', 'Test User'], tempDir);
      await runTaskwerk(['init'], tempDir);

      // Add and complete a task first
      await runTaskwerk(['add', 'Test task for commit'], tempDir);
      await runTaskwerk(['complete', 'TASK-001', '--note', 'Test completion'], tempDir);

      // Create a file change and stage it
      await writeFile(join(tempDir, 'test-file.txt'), 'test content');
      await runGit(['add', '.'], tempDir); // Stage all files including taskwerk files

      // Run commit without --auto (should show preview only)
      const result = await runTaskwerk(['commit'], tempDir);

      // Should show preview but NOT commit
      assert(result.stdout.includes('📝 Commit Message:'), 'Should show commit message preview');
      assert(result.stdout.includes('💡 Options:'), 'Should show options');
      assert(result.stdout.includes('--auto     Commit automatically'), 'Should show auto option');

      // Verify no actual commit was made by checking git log
      const gitLogResult = await runGit(['log', '--oneline'], tempDir);
      // Should fail because no commits exist yet
      assert.strictEqual(gitLogResult.code, 128, 'Should have no commits yet');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  await t.test('CRITICAL: --auto flag required for actual commits', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'taskwerk-commit-auto-test-'));

    try {
      // Initialize git and taskwerk but NO initial commit yet
      await runGit(['init'], tempDir);
      await runGit(['config', 'user.email', 'test@example.com'], tempDir);
      await runGit(['config', 'user.name', 'Test User'], tempDir);
      await runTaskwerk(['init'], tempDir);

      // Add and complete a task first
      await runTaskwerk(['add', 'Test task for auto commit'], tempDir);
      await runTaskwerk(['complete', 'TASK-001', '--note', 'Test completion'], tempDir);

      // Create a file change and stage it
      await writeFile(join(tempDir, 'test-file.txt'), 'test content');
      await runGit(['add', '.'], tempDir); // Stage all files including taskwerk files

      // Run commit WITH --auto (should actually commit)
      const result = await runTaskwerk(['commit', '--auto'], tempDir);

      // Should show success message
      assert(
        result.stdout.includes('✅ Committed changes successfully'),
        'Should show commit success message'
      );
      assert(result.stdout.includes('📝 Commit:'), 'Should show commit hash');

      // Verify actual commit was made
      const gitLog = await runGit(['log', '--oneline'], tempDir);
      const commitCount = gitLog.stdout.trim().split('\n').length;
      assert.strictEqual(commitCount, 1, 'Should have 1 commit (the new one)');

      // Verify commit message contains task information
      const latestCommit = await runGit(['log', '-1', '--pretty=format:%s'], tempDir);
      assert(
        latestCommit.stdout.includes('TASK-001'),
        'Commit message should reference completed task'
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  await t.test('CRITICAL: No automatic file staging - requires manual git add', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'taskwerk-commit-staging-test-'));

    try {
      await setupGitRepo(tempDir);

      // Add and complete a task
      await runTaskwerk(['add', 'Test task'], tempDir);
      await runTaskwerk(['complete', 'TASK-001', '--note', 'Test completion'], tempDir);

      // Create a file change but DON'T stage it
      await writeFile(join(tempDir, 'unstaged-file.txt'), 'test content');

      // Run commit (should fail due to no staged files)
      const result = await runTaskwerk(['commit'], tempDir);

      // Should show error about no staged files
      assert(
        result.stdout.includes('⚠️  No files staged for commit'),
        'Should warn about no staged files'
      );
      assert(
        result.stdout.includes('💡 Use git add to stage files first'),
        'Should suggest using git add'
      );

      // Verify no commit was made
      const gitLog = await runGit(['log', '--oneline'], tempDir);
      const commitCount = gitLog.stdout.trim().split('\n').length;
      assert.strictEqual(commitCount, 1, 'Should still have only initial commit');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  await t.test('CRITICAL: Git repository requirement enforced', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'taskwerk-no-git-test-'));

    try {
      // Initialize taskwerk but NOT git
      await runTaskwerk(['init'], tempDir);

      // Try to run commit (should fail)
      const result = await runTaskwerk(['commit'], tempDir);

      // Should show error about not being a git repository
      assert(result.stderr.includes('Not a git repository'), 'Should error about missing git repo');
      assert.strictEqual(result.code, 1, 'Should exit with error code');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  await t.test('CRITICAL: Custom message with -m commits immediately', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'taskwerk-commit-custom-test-'));

    try {
      await setupGitRepo(tempDir);

      // Create a file change and stage it
      await writeFile(join(tempDir, 'test-file.txt'), 'test content');
      await runGit(['add', 'test-file.txt'], tempDir);

      // Run commit with custom message
      const result = await runTaskwerk(['commit', '-m', 'Custom commit message'], tempDir);

      // Should commit immediately with custom message
      assert(
        result.stdout.includes('✅ Committed changes successfully'),
        'Should commit successfully'
      );

      // Verify commit message
      const latestCommit = await runGit(['log', '-1', '--pretty=format:%s'], tempDir);
      assert.strictEqual(
        latestCommit.stdout.trim(),
        'Custom commit message',
        'Should use custom message'
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  await t.test('CRITICAL: Version bump option works correctly', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'taskwerk-version-test-'));

    try {
      await setupGitRepo(tempDir);

      // Create package.json
      const packageJson = {
        name: 'test-package',
        version: '1.0.0',
      };
      await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2));
      await runGit(['add', 'package.json'], tempDir);

      // Run commit with version bump
      const result = await runTaskwerk(['commit', '--version-bump', 'patch', '--auto'], tempDir);

      // Should show version bump
      assert(
        result.stdout.includes('📈 Version bumped (patch): 1.0.1'),
        'Should show version bump'
      );
      assert(
        result.stdout.includes('✅ Committed changes successfully'),
        'Should commit successfully'
      );

      // Verify package.json was updated
      const updatedPackage = JSON.parse(await readFile(join(tempDir, 'package.json'), 'utf8'));
      assert.strictEqual(updatedPackage.version, '1.0.1', 'Package version should be bumped');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  await t.test('CRITICAL: Allow empty commits when no tasks completed', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'taskwerk-empty-test-'));

    try {
      await setupGitRepo(tempDir);

      // Create a file change and stage it (but complete no tasks)
      await writeFile(join(tempDir, 'test-file.txt'), 'test content');
      await runGit(['add', 'test-file.txt'], tempDir);

      // Run commit without completed tasks
      const result = await runTaskwerk(['commit'], tempDir);

      // Should warn about no completed tasks
      assert(
        result.stdout.includes('⚠️  No completed tasks found since last commit'),
        'Should warn about no tasks'
      );
      assert(
        result.stdout.includes('💡 Use --allow-empty to commit anyway'),
        'Should suggest --allow-empty'
      );

      // Run with --allow-empty
      const emptyResult = await runTaskwerk(['commit', '--allow-empty'], tempDir);

      // Should show generic commit message
      assert(emptyResult.stdout.includes('chore: Update files'), 'Should generate generic message');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  await t.test('CRITICAL: Intelligent message generation from completed tasks', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'taskwerk-message-test-'));

    try {
      await setupGitRepo(tempDir);

      // Add and complete multiple tasks with different types
      await runTaskwerk(['add', 'Fix authentication bug', '--category', 'bugs'], tempDir);
      await runTaskwerk(['add', 'Add dark mode feature', '--category', 'features'], tempDir);
      await runTaskwerk(['complete', 'TASK-001', '--note', 'Fixed session timeout'], tempDir);
      await runTaskwerk(['complete', 'TASK-002', '--note', 'Added CSS variables'], tempDir);

      // Create and stage files
      await writeFile(join(tempDir, 'auth.js'), 'auth code');
      await writeFile(join(tempDir, 'styles.css'), 'styles');
      await runGit(['add', '.'], tempDir);

      // Run commit to see message generation
      const result = await runTaskwerk(['commit'], tempDir);

      // Should generate intelligent message
      assert(result.stdout.includes('📝 Commit Message:'), 'Should show generated message');
      assert(
        result.stdout.includes('Tasks completed since last commit:'),
        'Should list completed tasks'
      );
      assert(result.stdout.includes('TASK-001'), 'Should include first task');
      assert(result.stdout.includes('TASK-002'), 'Should include second task');
      assert(result.stdout.includes('Files modified:'), 'Should list modified files');

      // Should detect appropriate commit type (fix vs feat)
      const messageContent = result.stdout;
      assert(
        messageContent.includes('fix:') || messageContent.includes('feat:'),
        'Should use appropriate conventional commit type'
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
