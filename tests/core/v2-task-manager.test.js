import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { readFile, writeFile, mkdir, rm } from 'fs/promises';
import path from 'path';
import { V2TaskManager } from '../../src/core/v2-task-manager.js';

describe('V2TaskManager', () => {
  let taskManager;
  let testDir;
  let config;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = path.join('/tmp', `taskwerk-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    config = {
      tasksFile: path.join(testDir, 'tasks.md'),
      completedFile: path.join(testDir, 'tasks_completed.md'),
      sessionFile: path.join(testDir, '.task-session.json'),
    };

    taskManager = new V2TaskManager(config);

    // Create initial v2 tasks file
    await writeFile(config.tasksFile, '<!-- TaskWerk v2.0 Format -->\n\n', 'utf8');
    await writeFile(config.completedFile, '<!-- TaskWerk v2.0 Completed Tasks -->\n\n', 'utf8');
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await rm(testDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('task creation', () => {
    it('should create a v2 task with enhanced schema', async () => {
      const task = await taskManager.addTask({
        description: 'Test v2 task',
        priority: 'high',
        category: 'features',
        assignee: '@johndoe',
        estimated: '2h',
        dependencies: [],
      });

      assert.strictEqual(task.id, 'TASK-001');
      assert.strictEqual(task.description, 'Test v2 task');
      assert.strictEqual(task.priority, 'high');
      assert.strictEqual(task.category, 'features');
      assert.strictEqual(task.assignee, '@johndoe');
      assert.strictEqual(task.estimated, '2h');
      assert.strictEqual(task.status, 'todo');
      assert.strictEqual(task.format, 'v2');
      assert(Array.isArray(task.dependencies));
      assert(Array.isArray(task.timeline));
      assert(task.timeline.length > 0);
      assert.strictEqual(task.timeline[0].action, 'created');
    });

    it('should validate task schema before creation', async () => {
      await assert.rejects(async () => {
        await taskManager.addTask({
          description: '', // Invalid: empty description
          priority: 'invalid', // Invalid: bad priority
          assignee: 'no-at-symbol', // Invalid: bad format
        });
      }, /Task validation failed/);
    });

    it('should auto-migrate v1 content when adding v2 tasks', async () => {
      // Write v1 format content
      const v1Content = `# Tasks

## HIGH Priority

- [ ] **TASK-001** Existing v1 task`;

      await writeFile(config.tasksFile, v1Content, 'utf8');

      const task = await taskManager.addTask({
        description: 'New v2 task',
        priority: 'medium',
      });

      // Should have created TASK-002 (after existing TASK-001)
      assert.strictEqual(task.id, 'TASK-002');

      // File should now be in v2 format
      const content = await readFile(config.tasksFile, 'utf8');
      assert(content.includes('---')); // YAML frontmatter
      assert(content.includes('TaskWerk v2.0 Format'));
    });
  });

  describe('task retrieval', () => {
    beforeEach(async () => {
      // Create test tasks
      await taskManager.addTask({
        description: 'Todo task',
        priority: 'high',
        category: 'bugs',
      });

      await taskManager.addTask({
        description: 'Feature task',
        priority: 'medium',
        category: 'features',
        assignee: '@alice',
      });
    });

    it('should get all active tasks', async () => {
      const tasks = await taskManager.getTasks();

      assert.strictEqual(tasks.length, 2);
      assert.strictEqual(tasks[0].id, 'TASK-001');
      assert.strictEqual(tasks[1].id, 'TASK-002');
    });

    it('should filter tasks by priority', async () => {
      const highTasks = await taskManager.getTasks({ priority: 'high' });

      assert.strictEqual(highTasks.length, 1);
      assert.strictEqual(highTasks[0].description, 'Todo task');
    });

    it('should filter tasks by category', async () => {
      const featureTasks = await taskManager.getTasks({ category: 'features' });

      assert.strictEqual(featureTasks.length, 1);
      assert.strictEqual(featureTasks[0].description, 'Feature task');
    });

    it('should filter tasks by assignee', async () => {
      const aliceTasks = await taskManager.getTasks({ assignee: '@alice' });

      assert.strictEqual(aliceTasks.length, 1);
      assert.strictEqual(aliceTasks[0].description, 'Feature task');
    });

    it('should get a single task by ID', async () => {
      const task = await taskManager.getTask('TASK-001');

      assert.strictEqual(task.description, 'Todo task');
      assert.strictEqual(task.priority, 'high');
    });

    it('should throw error for non-existent task', async () => {
      await assert.rejects(
        async () => await taskManager.getTask('TASK-999'),
        /Task TASK-999 not found/
      );
    });

    it('should not include completed tasks in default getTasks()', async () => {
      // Add a third task and complete it
      await taskManager.addTask({
        description: 'Completed task',
        priority: 'medium',
      });

      await taskManager.startTask('TASK-003');
      await taskManager.completeTask('TASK-003');

      // Default getTasks should only return active tasks
      const activeTasks = await taskManager.getTasks();
      assert.strictEqual(activeTasks.length, 2);
      assert.strictEqual(
        activeTasks.every(t => t.status !== 'completed'),
        true
      );

      // Verify completed task exists in completed filter
      const completedTasks = await taskManager.getTasks({ completed: true });
      assert.strictEqual(completedTasks.length, 1);
      assert.strictEqual(completedTasks[0].status, 'completed');
    });

    it('should not include archived tasks in default getTasks()', async () => {
      // Add a third task and archive it
      await taskManager.addTask({
        description: 'Archived task',
        priority: 'low',
      });

      await taskManager.archiveTask('TASK-003', {
        reason: 'Test archive',
      });

      // Default getTasks should only return active tasks
      const activeTasks = await taskManager.getTasks();
      assert.strictEqual(activeTasks.length, 2);
      assert.strictEqual(
        activeTasks.every(t => t.status !== 'archived'),
        true
      );

      // Verify archived task exists in archived filter
      const archivedTasks = await taskManager.getTasks({ archived: true });
      assert.strictEqual(archivedTasks.length, 1);
      assert.strictEqual(archivedTasks[0].status, 'archived');
    });
  });

  describe('task status management', () => {
    let taskId;

    beforeEach(async () => {
      const task = await taskManager.addTask({
        description: 'Status test task',
        priority: 'medium',
      });
      taskId = task.id;
    });

    it('should start a task with timeline tracking', async () => {
      const updatedTask = await taskManager.startTask(taskId, {
        user: '@developer',
        note: 'Starting work',
      });

      assert.strictEqual(updatedTask.status, 'in_progress');
      assert(updatedTask.timeline.length >= 2); // created + started

      const startedEntry = updatedTask.timeline.find(e => e.action === 'started');
      assert(startedEntry);
      assert.strictEqual(startedEntry.user, '@developer');
      assert.strictEqual(startedEntry.note, 'Starting work');
    });

    it('should not start already in-progress task', async () => {
      await taskManager.startTask(taskId);

      await assert.rejects(async () => await taskManager.startTask(taskId), /already in progress/);
    });

    it('should pause a task with timeline tracking', async () => {
      await taskManager.startTask(taskId);
      const pausedTask = await taskManager.pauseTask(taskId, {
        user: '@developer',
        note: 'Taking a break',
      });

      assert.strictEqual(pausedTask.status, 'todo');

      const pausedEntry = pausedTask.timeline.find(e => e.action === 'paused');
      assert(pausedEntry);
      assert.strictEqual(pausedEntry.note, 'Taking a break');
    });

    it('should block a task with reason tracking', async () => {
      const blockedTask = await taskManager.blockTask(taskId, {
        reason: 'Waiting for API documentation',
        user: '@developer',
      });

      assert.strictEqual(blockedTask.status, 'blocked');

      const blockedEntry = blockedTask.timeline.find(e => e.action === 'blocked');
      assert(blockedEntry);
      assert.strictEqual(blockedEntry.note, 'Waiting for API documentation');
    });

    it('should require reason when blocking task', async () => {
      await assert.rejects(
        async () => await taskManager.blockTask(taskId, {}),
        /Block reason is required/
      );
    });

    it('should unblock a blocked task', async () => {
      await taskManager.blockTask(taskId, { reason: 'Blocked' });
      const unblockedTask = await taskManager.unblockTask(taskId, {
        user: '@developer',
        note: 'Dependencies resolved',
      });

      assert.strictEqual(unblockedTask.status, 'todo');

      const unblockedEntry = unblockedTask.timeline.find(e => e.action === 'unblocked');
      assert(unblockedEntry);
      assert.strictEqual(unblockedEntry.note, 'Dependencies resolved');
    });

    it('should not unblock non-blocked task', async () => {
      await assert.rejects(async () => await taskManager.unblockTask(taskId), /is not blocked/);
    });

    it('should complete a task with enhanced tracking', async () => {
      await taskManager.startTask(taskId);
      await taskManager.completeTask(taskId, {
        note: 'Task completed successfully',
        user: '@developer',
      });

      // Task should be moved to completed file
      const activeTasks = await taskManager.getTasks();
      assert.strictEqual(activeTasks.length, 0);

      const completedTasks = await taskManager.getTasks({ completed: true });
      assert.strictEqual(completedTasks.length, 1);
      assert.strictEqual(completedTasks[0].status, 'completed');
      assert.strictEqual(completedTasks[0].note, 'Task completed successfully');
    });

    it('should archive a task with reason', async () => {
      await taskManager.archiveTask(taskId, {
        reason: 'Requirements changed',
        note: 'Will revisit in Q3',
        user: '@manager',
      });

      // Task should be moved to completed file as archived
      const activeTasks = await taskManager.getTasks();
      assert.strictEqual(activeTasks.length, 0);

      const archivedTasks = await taskManager.getTasks({ archived: true });
      assert.strictEqual(archivedTasks.length, 1);
      assert.strictEqual(archivedTasks[0].status, 'archived');
      assert.strictEqual(archivedTasks[0].archiveReason, 'Requirements changed');
    });
  });

  describe('subtask management', () => {
    let parentTaskId;

    beforeEach(async () => {
      const task = await taskManager.addTask({
        description: 'Parent task with subtasks',
        priority: 'high',
      });
      parentTaskId = task.id;
    });

    it('should add subtask to parent task', async () => {
      const subtask = await taskManager.addSubtask(parentTaskId, {
        description: 'First subtask',
        assignee: '@developer',
      });

      assert.strictEqual(subtask.id, `${parentTaskId}.1`);
      assert.strictEqual(subtask.description, 'First subtask');
      assert.strictEqual(subtask.status, 'todo');
      assert.strictEqual(subtask.assignee, '@developer');

      const parentTask = await taskManager.getTask(parentTaskId);
      assert.strictEqual(parentTask.subtasks.length, 1);
      assert.strictEqual(parentTask.subtasks[0].id, subtask.id);
    });

    it('should update subtask status', async () => {
      const subtask = await taskManager.addSubtask(parentTaskId, {
        description: 'Subtask to update',
      });

      const updatedSubtask = await taskManager.updateSubtask(parentTaskId, subtask.id, {
        status: 'completed',
        assignee: '@newperson',
      });

      assert.strictEqual(updatedSubtask.status, 'completed');
      assert.strictEqual(updatedSubtask.assignee, '@newperson');
    });

    it('should handle multiple subtasks', async () => {
      await taskManager.addSubtask(parentTaskId, { description: 'Subtask 1' });
      await taskManager.addSubtask(parentTaskId, { description: 'Subtask 2' });
      await taskManager.addSubtask(parentTaskId, { description: 'Subtask 3' });

      const parentTask = await taskManager.getTask(parentTaskId);
      assert.strictEqual(parentTask.subtasks.length, 3);
      assert.strictEqual(parentTask.subtasks[0].id, `${parentTaskId}.1`);
      assert.strictEqual(parentTask.subtasks[1].id, `${parentTaskId}.2`);
      assert.strictEqual(parentTask.subtasks[2].id, `${parentTaskId}.3`);
    });
  });

  describe('dependency management', () => {
    let task1Id, task2Id, task3Id;

    beforeEach(async () => {
      const task1 = await taskManager.addTask({ description: 'Foundation task' });
      const task2 = await taskManager.addTask({ description: 'Dependent task' });
      const task3 = await taskManager.addTask({ description: 'Final task' });

      task1Id = task1.id;
      task2Id = task2.id;
      task3Id = task3.id;
    });

    it('should add dependency to task', async () => {
      const updatedTask = await taskManager.addDependency(task2Id, task1Id);

      assert(updatedTask.dependencies.includes(task1Id));
    });

    it('should remove dependency from task', async () => {
      await taskManager.addDependency(task2Id, task1Id);
      const updatedTask = await taskManager.removeDependency(task2Id, task1Id);

      assert(!updatedTask.dependencies.includes(task1Id));
    });

    it('should detect circular dependencies', async () => {
      await taskManager.addDependency(task2Id, task1Id);

      await assert.rejects(
        async () => await taskManager.addDependency(task1Id, task2Id),
        /Circular dependency detected/
      );
    });

    it('should validate dependencies when starting task', async () => {
      await taskManager.addDependency(task2Id, task1Id);

      try {
        await taskManager.startTask(task2Id);
        assert.fail('Expected error was not thrown');
      } catch (error) {
        assert(
          error.message.includes('is not completed'),
          `Expected error about dependency not completed, got: ${error.message}`
        );
      }
    });

    it('should allow starting task when dependencies are completed', async () => {
      await taskManager.addDependency(task2Id, task1Id);

      // Complete dependency first
      await taskManager.startTask(task1Id);
      await taskManager.completeTask(task1Id);

      // Now should be able to start dependent task
      const startedTask = await taskManager.startTask(task2Id);
      assert.strictEqual(startedTask.status, 'in_progress');
    });

    it('should get tasks ready to work on', async () => {
      await taskManager.addDependency(task2Id, task1Id);
      await taskManager.addDependency(task3Id, task2Id);

      const readyTasks = await taskManager.getReadyTasks();

      // Only task1 should be ready (no dependencies)
      assert.strictEqual(readyTasks.length, 1);
      assert.strictEqual(readyTasks[0].id, task1Id);
    });

    it('should build dependency tree', async () => {
      await taskManager.addDependency(task2Id, task1Id);
      await taskManager.addDependency(task3Id, task2Id);

      const tree = await taskManager.getDependencyTree(task3Id);

      assert.strictEqual(tree.task.id, task3Id);
      assert.strictEqual(tree.dependencies.length, 1);
      assert.strictEqual(tree.dependencies[0].task.id, task2Id);
      assert.strictEqual(tree.dependencies[0].dependencies.length, 1);
      assert.strictEqual(tree.dependencies[0].dependencies[0].task.id, task1Id);
    });
  });

  describe('enhanced search', () => {
    beforeEach(async () => {
      await taskManager.addTask({
        description: 'Fix authentication bug',
        category: 'bugs',
        assignee: '@alice',
      });

      await taskManager.addTask({
        description: 'Add dark mode feature',
        category: 'features',
        assignee: '@bob',
      });
    });

    it('should search by description', async () => {
      const results = await taskManager.searchTasks('authentication');

      assert.strictEqual(results.length, 1);
      assert(results[0].description.includes('authentication'));
    });

    it('should search by category', async () => {
      const results = await taskManager.searchTasks('bugs');

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].category, 'bugs');
    });

    it('should search by assignee', async () => {
      const results = await taskManager.searchTasks('@alice');

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].assignee, '@alice');
    });

    it('should return empty results for no matches', async () => {
      const results = await taskManager.searchTasks('nonexistent');

      assert.strictEqual(results.length, 0);
    });
  });

  describe('enhanced statistics', () => {
    beforeEach(async () => {
      // Create various tasks
      await taskManager.addTask({
        description: 'High priority bug',
        priority: 'high',
        category: 'bugs',
        assignee: '@alice',
      });

      await taskManager.addTask({
        description: 'Medium priority feature',
        priority: 'medium',
        category: 'features',
        assignee: '@bob',
        dependencies: ['TASK-001'],
      });

      const task3 = await taskManager.addTask({
        description: 'Task with subtasks',
        priority: 'low',
      });

      await taskManager.addSubtask(task3.id, { description: 'Subtask 1' });

      // Complete one task
      await taskManager.startTask('TASK-001');
      await taskManager.completeTask('TASK-001');
    });

    it('should provide enhanced statistics', async () => {
      const stats = await taskManager.getStats();

      assert.strictEqual(stats.total, 2); // Active tasks
      assert.strictEqual(stats.todo, 2);
      assert.strictEqual(stats.completed, 1);
      assert.strictEqual(stats.priorities.high, 0); // TASK-001 was completed
      assert.strictEqual(stats.priorities.medium, 1);
      assert.strictEqual(stats.priorities.low, 1);
      assert.strictEqual(stats.withDependencies, 1);
      assert.strictEqual(stats.withSubtasks, 1);
      assert(typeof stats.completionRate === 'number');
      assert(typeof stats.categories === 'object');
      assert(typeof stats.assignees === 'object');
    });

    it('should calculate completion rate correctly', async () => {
      const stats = await taskManager.getStats();

      // 1 completed out of 3 total = 33%
      assert.strictEqual(stats.completionRate, 33);
    });
  });

  describe('task context', () => {
    it('should provide enhanced task context', async () => {
      const task1 = await taskManager.addTask({ description: 'Foundation' });
      const task2 = await taskManager.addTask({
        description: 'Dependent',
        dependencies: [task1.id],
      });

      const context = await taskManager.getTaskContext(task2.id);

      assert.strictEqual(context.task.id, task2.id);
      assert(context.dependencyTree);
      assert.strictEqual(context.dependencyTree.task.id, task2.id);
      assert.strictEqual(context.dependencyTree.dependencies.length, 1);
      assert(context.session);
    });
  });

  describe('recently completed tasks', () => {
    it('should get recently completed tasks', async () => {
      const task1 = await taskManager.addTask({ description: 'First task' });
      const task2 = await taskManager.addTask({ description: 'Second task' });

      // Complete tasks in order
      await taskManager.startTask(task1.id);
      await taskManager.completeTask(task1.id);

      await taskManager.startTask(task2.id);
      await taskManager.completeTask(task2.id);

      const recent = await taskManager.getRecentlyCompleted();

      assert.strictEqual(recent.length, 2);
      // Should be in reverse chronological order
      assert.strictEqual(recent[0].id, task2.id);
      assert.strictEqual(recent[1].id, task1.id);
    });

    it('should limit recently completed tasks', async () => {
      // Complete multiple tasks
      for (let i = 0; i < 5; i++) {
        const task = await taskManager.addTask({ description: `Task ${i + 1}` });
        await taskManager.startTask(task.id);
        await taskManager.completeTask(task.id);
      }

      const recent = await taskManager.getRecentlyCompleted(3);

      assert.strictEqual(recent.length, 3);
    });
  });

  describe('error handling', () => {
    it('should handle missing tasks file gracefully', async () => {
      await rm(config.tasksFile);

      await assert.rejects(async () => await taskManager.getTasks(), /Tasks file not found/);
    });

    it('should handle missing completed file gracefully', async () => {
      await rm(config.completedFile);

      // Should not throw error, should return empty list
      const completed = await taskManager.getTasks({ completed: true });
      assert.strictEqual(completed.length, 0);
    });

    it('should validate subtask operations', async () => {
      await assert.rejects(
        async () => await taskManager.updateSubtask('TASK-999', 'TASK-999.1', {}),
        /Task TASK-999 not found/
      );
    });

    it('should handle dependency validation errors', async () => {
      const task = await taskManager.addTask({ description: 'Test task' });

      await assert.rejects(
        async () => await taskManager.addDependency(task.id, 'TASK-999'),
        /Dependency TASK-999 not found/
      );
    });
  });
});
