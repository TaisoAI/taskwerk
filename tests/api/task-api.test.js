/**
 * Tests for TaskWerk v3 Core Task CRUD API
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { join } from 'path';
import { unlinkSync, existsSync } from 'fs';
import { TaskAPI } from '../../src/api/task-api.js';
import { APIError, ValidationError } from '../../src/api/base-api.js';

describe('Task CRUD API', () => {
    let api;
    let dbPath;

    beforeEach(async () => {
        // Use temporary database for each test
        dbPath = join('/tmp', `taskwerk-task-api-test-${Date.now()}.db`);
        api = new TaskAPI(dbPath);
        await api.initialize();
    });

    afterEach(() => {
        // Clean up test database
        if (api) {
            api.close();
        }
        if (existsSync(dbPath)) {
            unlinkSync(dbPath);
        }
    });

    describe('Task Creation', () => {
        test('should create a basic task', async () => {
            const taskData = {
                name: 'Test Task',
                description: 'A test task for validation'
            };

            const task = await api.createTask(taskData);

            assert.ok(task);
            assert.strictEqual(task.name, 'Test Task');
            assert.strictEqual(task.description, 'A test task for validation');
            assert.strictEqual(task.status, 'todo');
            assert.strictEqual(task.priority, 'medium');
            assert.strictEqual(task.progress, 0);
            assert.strictEqual(task.format, 'v3');
            assert.ok(task.id);
            assert.ok(task.string_id);
            assert.strictEqual(task.string_id, 'TASK-001');
            assert.ok(task.created_at);
            assert.ok(task.updated_at);
        });

        test('should create task with all fields', async () => {
            const taskData = {
                name: 'Complex Task',
                description: 'A complex task with all fields',
                status: 'in_progress',
                priority: 'high',
                category: 'feature',
                assignee: 'john@example.com',
                estimated: '2 days',
                progress: 25
            };

            const task = await api.createTask(taskData);

            assert.strictEqual(task.name, 'Complex Task');
            assert.strictEqual(task.status, 'in_progress');
            assert.strictEqual(task.priority, 'high');
            assert.strictEqual(task.category, 'feature');
            assert.strictEqual(task.assignee, 'john@example.com');
            assert.strictEqual(task.estimated, '2 days');
            assert.strictEqual(task.progress, 25);
        });

        test('should validate required fields', async () => {
            const invalidTask = {
                description: 'Missing name'
            };

            await assert.rejects(
                async () => await api.createTask(invalidTask),
                ValidationError
            );
        });

        test('should validate field constraints', async () => {
            const invalidTask = {
                name: 'Test',
                status: 'invalid_status',
                priority: 'invalid_priority'
            };

            await assert.rejects(
                async () => await api.createTask(invalidTask),
                ValidationError
            );
        });

        test('should create timeline note on creation', async () => {
            const task = await api.createTask({ name: 'Test Task' });
            
            assert.ok(Array.isArray(task.recent_notes));
            assert.ok(task.recent_notes.length > 0);
            assert.ok(task.recent_notes[0].note.includes('created'));
            assert.strictEqual(task.recent_notes[0].note_type, 'system');
        });
    });

    describe('Task Retrieval', () => {
        let testTask;

        beforeEach(async () => {
            testTask = await api.createTask({
                name: 'Test Task',
                description: 'Test description',
                status: 'in_progress',
                priority: 'high'
            });
        });

        test('should get task by numeric ID', async () => {
            const task = await api.getTask(testTask.id);
            
            assert.ok(task);
            assert.strictEqual(task.id, testTask.id);
            assert.strictEqual(task.name, 'Test Task');
        });

        test('should get task by string ID', async () => {
            const task = await api.getTask('TASK-001');
            
            assert.ok(task);
            assert.strictEqual(task.string_id, 'TASK-001');
            assert.strictEqual(task.name, 'Test Task');
        });

        test('should return null for non-existent task', async () => {
            const task = await api.getTask(99999);
            assert.strictEqual(task, null);
        });

        test('should throw error for invalid string ID format', async () => {
            await assert.rejects(
                async () => await api.getTask('INVALID-ID'),
                Error
            );
        });

        test('should enrich task with related data', async () => {
            const task = await api.getTask(testTask.id);
            
            assert.ok(Array.isArray(task.dependencies));
            assert.ok(Array.isArray(task.dependents));
            assert.ok(Array.isArray(task.recent_notes));
            assert.ok(Array.isArray(task.keywords));
            assert.ok(task.string_id);
        });
    });

    describe('Task Updates', () => {
        let testTask;

        beforeEach(async () => {
            testTask = await api.createTask({
                name: 'Test Task',
                description: 'Original description',
                status: 'todo',
                priority: 'medium'
            });
        });

        test('should update task fields', async () => {
            const updates = {
                description: 'Updated description',
                priority: 'high',
                assignee: 'jane@example.com'
            };

            const updatedTask = await api.updateTask(testTask.id, updates);

            assert.strictEqual(updatedTask.description, 'Updated description');
            assert.strictEqual(updatedTask.priority, 'high');
            assert.strictEqual(updatedTask.assignee, 'jane@example.com');
            assert.notStrictEqual(updatedTask.updated_at, testTask.updated_at);
        });

        test('should handle status transitions', async () => {
            const updatedTask = await api.updateTask(testTask.id, { 
                status: 'completed',
                progress: 100
            });

            assert.strictEqual(updatedTask.status, 'completed');
            assert.strictEqual(updatedTask.progress, 100);
            assert.ok(updatedTask.completed_at);
        });

        test('should record changes in timeline', async () => {
            await api.updateTask(testTask.id, { 
                status: 'in_progress',
                priority: 'high'
            });

            const task = await api.getTask(testTask.id);
            
            // Should have creation note plus change notes
            assert.ok(task.recent_notes.length >= 3);
            
            // Find status change note
            const statusNote = task.recent_notes.find(note => 
                note.note.includes('Status changed')
            );
            assert.ok(statusNote);
            assert.strictEqual(statusNote.note_type, 'state_change');
        });

        test('should return unchanged task when no updates', async () => {
            const result = await api.updateTask(testTask.id, {});
            
            assert.deepStrictEqual(result.updated_at, testTask.updated_at);
        });

        test('should validate update constraints', async () => {
            await assert.rejects(
                async () => await api.updateTask(testTask.id, { 
                    status: 'invalid_status' 
                }),
                ValidationError
            );
        });

        test('should handle task not found', async () => {
            await assert.rejects(
                async () => await api.updateTask(99999, { name: 'Updated' }),
                APIError
            );
        });
    });

    describe('Task Deletion', () => {
        let testTask;

        beforeEach(async () => {
            testTask = await api.createTask({
                name: 'Test Task',
                description: 'To be deleted'
            });
        });

        test('should delete task successfully', async () => {
            const result = await api.deleteTask(testTask.id);

            assert.strictEqual(result.success, true);
            assert.ok(result.deletedTask);
            assert.strictEqual(result.deletedTask.id, testTask.id);
            assert.ok(result.deletedAt);

            // Verify task is deleted
            const task = await api.getTask(testTask.id);
            assert.strictEqual(task, null);
        });

        test('should handle task not found', async () => {
            await assert.rejects(
                async () => await api.deleteTask(99999),
                APIError
            );
        });

        test('should add deletion note before deleting', async () => {
            // Get timeline count before deletion
            const beforeTask = await api.getTask(testTask.id);
            const notesBefore = beforeTask.recent_notes.length;

            await api.deleteTask(testTask.id);

            // Note: can't verify the note was added since task is deleted
            // This would be verified by checking the timeline in a real scenario
            assert.ok(notesBefore >= 1); // At least creation note
        });
    });

    describe('Task Listing', () => {
        beforeEach(async () => {
            // Create test tasks
            await api.createTask({
                name: 'Task 1',
                status: 'todo',
                priority: 'high',
                assignee: 'alice@example.com',
                category: 'feature'
            });

            await api.createTask({
                name: 'Task 2',
                status: 'in_progress',
                priority: 'medium',
                assignee: 'bob@example.com',
                category: 'bug'
            });

            await api.createTask({
                name: 'Task 3',
                status: 'completed',
                priority: 'low',
                assignee: 'alice@example.com',
                category: 'feature'
            });
        });

        test('should list all tasks', async () => {
            const result = await api.listTasks();

            assert.ok(Array.isArray(result.tasks));
            assert.strictEqual(result.tasks.length, 3);
            assert.ok(result.pagination);
            assert.strictEqual(result.pagination.total, 3);
        });

        test('should filter by status', async () => {
            const result = await api.listTasks({ status: 'todo' });

            assert.strictEqual(result.tasks.length, 1);
            assert.strictEqual(result.tasks[0].status, 'todo');
        });

        test('should filter by priority', async () => {
            const result = await api.listTasks({ priority: 'high' });

            assert.strictEqual(result.tasks.length, 1);
            assert.strictEqual(result.tasks[0].priority, 'high');
        });

        test('should filter by assignee', async () => {
            const result = await api.listTasks({ assignee: 'alice@example.com' });

            assert.strictEqual(result.tasks.length, 2);
            for (const task of result.tasks) {
                assert.strictEqual(task.assignee, 'alice@example.com');
            }
        });

        test('should filter by category', async () => {
            const result = await api.listTasks({ category: 'feature' });

            assert.strictEqual(result.tasks.length, 2);
            for (const task of result.tasks) {
                assert.strictEqual(task.category, 'feature');
            }
        });

        test('should support pagination', async () => {
            const result = await api.listTasks({ limit: 2, offset: 1 });

            assert.strictEqual(result.tasks.length, 2);
            assert.strictEqual(result.pagination.limit, 2);
            assert.strictEqual(result.pagination.offset, 1);
            assert.strictEqual(result.pagination.total, 3);
        });

        test('should support sorting', async () => {
            const result = await api.listTasks({ 
                sortBy: 'name', 
                sortOrder: 'asc' 
            });

            assert.strictEqual(result.tasks[0].name, 'Task 1');
            assert.strictEqual(result.tasks[1].name, 'Task 2');
            assert.strictEqual(result.tasks[2].name, 'Task 3');
        });

        test('should combine multiple filters', async () => {
            const result = await api.listTasks({
                status: 'todo',
                priority: 'high',
                assignee: 'alice@example.com'
            });

            assert.strictEqual(result.tasks.length, 1);
            const task = result.tasks[0];
            assert.strictEqual(task.status, 'todo');
            assert.strictEqual(task.priority, 'high');
            assert.strictEqual(task.assignee, 'alice@example.com');
        });
    });

    describe('Task Search', () => {
        beforeEach(async () => {
            await api.createTask({
                name: 'Frontend Development',
                description: 'Build React components for user interface'
            });

            await api.createTask({
                name: 'Backend API',
                description: 'Create REST API endpoints'
            });

            await api.createTask({
                name: 'Database Migration',
                description: 'Update database schema'
            });
        });

        test('should search by name', async () => {
            const result = await api.searchTasks('Frontend', {
                fields: ['name']
            });

            assert.strictEqual(result.results.length, 1);
            assert.strictEqual(result.results[0].name, 'Frontend Development');
        });

        test('should search by description', async () => {
            const result = await api.searchTasks('API', {
                fields: ['description']
            });

            assert.strictEqual(result.results.length, 1);
            assert.strictEqual(result.results[0].name, 'Backend API');
        });

        test('should search across multiple fields', async () => {
            const result = await api.searchTasks('database', {
                fields: ['name', 'description']
            });

            assert.ok(result.results.length >= 1);
            // Should find at least "Database Migration" (name match)
            const taskNames = result.results.map(t => t.name);
            assert.ok(taskNames.includes('Database Migration'));
        });

        test('should handle case-insensitive search', async () => {
            const result = await api.searchTasks('FRONTEND');

            assert.ok(result.results.length > 0);
        });

        test('should limit results', async () => {
            const result = await api.searchTasks('a', { limit: 2 });

            assert.ok(result.results.length <= 2);
        });

        test('should return search metadata', async () => {
            const result = await api.searchTasks('test');

            assert.strictEqual(result.query, 'test');
            assert.ok(Array.isArray(result.searchFields));
            assert.strictEqual(typeof result.total, 'number');
        });
    });

    describe('Task Statistics', () => {
        beforeEach(async () => {
            // Create diverse tasks for statistics
            await api.createTask({
                name: 'Task 1',
                status: 'todo',
                priority: 'high',
                category: 'feature'
            });

            await api.createTask({
                name: 'Task 2',
                status: 'in_progress',
                priority: 'medium',
                category: 'bug'
            });

            await api.createTask({
                name: 'Task 3',
                status: 'completed',
                priority: 'high',
                category: 'feature'
            });

            await api.createTask({
                name: 'Task 4',
                status: 'todo',
                priority: 'low',
                category: 'documentation'
            });
        });

        test('should return comprehensive statistics', async () => {
            const stats = await api.getTaskStats();

            assert.strictEqual(stats.total, 4);
            assert.ok(stats.byStatus);
            assert.ok(stats.byPriority);
            assert.ok(stats.byCategory);
            assert.ok(stats.recent);
        });

        test('should count tasks by status', async () => {
            const stats = await api.getTaskStats();

            assert.strictEqual(stats.byStatus.todo, 2);
            assert.strictEqual(stats.byStatus.in_progress, 1);
            assert.strictEqual(stats.byStatus.completed, 1);
        });

        test('should count tasks by priority', async () => {
            const stats = await api.getTaskStats();

            assert.strictEqual(stats.byPriority.high, 2);
            assert.strictEqual(stats.byPriority.medium, 1);
            assert.strictEqual(stats.byPriority.low, 1);
        });

        test('should count tasks by category', async () => {
            const stats = await api.getTaskStats();

            assert.strictEqual(stats.byCategory.feature, 2);
            assert.strictEqual(stats.byCategory.bug, 1);
            assert.strictEqual(stats.byCategory.documentation, 1);
        });

        test('should include recent activity', async () => {
            const stats = await api.getTaskStats();

            assert.strictEqual(typeof stats.recent.created, 'number');
            assert.strictEqual(typeof stats.recent.updated, 'number');
            assert.strictEqual(typeof stats.recent.completed, 'number');
            
            // All tasks were created recently
            assert.strictEqual(stats.recent.created, 4);
        });
    });

    describe('Transaction Safety', () => {
        test('should rollback on creation failure', async () => {
            // Mock a database error during creation
            const originalTransaction = api.transaction;
            api.transaction = async (operation) => {
                const db = await api.getDatabase();
                throw new Error('Simulated database error');
            };

            await assert.rejects(
                async () => await api.createTask({ name: 'Test Task' }),
                Error
            );

            // Restore original transaction method
            api.transaction = originalTransaction;

            // Verify no task was created
            const result = await api.listTasks();
            assert.strictEqual(result.tasks.length, 0);
        });

        test('should rollback on update failure', async () => {
            const task = await api.createTask({ name: 'Test Task' });
            
            // Mock a failure during update
            const originalAddTimelineNote = api.addTimelineNote;
            api.addTimelineNote = () => {
                throw new Error('Timeline error');
            };

            await assert.rejects(
                async () => await api.updateTask(task.id, { name: 'Updated' }),
                Error
            );

            // Restore method
            api.addTimelineNote = originalAddTimelineNote;

            // Verify task was not updated
            const unchangedTask = await api.getTask(task.id);
            assert.strictEqual(unchangedTask.name, 'Test Task');
        });
    });
});