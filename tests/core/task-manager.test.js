import { test } from 'node:test';
import assert from 'node:assert';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { TaskManager } from '../../src/core/task-manager.js';

const TEST_DIR = join(process.cwd(), 'test-temp');
const TEST_CONFIG = {
  tasksFile: join(TEST_DIR, 'tasks.md'),
  completedFile: join(TEST_DIR, 'tasks_completed.md'),
  defaultPriority: 'medium',
  categories: {
    bugs: 'Bug Fixes',
    features: 'Features',
    docs: 'Documentation',
  },
};

async function setupTestFiles() {
  await mkdir(TEST_DIR, { recursive: true });
  await writeFile(
    TEST_CONFIG.tasksFile,
    `# Project Tasks

## HIGH Priority

### Bug Fixes

## MEDIUM Priority

### Features

- [ ] **TASK-001** Existing test task

### Bug Fixes

### Documentation

## LOW Priority

---
*Total: 1 active tasks*
`
  );
  await writeFile(TEST_CONFIG.completedFile, '# Completed Tasks\n\n## June 2025\n\n');
}

async function cleanupTestFiles() {
  await rm(TEST_DIR, { recursive: true, force: true });
}

test('TaskManager adds new task correctly', async () => {
  await setupTestFiles();

  const taskManager = new TaskManager(TEST_CONFIG);
  const task = await taskManager.addTask({
    description: 'Test task description',
    priority: 'high',
    category: 'bugs',
  });

  assert.strictEqual(task.description, 'Test task description');
  assert.strictEqual(task.priority, 'high');
  assert.strictEqual(task.category, 'bugs');
  assert.strictEqual(task.status, 'todo');
  assert.match(task.id, /^TASK-\d{3}$/);

  await cleanupTestFiles();
});

test('TaskManager gets tasks with filters', async () => {
  await setupTestFiles();

  const taskManager = new TaskManager(TEST_CONFIG);
  await taskManager.addTask({
    description: 'High priority bug',
    priority: 'high',
    category: 'bugs',
  });
  await taskManager.addTask({
    description: 'Medium priority feature',
    priority: 'medium',
    category: 'features',
  });

  const allTasks = await taskManager.getTasks();
  assert.strictEqual(allTasks.length, 3); // 1 existing + 2 new

  const highPriorityTasks = await taskManager.getTasks({ priority: 'high' });
  assert.strictEqual(highPriorityTasks.length, 1);
  assert.strictEqual(highPriorityTasks[0].description, 'High priority bug');

  const bugTasks = await taskManager.getTasks({ category: 'bugs' });
  assert.strictEqual(bugTasks.length, 1); // 1 new task with bugs category

  await cleanupTestFiles();
});

test('TaskManager starts and completes tasks', async () => {
  await setupTestFiles();

  const taskManager = new TaskManager(TEST_CONFIG);
  const task = await taskManager.addTask({ description: 'Test task', priority: 'medium' });

  // Start task
  const startedTask = await taskManager.startTask(task.id);
  assert.strictEqual(startedTask.status, 'in_progress');

  // Complete task
  await taskManager.completeTask(task.id, { note: 'Test completion' });

  // Task should no longer be in active tasks
  const activeTasks = await taskManager.getTasks();
  const foundTask = activeTasks.find(t => t.id === task.id);
  assert.strictEqual(foundTask, undefined);

  await cleanupTestFiles();
});

test('TaskManager search functionality', async () => {
  await setupTestFiles();

  const taskManager = new TaskManager(TEST_CONFIG);
  await taskManager.addTask({ description: 'Fix authentication bug', category: 'bugs' });
  await taskManager.addTask({ description: 'Add user dashboard', category: 'features' });
  await taskManager.addTask({ description: 'Update auth documentation', category: 'docs' });

  const authTasks = await taskManager.searchTasks('auth');
  assert.strictEqual(authTasks.length, 2);

  const bugTasks = await taskManager.searchTasks('bug');
  assert.strictEqual(bugTasks.length, 1);

  await cleanupTestFiles();
});

test('TaskManager handles errors gracefully', async () => {
  const badConfig = { tasksFile: '/nonexistent/path/tasks.md', completedFile: '/tmp/completed.md' };
  const taskManager = new TaskManager(badConfig);

  await assert.rejects(() => taskManager.getTasks(), /Tasks file not found/);
});
