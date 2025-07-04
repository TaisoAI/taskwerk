import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { readFile, writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { archiveCommand } from '../../src/commands/archive.js';

const TEST_DIR = join(process.cwd(), 'test-temp-archive');
const TASKS_FILE = join(TEST_DIR, 'tasks.md');
const COMPLETED_FILE = join(TEST_DIR, 'tasks_completed.md');
const CONFIG_FILE = join(TEST_DIR, '.taskrc.json');

describe.skip('Archive Command Tests', () => {
  // These tests are for v2 CLI - disabled during v3 transition
  beforeEach(async () => {
    // Clean up any existing test directory
    if (existsSync(TEST_DIR)) {
      await cleanupTestDir();
    }

    // Create test directory
    await mkdir(TEST_DIR, { recursive: true });

    // Create test tasks file
    const initialTasks = `# Project Tasks

*Last updated: 06/29/2025*
*Current session: CLI*
*Next ID: TASK-003*

## HIGH Priority

- [ ] **TASK-001** Test task for archiving
- [>] **TASK-002** Task in progress

## MEDIUM Priority

- [ ] **TASK-004** Another test task
`;

    const initialCompleted = `# Completed Tasks

- [x] **TASK-010** Some completed task *[2025-06-29T20:00:00.000Z]*
  This task was completed successfully
  Files: src/test.js

`;

    const testConfig = {
      tasksFile: TASKS_FILE,
      completedFile: COMPLETED_FILE,
      defaultPriority: 'medium',
    };

    await writeFile(TASKS_FILE, initialTasks, 'utf8');
    await writeFile(COMPLETED_FILE, initialCompleted, 'utf8');
    await writeFile(CONFIG_FILE, JSON.stringify(testConfig, null, 2), 'utf8');

    // Change working directory for config loading
    process.chdir(TEST_DIR);
  });

  afterEach(async () => {
    process.chdir(process.cwd().replace(TEST_DIR, '').replace('/', '') || process.cwd());
    await cleanupTestDir();
  });

  async function cleanupTestDir() {
    try {
      if (existsSync(TASKS_FILE)) {
        await unlink(TASKS_FILE);
      }
      if (existsSync(COMPLETED_FILE)) {
        await unlink(COMPLETED_FILE);
      }
      if (existsSync(CONFIG_FILE)) {
        await unlink(CONFIG_FILE);
      }
      if (existsSync(join(TEST_DIR, '.task-session.json'))) {
        await unlink(join(TEST_DIR, '.task-session.json'));
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  it('should archive a task with reason', async () => {
    await archiveCommand('TASK-001', { reason: 'Requirements changed' });

    // Check that task was removed from active tasks
    const tasksContent = await readFile(TASKS_FILE, 'utf8');
    assert(!tasksContent.includes('**TASK-001**'), 'Task should be removed from active tasks');

    // Check that task was added to completed tasks as archived
    const completedContent = await readFile(COMPLETED_FILE, 'utf8');
    assert(completedContent.includes('- [~] **TASK-001**'), 'Task should be added as archived');
    assert(
      completedContent.includes('**Archived:** Requirements changed'),
      'Archive reason should be included'
    );
  });

  it('should archive a task with superseded-by option', async () => {
    await archiveCommand('TASK-001', {
      reason: 'Duplicate task',
      supersededBy: 'TASK-004',
    });

    const completedContent = await readFile(COMPLETED_FILE, 'utf8');
    assert(completedContent.includes('- [~] **TASK-001**'), 'Task should be archived');
    assert(
      completedContent.includes('**Archived:** Duplicate task'),
      'Archive reason should be included'
    );
    assert(
      completedContent.includes('**Superseded by:** TASK-004'),
      'Superseded by should be included'
    );
  });

  it('should archive a task with additional note', async () => {
    await archiveCommand('TASK-001', {
      reason: 'Feature removed from scope',
      note: 'May revisit in Q3 2025',
    });

    const completedContent = await readFile(COMPLETED_FILE, 'utf8');
    assert(completedContent.includes('- [~] **TASK-001**'), 'Task should be archived');
    assert(
      completedContent.includes('**Archived:** Feature removed from scope'),
      'Archive reason should be included'
    );
    assert(
      completedContent.includes('**Note:** May revisit in Q3 2025'),
      'Note should be included'
    );
  });

  it('should fail when archiving without reason', async () => {
    let errorThrown = false;
    let exitCode = 0;

    // Mock process.exit to capture exit code
    const originalExit = process.exit;
    process.exit = code => {
      exitCode = code;
      errorThrown = true;
      throw new Error('Process exit called');
    };

    try {
      await archiveCommand('TASK-001', {});
    } catch (error) {
      // Expected to throw due to mocked process.exit
    }

    // Restore original process.exit
    process.exit = originalExit;

    assert(errorThrown, 'Should exit with error when no reason provided');
    assert.strictEqual(exitCode, 1, 'Should exit with code 1');

    // Task should still be in active tasks
    const tasksContent = await readFile(TASKS_FILE, 'utf8');
    assert(tasksContent.includes('**TASK-001**'), 'Task should remain in active tasks');
  });

  it('should fail when archiving non-existent task', async () => {
    let errorThrown = false;
    let exitCode = 0;

    // Mock process.exit to capture exit code
    const originalExit = process.exit;
    process.exit = code => {
      exitCode = code;
      errorThrown = true;
      throw new Error('Process exit called');
    };

    try {
      await archiveCommand('TASK-999', { reason: 'Test reason' });
    } catch (error) {
      // Expected to throw due to mocked process.exit
    }

    // Restore original process.exit
    process.exit = originalExit;

    assert(errorThrown, 'Should exit with error when task not found');
    assert.strictEqual(exitCode, 1, 'Should exit with code 1');
  });

  it('should update Next ID header correctly after archiving', async () => {
    await archiveCommand('TASK-001', { reason: 'Test archival' });

    const tasksContent = await readFile(TASKS_FILE, 'utf8');
    assert(tasksContent.includes('*Next ID: TASK-003*'), 'Next ID should remain correct');
  });

  it('should handle case-insensitive task IDs', async () => {
    await archiveCommand('task-001', { reason: 'Case test' });

    // Check that task was removed from active tasks
    const tasksContent = await readFile(TASKS_FILE, 'utf8');
    assert(!tasksContent.includes('**TASK-001**'), 'Task should be removed from active tasks');

    // Check that task was added to completed tasks as archived
    const completedContent = await readFile(COMPLETED_FILE, 'utf8');
    assert(completedContent.includes('- [~] **TASK-001**'), 'Task should be added as archived');
  });

  it('should maintain chronological order in completed tasks', async () => {
    await archiveCommand('TASK-001', { reason: 'First archive' });
    await archiveCommand('TASK-004', { reason: 'Second archive' });

    const completedContent = await readFile(COMPLETED_FILE, 'utf8');
    const task004Index = completedContent.indexOf('**TASK-004**');
    const task001Index = completedContent.indexOf('**TASK-001**');

    assert(task004Index < task001Index, 'Most recent archived task should appear first');
  });

  it('should include timestamp in archived task', async () => {
    const beforeTime = new Date().toISOString();
    await archiveCommand('TASK-001', { reason: 'Timestamp test' });
    const afterTime = new Date().toISOString();

    const completedContent = await readFile(COMPLETED_FILE, 'utf8');

    // Extract timestamp from the archived task
    const timestampMatch = completedContent.match(/\*\[([^\]]+)\]\*/);
    assert(timestampMatch, 'Archived task should have timestamp');

    const taskTimestamp = timestampMatch[1];
    assert(
      taskTimestamp >= beforeTime && taskTimestamp <= afterTime,
      'Timestamp should be within test execution time'
    );
  });
});
