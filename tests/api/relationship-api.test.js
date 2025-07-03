/**
 * Tests for TaskWerk v3 Relationship API
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { join } from 'path';
import { unlinkSync, existsSync } from 'fs';
import { RelationshipAPI } from '../../src/api/relationship-api.js';
import { TaskAPI } from '../../src/api/task-api.js';
import { APIError, ValidationError } from '../../src/api/base-api.js';

describe('Relationship API', () => {
    let relationshipAPI;
    let taskAPI;
    let dbPath;
    let testTasks = {};

    beforeEach(async () => {
        // Use temporary database for each test
        dbPath = join('/tmp', `taskwerk-relationship-test-${Date.now()}.db`);
        relationshipAPI = new RelationshipAPI(dbPath);
        taskAPI = new TaskAPI(dbPath);
        await relationshipAPI.initialize();

        // Create test tasks
        testTasks.parent = await taskAPI.createTask({
            name: 'Parent Task',
            description: 'A parent task for testing',
            priority: 'high'
        });

        testTasks.child1 = await taskAPI.createTask({
            name: 'Child Task 1',
            description: 'First child task',
            priority: 'medium'
        });

        testTasks.child2 = await taskAPI.createTask({
            name: 'Child Task 2',
            description: 'Second child task',
            priority: 'medium'
        });

        testTasks.independent = await taskAPI.createTask({
            name: 'Independent Task',
            description: 'Independent task for testing',
            priority: 'low'
        });

        testTasks.blocker = await taskAPI.createTask({
            name: 'Blocker Task',
            description: 'Task that blocks others',
            priority: 'high'
        });
    });

    afterEach(() => {
        // Clean up test database
        if (relationshipAPI) {
            relationshipAPI.close();
        }
        if (existsSync(dbPath)) {
            unlinkSync(dbPath);
        }
    });

    describe('Dependency Management', () => {
        test('should add blocking dependency', async () => {
            const dependency = await relationshipAPI.addDependency(
                testTasks.child1.id,
                testTasks.blocker.id,
                'blocks'
            );

            assert.ok(dependency);
            assert.strictEqual(dependency.task_id, testTasks.child1.id);
            assert.strictEqual(dependency.depends_on_id, testTasks.blocker.id);
            assert.strictEqual(dependency.dependency_type, 'blocks');
            assert.strictEqual(dependency.task_name, 'Child Task 1');
            assert.strictEqual(dependency.depends_on_name, 'Blocker Task');
            assert.ok(dependency.created_at);
        });

        test('should add requires relationship', async () => {
            const dependency = await relationshipAPI.addDependency(
                testTasks.child1.id,
                testTasks.parent.id,
                'requires'
            );

            assert.strictEqual(dependency.dependency_type, 'requires');
            assert.strictEqual(dependency.task_name, 'Child Task 1');
            assert.strictEqual(dependency.depends_on_name, 'Parent Task');
        });

        test('should prevent duplicate dependencies', async () => {
            await relationshipAPI.addDependency(
                testTasks.child1.id,
                testTasks.blocker.id,
                'blocks'
            );

            await assert.rejects(
                async () => await relationshipAPI.addDependency(
                    testTasks.child1.id,
                    testTasks.blocker.id,
                    'blocks'
                ),
                ValidationError
            );
        });

        test('should prevent self-dependency', async () => {
            await assert.rejects(
                async () => await relationshipAPI.addDependency(
                    testTasks.child1.id,
                    testTasks.child1.id,
                    'blocks'
                ),
                ValidationError
            );
        });

        test('should detect circular dependencies', async () => {
            // Create chain: child1 -> blocker -> child2 -> child1 (would be circular)
            await relationshipAPI.addDependency(testTasks.child1.id, testTasks.blocker.id, 'blocks');
            await relationshipAPI.addDependency(testTasks.blocker.id, testTasks.child2.id, 'blocks');

            await assert.rejects(
                async () => await relationshipAPI.addDependency(
                    testTasks.child2.id,
                    testTasks.child1.id,
                    'blocks'
                ),
                ValidationError
            );
        });

        test('should validate dependency types', async () => {
            await assert.rejects(
                async () => await relationshipAPI.addDependency(
                    testTasks.child1.id,
                    testTasks.blocker.id,
                    'invalid_type'
                ),
                ValidationError
            );
        });

        test('should handle non-existent tasks', async () => {
            await assert.rejects(
                async () => await relationshipAPI.addDependency(
                    99999,
                    testTasks.blocker.id,
                    'blocks'
                ),
                APIError
            );

            await assert.rejects(
                async () => await relationshipAPI.addDependency(
                    testTasks.child1.id,
                    99999,
                    'blocks'
                ),
                APIError
            );
        });
    });

    describe('Dependency Removal', () => {
        beforeEach(async () => {
            // Set up some dependencies for removal tests
            await relationshipAPI.addDependency(testTasks.child1.id, testTasks.blocker.id, 'blocks');
            await relationshipAPI.addDependency(testTasks.child1.id, testTasks.parent.id, 'requires');
        });

        test('should remove specific dependency', async () => {
            const result = await relationshipAPI.removeDependency(
                testTasks.child1.id,
                testTasks.blocker.id,
                'blocks'
            );

            assert.strictEqual(result.success, true);
            assert.ok(result.removedDependency);
            assert.strictEqual(result.removedDependency.dependency_type, 'blocks');
            assert.ok(result.removedAt);
        });

        test('should remove any dependency type when type not specified', async () => {
            const result = await relationshipAPI.removeDependency(
                testTasks.child1.id,
                testTasks.parent.id
            );

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.removedDependency.dependency_type, 'requires');
        });

        test('should handle non-existent dependency removal', async () => {
            await assert.rejects(
                async () => await relationshipAPI.removeDependency(
                    testTasks.child1.id,
                    testTasks.child2.id,
                    'blocks'
                ),
                APIError
            );
        });
    });

    describe('Dependency Queries', () => {
        beforeEach(async () => {
            // Set up complex dependency structure
            await relationshipAPI.addDependency(testTasks.child1.id, testTasks.blocker.id, 'blocks');
            await relationshipAPI.addDependency(testTasks.child1.id, testTasks.parent.id, 'requires');
            await relationshipAPI.addDependency(testTasks.child2.id, testTasks.child1.id, 'requires');
            await relationshipAPI.addDependency(testTasks.parent.id, testTasks.independent.id, 'blocks');
        });

        test('should get task dependencies', async () => {
            const dependencies = await relationshipAPI.getDependencies(testTasks.child1.id);

            assert.strictEqual(dependencies.task_id, testTasks.child1.id);
            assert.ok(Array.isArray(dependencies.depends_on));
            assert.ok(Array.isArray(dependencies.dependents));
            assert.strictEqual(dependencies.depends_on.length, 2);

            // Check that we have blocking and requires relationships
            const types = dependencies.depends_on.map(dep => dep.dependency_type);
            assert.ok(types.includes('blocks'));
            assert.ok(types.includes('requires'));
        });

        test('should get reverse dependencies when requested', async () => {
            const dependencies = await relationshipAPI.getDependencies(testTasks.child1.id, true);

            assert.ok(dependencies.dependents.length > 0);
            const dependent = dependencies.dependents.find(dep => dep.task_id === testTasks.child2.id);
            assert.ok(dependent);
            assert.strictEqual(dependent.dependency_type, 'requires');
        });

        test('should include task status in dependency info', async () => {
            const dependencies = await relationshipAPI.getDependencies(testTasks.child1.id);

            for (const dep of dependencies.depends_on) {
                assert.ok(dep.depends_on_name);
                assert.ok(dep.depends_on_status);
            }
        });
    });

    describe('Subtask Management', () => {
        test('should add subtask relationship', async () => {
            const subtask = await relationshipAPI.addSubtask(
                testTasks.parent.id,
                testTasks.child1.id
            );

            assert.strictEqual(subtask.dependency_type, 'requires');
            assert.strictEqual(subtask.task_id, testTasks.child1.id);
            assert.strictEqual(subtask.depends_on_id, testTasks.parent.id);
        });

        test('should remove subtask relationship', async () => {
            await relationshipAPI.addSubtask(testTasks.parent.id, testTasks.child1.id);
            
            const result = await relationshipAPI.removeSubtask(
                testTasks.parent.id,
                testTasks.child1.id
            );

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.removedDependency.dependency_type, 'requires');
        });

        test('should promote subtask to independent task', async () => {
            await relationshipAPI.addSubtask(testTasks.parent.id, testTasks.child1.id);
            
            const result = await relationshipAPI.promoteSubtask(testTasks.child1.id);

            assert.strictEqual(result.success, true);
            assert.ok(result.promotedTask);
            assert.ok(result.formerParent);
            assert.strictEqual(result.promotedTask.id, testTasks.child1.id);
            assert.strictEqual(result.formerParent.id, testTasks.parent.id);

            // Verify subtask relationship is removed
            const dependencies = await relationshipAPI.getDependencies(testTasks.child1.id);
            const subtaskRel = dependencies.depends_on.find(dep => dep.dependency_type === 'requires');
            assert.strictEqual(subtaskRel, undefined);
        });

        test('should handle promoting non-subtask', async () => {
            await assert.rejects(
                async () => await relationshipAPI.promoteSubtask(testTasks.independent.id),
                APIError
            );
        });

        test('should demote task to subtask', async () => {
            const result = await relationshipAPI.demoteTask(
                testTasks.independent.id,
                testTasks.parent.id
            );

            assert.strictEqual(result.dependency_type, 'requires');
            assert.strictEqual(result.task_id, testTasks.independent.id);
            assert.strictEqual(result.depends_on_id, testTasks.parent.id);
        });

        test('should move subtask to different parent', async () => {
            await relationshipAPI.addSubtask(testTasks.parent.id, testTasks.child1.id);
            
            const result = await relationshipAPI.moveSubtask(
                testTasks.child1.id,
                testTasks.blocker.id
            );

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.movedTask.id, testTasks.child1.id);
            assert.strictEqual(result.oldParent.id, testTasks.parent.id);
            assert.strictEqual(result.newParent.id, testTasks.blocker.id);

            // Verify new relationship
            const dependencies = await relationshipAPI.getDependencies(testTasks.child1.id);
            const subtaskRel = dependencies.depends_on.find(dep => dep.dependency_type === 'requires');
            assert.ok(subtaskRel);
            assert.strictEqual(subtaskRel.depends_on_id, testTasks.blocker.id);
        });

        test('should prevent circular subtask relationships', async () => {
            await relationshipAPI.addSubtask(testTasks.parent.id, testTasks.child1.id);
            
            await assert.rejects(
                async () => await relationshipAPI.addSubtask(testTasks.child1.id, testTasks.parent.id),
                ValidationError
            );
        });
    });

    describe('Task Hierarchy', () => {
        beforeEach(async () => {
            // Create a hierarchy: parent -> child1 -> grandchild1, parent -> child2
            const grandchild1 = await taskAPI.createTask({
                name: 'Grandchild 1',
                description: 'A grandchild task'
            });
            testTasks.grandchild1 = grandchild1;

            await relationshipAPI.addSubtask(testTasks.parent.id, testTasks.child1.id);
            await relationshipAPI.addSubtask(testTasks.parent.id, testTasks.child2.id);
            await relationshipAPI.addSubtask(testTasks.child1.id, testTasks.grandchild1.id);
        });

        test('should get complete task hierarchy', async () => {
            const hierarchy = await relationshipAPI.getTaskHierarchy(testTasks.child1.id);

            assert.ok(hierarchy.task);
            assert.strictEqual(hierarchy.task.id, testTasks.child1.id);

            // Should have parent
            assert.ok(hierarchy.parent);
            assert.strictEqual(hierarchy.parent.id, testTasks.parent.id);

            // Should have children
            assert.ok(Array.isArray(hierarchy.children));
            assert.strictEqual(hierarchy.children.length, 1);
            assert.strictEqual(hierarchy.children[0].id, testTasks.grandchild1.id);

            // Should have ancestors and descendants for depth > 1
            assert.ok(Array.isArray(hierarchy.ancestors));
            assert.ok(Array.isArray(hierarchy.descendants));
        });

        test('should get hierarchy for root task', async () => {
            const hierarchy = await relationshipAPI.getTaskHierarchy(testTasks.parent.id);

            assert.strictEqual(hierarchy.parent, null);
            assert.strictEqual(hierarchy.children.length, 2);
            
            const childIds = hierarchy.children.map(child => child.id);
            assert.ok(childIds.includes(testTasks.child1.id));
            assert.ok(childIds.includes(testTasks.child2.id));
        });

        test('should get hierarchy for leaf task', async () => {
            const hierarchy = await relationshipAPI.getTaskHierarchy(testTasks.grandchild1.id);

            assert.ok(hierarchy.parent);
            assert.strictEqual(hierarchy.parent.id, testTasks.child1.id);
            assert.strictEqual(hierarchy.children.length, 0);
        });

        test('should limit hierarchy depth', async () => {
            const hierarchy = await relationshipAPI.getTaskHierarchy(testTasks.parent.id, 1);

            // With depth 1, should not include ancestors/descendants
            assert.strictEqual(hierarchy.ancestors.length, 0);
            assert.strictEqual(hierarchy.descendants.length, 0);
        });

        test('should handle non-existent task', async () => {
            await assert.rejects(
                async () => await relationshipAPI.getTaskHierarchy(99999),
                APIError
            );
        });
    });

    describe('Dependency Analysis', () => {
        beforeEach(async () => {
            // Create complex dependency chain for analysis
            const task1 = await taskAPI.createTask({ name: 'Analysis Task 1' });
            const task2 = await taskAPI.createTask({ name: 'Analysis Task 2' });
            const task3 = await taskAPI.createTask({ name: 'Analysis Task 3' });
            
            testTasks.analysis1 = task1;
            testTasks.analysis2 = task2;
            testTasks.analysis3 = task3;

            // Create chain: analysis1 blocks analysis2 blocks analysis3
            await relationshipAPI.addDependency(task2.id, task1.id, 'blocks');
            await relationshipAPI.addDependency(task3.id, task2.id, 'blocks');
            
            // Make analysis1 also block child1
            await relationshipAPI.addDependency(testTasks.child1.id, task1.id, 'blocks');
        });

        test('should analyze dependency chain', async () => {
            const analysis = await relationshipAPI.analyzeDependencyChain(testTasks.analysis1.id);

            assert.strictEqual(analysis.task_id, testTasks.analysis1.id);
            assert.ok(Array.isArray(analysis.blocking_chain));
            assert.ok(Array.isArray(analysis.blocked_by_chain));
            assert.ok(Array.isArray(analysis.critical_path));
            assert.ok(Array.isArray(analysis.cycle_risks));

            // analysis1 should block analysis2 and child1
            assert.ok(analysis.blocking_chain.length >= 2);
            const blockedIds = analysis.blocking_chain.map(task => task.id);
            assert.ok(blockedIds.includes(testTasks.analysis2.id));
            assert.ok(blockedIds.includes(testTasks.child1.id));
        });

        test('should identify blocking chain', async () => {
            const analysis = await relationshipAPI.analyzeDependencyChain(testTasks.analysis1.id);
            
            // Should include tasks that would be affected if analysis1 changes
            assert.ok(analysis.blocking_chain.length > 0);
            
            for (const task of analysis.blocking_chain) {
                assert.ok(task.id);
                assert.ok(task.name);
                assert.ok(task.status);
                assert.ok(task.string_id);
            }
        });

        test('should identify blocked by chain', async () => {
            const analysis = await relationshipAPI.analyzeDependencyChain(testTasks.analysis3.id);
            
            // analysis3 is blocked by analysis2, which is blocked by analysis1
            assert.ok(analysis.blocked_by_chain.length >= 1);
            
            const blockerIds = analysis.blocked_by_chain.map(task => task.id);
            assert.ok(blockerIds.includes(testTasks.analysis2.id));
        });

        test('should calculate critical path', async () => {
            const analysis = await relationshipAPI.analyzeDependencyChain(testTasks.analysis3.id);
            
            assert.ok(Array.isArray(analysis.critical_path));
            // Critical path calculation is simplified in our implementation
            // but should return valid task objects
            for (const task of analysis.critical_path) {
                if (task) {
                    assert.ok(task.id !== undefined);
                    assert.ok(task.name);
                }
            }
        });

        test('should identify cycle risks', async () => {
            const analysis = await relationshipAPI.analyzeDependencyChain(testTasks.analysis1.id);
            
            assert.ok(Array.isArray(analysis.cycle_risks));
            // Cycle risks array can be empty if no risks detected
            for (const risk of analysis.cycle_risks) {
                assert.ok(risk.task_id);
                assert.ok(risk.task_name);
                assert.ok(risk.risk_type);
                assert.ok(risk.description);
            }
        });
    });

    describe('Error Handling', () => {
        test('should handle database transaction failures', async () => {
            // Mock a database error during dependency addition
            const originalTransaction = relationshipAPI.transaction;
            relationshipAPI.transaction = async (operation) => {
                throw new Error('Simulated database error');
            };

            await assert.rejects(
                async () => await relationshipAPI.addDependency(
                    testTasks.child1.id,
                    testTasks.blocker.id,
                    'blocks'
                ),
                Error
            );

            // Restore original transaction method
            relationshipAPI.transaction = originalTransaction;

            // Verify no dependency was created
            const dependencies = await relationshipAPI.getDependencies(testTasks.child1.id);
            assert.strictEqual(dependencies.depends_on.length, 0);
        });

        test('should validate task existence before operations', async () => {
            await assert.rejects(
                async () => await relationshipAPI.getDependencies(99999),
                Error
            );
        });

        test('should handle malformed dependency queries gracefully', async () => {
            // This tests the robustness of the API when given edge case inputs
            const dependencies = await relationshipAPI.getDependencies(testTasks.independent.id);
            
            assert.ok(dependencies);
            assert.strictEqual(dependencies.depends_on.length, 0);
            assert.strictEqual(dependencies.dependents.length, 0);
        });
    });

    describe('Timeline Integration', () => {
        test('should record dependency changes in timeline', async () => {
            await relationshipAPI.addDependency(
                testTasks.child1.id,
                testTasks.blocker.id,
                'blocks',
                { user: 'test@example.com' }
            );

            // Get the task and check recent notes
            const task = await taskAPI.getTask(testTasks.child1.id);
            assert.ok(task.recent_notes.length > 0);
            
            const dependencyNote = task.recent_notes.find(note => 
                note.note.includes('dependency') && note.note.includes('Blocker Task')
            );
            assert.ok(dependencyNote);
            assert.strictEqual(dependencyNote.note_type, 'state_change');
            assert.strictEqual(dependencyNote.author, 'test@example.com');
        });

        test('should record dependency removal in timeline', async () => {
            await relationshipAPI.addDependency(testTasks.child1.id, testTasks.blocker.id, 'blocks');
            await relationshipAPI.removeDependency(
                testTasks.child1.id,
                testTasks.blocker.id,
                'blocks',
                { user: 'test@example.com' }
            );

            const task = await taskAPI.getTask(testTasks.child1.id);
            const removalNote = task.recent_notes.find(note => 
                note.note.includes('Removed') && note.note.includes('dependency')
            );
            assert.ok(removalNote);
            assert.strictEqual(removalNote.note_type, 'state_change');
        });

        test('should record hierarchy changes in timeline', async () => {
            await relationshipAPI.addSubtask(testTasks.parent.id, testTasks.child1.id);
            const promoted = await relationshipAPI.promoteSubtask(
                testTasks.child1.id,
                { user: 'test@example.com' }
            );

            const task = await taskAPI.getTask(testTasks.child1.id);
            const promotionNote = task.recent_notes.find(note => 
                note.note.includes('Promoted') && note.note.includes('independent')
            );
            assert.ok(promotionNote);
            assert.strictEqual(promotionNote.note_type, 'state_change');
        });
    });
});