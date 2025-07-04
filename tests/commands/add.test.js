import { test } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'child_process';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';

const TEST_DIR = join(process.cwd(), 'test-temp-cli');

async function setupTestEnvironment() {
  await mkdir(TEST_DIR, { recursive: true });

  // Create test tasks file with proper structure
  await writeFile(
    join(TEST_DIR, 'tasks.md'),
    `# Project Tasks

*Last updated: 06/27/2025*
*Current session: CLI*

## HIGH Priority

### Bug Fixes

### Features

## MEDIUM Priority

### Refactoring

### Documentation

## LOW Priority

### Testing

---
*Total: 0 active tasks*
`
  );

  // Create completed tasks file
  await writeFile(
    join(TEST_DIR, 'tasks_completed.md'),
    `# Completed Tasks

*Most recent tasks first*

`
  );

  // Create test config
  await writeFile(
    join(TEST_DIR, '.taskrc.json'),
    JSON.stringify(
      {
        tasksFile: 'tasks.md',
        completedFile: 'tasks_completed.md',
        defaultPriority: 'medium',
        categories: {
          bugs: 'Bug Fixes',
          features: 'Features',
          docs: 'Documentation',
          refactor: 'Refactoring',
          test: 'Testing',
        },
      },
      null,
      2
    )
  );
}

async function cleanupTestEnvironment() {
  await rm(TEST_DIR, { recursive: true, force: true });
}

function runCLI(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [join(process.cwd(), 'src/cli.js'), ...args], {
      cwd: TEST_DIR,
      stdio: 'pipe',
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', data => {
      stdout += data.toString();
    });

    child.stderr.on('data', data => {
      stderr += data.toString();
    });

    child.on('close', code => {
      resolve({ code, stdout, stderr });
    });

    child.on('error', reject);
  });
}

test.skip('CLI add command creates new task', async () => {
  // This test is for v2 CLI - disabled during v3 transition
  await setupTestEnvironment();

  const result = await runCLI(['add', 'Test task description']);

  assert.strictEqual(result.code, 0);
  assert(result.stdout.includes('✅ Added task: TASK-001 - Test task description'));

  await cleanupTestEnvironment();
});

test.skip('CLI add command with priority and category', async () => {
  // This test is for v2 CLI - disabled during v3 transition
  await setupTestEnvironment();

  const result = await runCLI([
    'add',
    'High priority bug fix',
    '--priority',
    'high',
    '--category',
    'bugs',
  ]);

  assert.strictEqual(result.code, 0);
  assert(result.stdout.includes('✅ Added task: TASK-001 - High priority bug fix'));

  await cleanupTestEnvironment();
});

test.skip('CLI list command shows tasks', async () => {
  // This test is for v2 CLI - disabled during v3 transition
  await setupTestEnvironment();

  // Add a task first
  await runCLI(['add', 'Test task']);

  // Then list tasks
  const result = await runCLI(['list']);

  assert.strictEqual(result.code, 0);
  assert(result.stdout.includes('# Active Tasks'));
  assert(result.stdout.includes('TASK-001'));

  await cleanupTestEnvironment();
});

test.skip('CLI init command creates files', async () => {
  // This test is for v2 CLI - disabled during v3 transition
  await rm(TEST_DIR, { recursive: true, force: true });
  await mkdir(TEST_DIR, { recursive: true });

  const result = await runCLI(['init']);

  assert.strictEqual(result.code, 0);
  assert(result.stdout.includes('✅ Created tasks.md'));
  assert(result.stdout.includes('✅ Created tasks_completed.md'));

  await cleanupTestEnvironment();
});
