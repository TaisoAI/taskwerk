import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { readFile, writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { TaskManager } from '../../src/core/task-manager.js';

const TEST_DIR = join(process.cwd(), 'test-temp-task-manager-archive');
const TASKS_FILE = join(TEST_DIR, 'tasks.md');
const COMPLETED_FILE = join(TEST_DIR, 'tasks_completed.md');

describe('TaskManager Archive Tests', () => {
  let taskManager;
  let config;

  beforeEach(async () => {
    // Clean up any existing test directory
    if (existsSync(TEST_DIR)) {
      await cleanupTestDir();
    }

    // Create test directory
    await mkdir(TEST_DIR, { recursive: true });

    config = {
      tasksFile: TASKS_FILE,
      completedFile: COMPLETED_FILE,
      defaultPriority: 'medium',
    };

    taskManager = new TaskManager(config);

    // Create test tasks file
    const initialTasks = `# Project Tasks

*Last updated: 06/29/2025*
*Current session: CLI*
*Next ID: TASK-003*

## HIGH Priority

- [ ] **TASK-001** Task to be archived
- [>] **TASK-002** Task in progress

## MEDIUM Priority

- [ ] **TASK-004** Another task
`;

    const initialCompleted = `# Completed Tasks

- [x] **TASK-010** Existing completed task *[2025-06-29T20:00:00.000Z]*
  This task was completed successfully

`;

    await writeFile(TASKS_FILE, initialTasks, 'utf8');
    await writeFile(COMPLETED_FILE, initialCompleted, 'utf8');
  });

  afterEach(async () => {
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
      if (existsSync(join(TEST_DIR, '.task-session.json'))) {
        await unlink(join(TEST_DIR, '.task-session.json'));
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  describe('archiveTask', () => {
    it('should archive a task successfully', async () => {
      const options = {
        reason: 'Requirements changed',
        note: 'May revisit in Q3',
      };

      const result = await taskManager.archiveTask('TASK-001', options);

      assert.strictEqual(result.id, 'TASK-001');
      assert.strictEqual(result.description, 'Task to be archived');

      // Verify task removed from active tasks
      const activeTasks = await taskManager.getTasks();
      const archivedTask = activeTasks.find(t => t.id === 'TASK-001');
      assert.strictEqual(archivedTask, undefined, 'Task should be removed from active tasks');

      // Verify task added to completed tasks as archived
      const completedContent = await readFile(COMPLETED_FILE, 'utf8');
      assert(
        completedContent.includes('- [~] **TASK-001**'),
        'Task should be archived in completed file'
      );
      assert(
        completedContent.includes('**Archived:** Requirements changed'),
        'Archive reason should be stored'
      );
      assert(completedContent.includes('**Note:** May revisit in Q3'), 'Note should be stored');
    });

    it('should archive a task with superseded-by option', async () => {
      const options = {
        reason: 'Duplicate task',
        supersededBy: 'TASK-004',
      };

      await taskManager.archiveTask('TASK-001', options);

      const completedContent = await readFile(COMPLETED_FILE, 'utf8');
      assert(
        completedContent.includes('**Superseded by:** TASK-004'),
        'Superseded by should be stored'
      );
    });

    it('should throw error when archiving without reason', async () => {
      await assert.rejects(
        async () => {
          await taskManager.archiveTask('TASK-001', {});
        },
        {
          message: 'Archive reason is required',
        }
      );
    });

    it('should throw error when archiving non-existent task', async () => {
      await assert.rejects(
        async () => {
          await taskManager.archiveTask('TASK-999', { reason: 'Test' });
        },
        {
          message: 'Task TASK-999 not found',
        }
      );
    });
  });

  describe('getTasks with archive filters', () => {
    beforeEach(async () => {
      // Archive one task and complete another for testing
      await taskManager.archiveTask('TASK-001', { reason: 'Test archive' });
      await taskManager.completeTask('TASK-002', { note: 'Test completion' });
    });

    it('should return only archived tasks when filtered', async () => {
      const archivedTasks = await taskManager.getTasks({ archived: true });

      assert.strictEqual(archivedTasks.length, 1);
      assert.strictEqual(archivedTasks[0].id, 'TASK-001');
      assert.strictEqual(archivedTasks[0].status, 'archived');
    });

    it('should return only completed tasks when filtered', async () => {
      const completedTasks = await taskManager.getTasks({ completed: true });

      assert.strictEqual(completedTasks.length, 2); // TASK-002 + TASK-010 from beforeEach
      const task002 = completedTasks.find(t => t.id === 'TASK-002');
      assert(task002, 'Should include newly completed task');
      assert.strictEqual(task002.status, 'completed');
    });

    it('should return both completed and archived tasks when all-closed filter used', async () => {
      const allClosedTasks = await taskManager.getTasks({ allClosed: true });

      assert.strictEqual(allClosedTasks.length, 3); // TASK-001 (archived) + TASK-002 (completed) + TASK-010 (completed)

      const archivedTask = allClosedTasks.find(t => t.status === 'archived');
      const completedTasks = allClosedTasks.filter(t => t.status === 'completed');

      assert(archivedTask, 'Should include archived task');
      assert.strictEqual(completedTasks.length, 2, 'Should include completed tasks');
    });

    it('should return active tasks by default', async () => {
      const activeTasks = await taskManager.getTasks();

      // Should only have TASK-004 left (TASK-001 archived, TASK-002 completed)
      assert.strictEqual(activeTasks.length, 1);
      assert.strictEqual(activeTasks[0].id, 'TASK-004');
      assert.strictEqual(activeTasks[0].status, 'todo');
    });
  });

  describe('getStats with archived tasks', () => {
    it('should include archived count in stats', async () => {
      // Archive one task
      await taskManager.archiveTask('TASK-001', { reason: 'Test archive' });

      const stats = await taskManager.getStats();

      assert.strictEqual(stats.archived, 1, 'Should count archived tasks');
      assert.strictEqual(stats.completed, 1, 'Should count completed tasks (TASK-010)');
      assert.strictEqual(
        stats.total,
        2,
        'Should count remaining active tasks (TASK-002, TASK-004)'
      );
    });

    it('should handle multiple archived and completed tasks', async () => {
      // Archive one task and complete another
      await taskManager.archiveTask('TASK-001', { reason: 'Test archive' });
      await taskManager.completeTask('TASK-002', { note: 'Test completion' });

      const stats = await taskManager.getStats();

      assert.strictEqual(stats.archived, 1, 'Should count archived tasks');
      assert.strictEqual(stats.completed, 2, 'Should count completed tasks (TASK-002 + TASK-010)');
      assert.strictEqual(stats.total, 1, 'Should count remaining active tasks (TASK-004)');
      assert.strictEqual(stats.todo, 1, 'Should count todo tasks');
      assert.strictEqual(stats.inProgress, 0, 'Should count in-progress tasks');
    });
  });

  describe('searchTasks with archived tasks', () => {
    it('should not find archived tasks in active search', async () => {
      await taskManager.archiveTask('TASK-001', { reason: 'Test archive' });

      const searchResults = await taskManager.searchTasks('archived');

      // Should not find the archived task in active search
      assert.strictEqual(searchResults.length, 0);
    });

    it('should find archived tasks when searching completed tasks', async () => {
      await taskManager.archiveTask('TASK-001', { reason: 'Test archive' });

      // Get archived tasks and search within them
      const archivedTasks = await taskManager.getTasks({ archived: true });
      const searchResults = archivedTasks.filter(
        task =>
          task.description.toLowerCase().includes('archived') ||
          task.description.toLowerCase().includes('task')
      );

      assert(
        searchResults.length > 0,
        'Should find archived tasks when searching in archived collection'
      );
    });
  });
});
