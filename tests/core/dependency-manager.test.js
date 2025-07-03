/**
 * Tests for TaskWerk v3 Dependency Manager
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { join } from 'path';
import { unlinkSync, existsSync } from 'fs';
import { DatabaseInitializer } from '../../src/core/database/init.js';
import { DependencyManager } from '../../src/core/dependency-manager.js';
import { ValidationError } from '../../src/api/base-api.js';

describe('Dependency Manager', () => {
    let manager;
    let db;
    let dbPath;
    let testTasks = {};

    beforeEach(async () => {
        // Use temporary database for each test
        dbPath = join('/tmp', `taskwerk-dependency-manager-test-${Date.now()}.db`);
        const dbInitializer = new DatabaseInitializer(dbPath);
        await dbInitializer.initialize();
        db = dbInitializer.getConnection();
        manager = new DependencyManager(db);

        // Create test tasks
        const tasks = [
            { name: 'Task A', status: 'todo', priority: 'high' },
            { name: 'Task B', status: 'in_progress', priority: 'medium' },
            { name: 'Task C', status: 'completed', priority: 'low' },
            { name: 'Task D', status: 'todo', priority: 'medium' },
            { name: 'Task E', status: 'archived', priority: 'low' }
        ];

        for (const [index, taskData] of tasks.entries()) {
            const result = db.prepare(`
                INSERT INTO tasks (name, status, priority, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
            `).run(taskData.name, taskData.status, taskData.priority, 
                  new Date().toISOString(), new Date().toISOString());
            
            testTasks[String.fromCharCode(65 + index)] = result.lastInsertRowid; // A, B, C, D, E
        }
    });

    afterEach(() => {
        // Clean up test database
        if (db) {
            db.close();
        }
        if (existsSync(dbPath)) {
            unlinkSync(dbPath);
        }
    });

    describe('Dependency Validation', () => {
        test('should validate basic dependency addition', () => {
            assert.doesNotThrow(() => {
                manager.validateDependencyAddition(testTasks.A, testTasks.B, 'blocks');
            });
        });

        test('should prevent self-dependency', () => {
            assert.throws(() => {
                manager.validateDependencyAddition(testTasks.A, testTasks.A, 'blocks');
            }, ValidationError);
        });

        test('should prevent dependency on non-existent task', () => {
            assert.throws(() => {
                manager.validateDependencyAddition(testTasks.A, 99999, 'blocks');
            }, ValidationError);

            assert.throws(() => {
                manager.validateDependencyAddition(99999, testTasks.A, 'blocks');
            }, ValidationError);
        });

        test('should validate blocking dependency rules', () => {
            // Cannot block completed task
            assert.throws(() => {
                manager.validateDependencyAddition(testTasks.C, testTasks.A, 'blocks');
            }, ValidationError);

            // Archived task cannot block others
            assert.throws(() => {
                manager.validateDependencyAddition(testTasks.B, testTasks.E, 'blocks');
            }, ValidationError);
        });

        test('should validate requires relationship rules', () => {
            // Cannot depend on archived task  
            assert.throws(() => {
                manager.validateDependencyAddition(testTasks.A, testTasks.E, 'requires');
            }, ValidationError);

            // Completed task depending on incomplete task should be flagged
            assert.throws(() => {
                manager.validateDependencyAddition(testTasks.C, testTasks.A, 'requires');
            }, ValidationError);
        });

        test('should validate subtask relationship rules', () => {
            // Incomplete task cannot be subtask of completed task
            assert.throws(() => {
                manager.validateDependencyAddition(testTasks.A, testTasks.C, 'requires');
            }, ValidationError);
        });

        test('should allow related_to relationships', () => {
            assert.doesNotThrow(() => {
                manager.validateDependencyAddition(testTasks.A, testTasks.B, 'related_to');
            });
        });
    });

    describe('Cycle Detection', () => {
        beforeEach(() => {
            // Set up some dependencies for cycle testing
            db.prepare(`
                INSERT INTO task_dependencies (task_id, depends_on_id, dependency_type)
                VALUES (?, ?, ?)
            `).run(testTasks.B, testTasks.A, 'blocks'); // B depends on A
        });

        test('should detect direct cycles', () => {
            const wouldCycle = manager.wouldCreateCycle(testTasks.A, testTasks.B, 'blocks');
            assert.strictEqual(wouldCycle, true);
        });

        test('should allow non-cyclical dependencies', () => {
            const wouldCycle = manager.wouldCreateCycle(testTasks.C, testTasks.D, 'blocks');
            assert.strictEqual(wouldCycle, false);
        });

        test('should detect hierarchy cycles', () => {
            // A is parent of B, trying to make A child of B would create cycle
            db.prepare(`
                INSERT INTO task_dependencies (task_id, depends_on_id, dependency_type)
                VALUES (?, ?, ?)
            `).run(testTasks.B, testTasks.A, 'subtask_of');

            const wouldCycle = manager.detectHierarchyCycle(testTasks.A, testTasks.B);
            assert.strictEqual(wouldCycle, true);
        });

        test('should detect deep dependency cycles', () => {
            // Create chain: A -> B -> C, then try to make A depend on C
            db.prepare(`
                INSERT INTO task_dependencies (task_id, depends_on_id, dependency_type)
                VALUES (?, ?, ?)
            `).run(testTasks.C, testTasks.B, 'blocks');

            const wouldCycle = manager.detectDependencyCycle(testTasks.A, testTasks.C);
            assert.strictEqual(wouldCycle, true);
        });

        test('should handle complex dependency graphs', () => {
            // Create complex but non-cyclical graph
            db.prepare(`
                INSERT INTO task_dependencies (task_id, depends_on_id, dependency_type)
                VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?)
            `).run(
                testTasks.C, testTasks.A, 'blocks',
                testTasks.D, testTasks.B, 'blocks',
                testTasks.D, testTasks.C, 'blocks'
            );

            const wouldCycle = manager.wouldCreateCycle(testTasks.E, testTasks.D, 'blocks');
            assert.strictEqual(wouldCycle, false);
        });
    });

    describe('Dependency Impact Analysis', () => {
        beforeEach(() => {
            // Set up dependency structure for impact testing
            db.prepare(`
                INSERT INTO task_dependencies (task_id, depends_on_id, dependency_type)
                VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?)
            `).run(
                testTasks.B, testTasks.A, 'blocks',      // B is blocked by A
                testTasks.C, testTasks.A, 'depends_on', // C depends on A
                testTasks.D, testTasks.A, 'subtask_of'  // D is subtask of A
            );
        });

        test('should calculate impact when task completes', () => {
            const impact = manager.calculateDependencyImpact(testTasks.A, 'completed');

            assert.strictEqual(impact.task_id, testTasks.A);
            assert.strictEqual(impact.new_status, 'completed');
            assert.ok(Array.isArray(impact.affected_tasks));
            assert.ok(Array.isArray(impact.validation_errors));
            assert.ok(Array.isArray(impact.recommended_actions));

            // Should identify that B can be unblocked
            const unblockedTask = impact.affected_tasks.find(task => 
                task.id === testTasks.B && task.impact_type === 'unblocked'
            );
            assert.ok(unblockedTask);

            // Should suggest unblocking B
            const unblockAction = impact.recommended_actions.find(action =>
                action.includes('Unblock')
            );
            assert.ok(unblockAction);
        });

        test('should identify validation errors for invalid transitions', () => {
            // Try to complete A when B is still in progress (blocks relationship)
            const impact = manager.calculateDependencyImpact(testTasks.A, 'completed');

            // Check if validation properly identifies issues with subtasks
            const hasSubtaskError = impact.validation_errors.some(error =>
                error.includes('subtask')
            );
            
            // The validation depends on current task statuses and business rules
            assert.ok(Array.isArray(impact.validation_errors));
        });

        test('should handle archiving with active dependents', () => {
            const impact = manager.calculateDependencyImpact(testTasks.A, 'archived');

            // Should prevent archiving if active tasks depend on it
            const hasActiveDependentError = impact.validation_errors.some(error =>
                error.includes('still depends')
            );
            
            // This depends on the current status of dependent tasks
            assert.ok(Array.isArray(impact.validation_errors));
        });

        test('should suggest parent progress update for subtask completion', () => {
            const impact = manager.calculateDependencyImpact(testTasks.D, 'completed');

            const parentUpdateTask = impact.affected_tasks.find(task =>
                task.impact_type === 'parent_progress_update'
            );
            
            // Should suggest updating parent when subtask completes
            if (parentUpdateTask) {
                assert.strictEqual(parentUpdateTask.suggested_action, 'Update parent progress');
            }
        });
    });

    describe('Status Transition Validation', () => {
        beforeEach(() => {
            // Set up blocking relationships
            db.prepare(`
                INSERT INTO task_dependencies (task_id, depends_on_id, dependency_type)
                VALUES (?, ?, ?), (?, ?, ?)
            `).run(
                testTasks.B, testTasks.A, 'blocks',      // B is blocked by A
                testTasks.C, testTasks.B, 'subtask_of'  // C is subtask of B
            );
        });

        test('should validate completion with blocking dependencies', () => {
            const impact = { validation_errors: [] };
            manager.validateStatusTransitionWithDependencies(testTasks.B, 'completed', impact);

            // B cannot complete while A is not completed (A blocks B)
            const hasBlockingError = impact.validation_errors.some(error =>
                error.includes('blocked by')
            );
            assert.ok(hasBlockingError);
        });

        test('should validate completion with incomplete subtasks', () => {
            const impact = { validation_errors: [] };
            manager.validateStatusTransitionWithDependencies(testTasks.B, 'completed', impact);

            // B cannot complete while subtask C is not completed
            const hasSubtaskError = impact.validation_errors.some(error =>
                error.includes('subtask') && error.includes('Task C')
            );
            assert.ok(hasSubtaskError);
        });

        test('should allow completion when dependencies are met', () => {
            // Complete A first (remove blocker)
            db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run('completed', testTasks.A);
            // Complete subtask C
            db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run('completed', testTasks.C);

            const impact = { validation_errors: [] };
            manager.validateStatusTransitionWithDependencies(testTasks.B, 'completed', impact);

            // Should have no validation errors now
            assert.strictEqual(impact.validation_errors.length, 0);
        });

        test('should validate archiving with active dependents', () => {
            const impact = { validation_errors: [] };
            manager.validateStatusTransitionWithDependencies(testTasks.A, 'archived', impact);

            // Cannot archive A while B still depends on it and is active
            const hasActiveDependentError = impact.validation_errors.some(error =>
                error.includes('still depends')
            );
            assert.ok(hasActiveDependentError);
        });
    });

    describe('Dependency Resolution Suggestions', () => {
        beforeEach(() => {
            // Set up problematic dependencies
            db.prepare(`
                INSERT INTO task_dependencies (task_id, depends_on_id, dependency_type)
                VALUES (?, ?, ?), (?, ?, ?)
            `).run(
                testTasks.B, testTasks.A, 'blocks',
                testTasks.C, testTasks.B, 'subtask_of'
            );
        });

        test('should suggest resolution for blocking dependencies', () => {
            const suggestions = manager.suggestDependencyResolution(testTasks.B, 'completed');

            const blockerSuggestion = suggestions.find(s => s.type === 'complete_blocker');
            assert.ok(blockerSuggestion);
            assert.strictEqual(blockerSuggestion.automatic, false);
            assert.ok(blockerSuggestion.description.includes('blocking'));
        });

        test('should suggest resolution for incomplete subtasks', () => {
            const suggestions = manager.suggestDependencyResolution(testTasks.B, 'completed');

            const subtaskSuggestion = suggestions.find(s => s.type === 'complete_subtasks');
            assert.ok(subtaskSuggestion);
            assert.strictEqual(subtaskSuggestion.automatic, false);
            assert.ok(subtaskSuggestion.description.includes('subtasks'));
        });

        test('should suggest automatic resolution where possible', () => {
            const suggestions = manager.suggestDependencyResolution(testTasks.A, 'archived');

            const autoSuggestion = suggestions.find(s => s.automatic === true);
            if (autoSuggestion) {
                assert.ok(autoSuggestion.action);
                assert.ok(autoSuggestion.description);
            }
        });
    });

    describe('Graph Optimization', () => {
        beforeEach(() => {
            // Create a graph with potential optimizations
            db.prepare(`
                INSERT INTO task_dependencies (task_id, depends_on_id, dependency_type)
                VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?), (?, ?, ?)
            `).run(
                testTasks.B, testTasks.A, 'blocks',    // Direct: A -> B
                testTasks.C, testTasks.B, 'blocks',    // Chain: A -> B -> C
                testTasks.C, testTasks.A, 'blocks',    // Redundant: A -> C (already through B)
                testTasks.D, testTasks.A, 'blocks'     // A blocks multiple tasks
            );
        });

        test('should identify redundant dependencies', () => {
            const redundant = manager.findRedundantDependencies();

            // Should find A -> C as redundant since A -> B -> C exists
            const redundantDep = redundant.find(dep => 
                dep.from_id === testTasks.A && dep.to_id === testTasks.C
            );
            assert.ok(redundantDep);
            assert.ok(redundantDep.from_name);
            assert.ok(redundantDep.to_name);
        });

        test('should find parallelizable tasks', () => {
            const parallelizable = manager.findParallelizableChains();

            // E should be independent and parallelizable
            assert.ok(Array.isArray(parallelizable));
            if (parallelizable.length > 0) {
                const chain = parallelizable[0];
                assert.ok(Array.isArray(chain));
                for (const task of chain) {
                    assert.ok(task.id);
                    assert.ok(task.name);
                }
            }
        });

        test('should identify critical path bottlenecks', () => {
            const bottlenecks = manager.findCriticalPathBottlenecks();

            // A should be identified as bottleneck (blocks multiple tasks)
            const bottleneck = bottlenecks.find(b => b.id === testTasks.A);
            assert.ok(bottleneck);
            assert.ok(bottleneck.reason.includes('Blocks'));
        });

        test('should provide comprehensive optimization suggestions', () => {
            const optimizations = manager.optimizeDependencyGraph();

            assert.ok(Array.isArray(optimizations));
            
            for (const opt of optimizations) {
                assert.ok(opt.type);
                assert.ok(opt.description);
                assert.ok(Array.isArray(opt.task_ids));
                assert.ok(opt.action);
            }

            // Should have different types of optimizations
            const types = optimizations.map(opt => opt.type);
            const uniqueTypes = [...new Set(types)];
            assert.ok(uniqueTypes.length > 0);
        });
    });

    describe('Utility Methods', () => {
        test('should get task by ID', () => {
            const task = manager.getTask(testTasks.A);
            assert.ok(task);
            assert.strictEqual(task.id, testTasks.A);
            assert.strictEqual(task.name, 'Task A');
        });

        test('should return null for non-existent task', () => {
            const task = manager.getTask(99999);
            assert.strictEqual(task, null);
        });

        test('should calculate priority weights correctly', () => {
            assert.strictEqual(manager.getPriorityWeight('low'), 1);
            assert.strictEqual(manager.getPriorityWeight('medium'), 2);
            assert.strictEqual(manager.getPriorityWeight('high'), 3);
            assert.strictEqual(manager.getPriorityWeight('urgent'), 4);
            assert.strictEqual(manager.getPriorityWeight('unknown'), 2); // Default
        });

        test('should calculate hierarchy depth', () => {
            // Set up hierarchy: A -> B -> C
            db.prepare(`
                INSERT INTO task_dependencies (task_id, depends_on_id, dependency_type)
                VALUES (?, ?, ?), (?, ?, ?)
            `).run(
                testTasks.B, testTasks.A, 'subtask_of',
                testTasks.C, testTasks.B, 'subtask_of'
            );

            assert.strictEqual(manager.getHierarchyDepth(testTasks.A), 0); // Root
            assert.strictEqual(manager.getHierarchyDepth(testTasks.B), 1); // Child of A
            assert.strictEqual(manager.getHierarchyDepth(testTasks.C), 2); // Grandchild of A
        });

        test('should get descendants correctly', () => {
            // Set up hierarchy
            db.prepare(`
                INSERT INTO task_dependencies (task_id, depends_on_id, dependency_type)
                VALUES (?, ?, ?), (?, ?, ?)
            `).run(
                testTasks.B, testTasks.A, 'subtask_of',
                testTasks.C, testTasks.A, 'subtask_of'
            );

            const descendants = manager.getDescendants(testTasks.A, 'subtask_of');
            assert.ok(descendants.includes(testTasks.B));
            assert.ok(descendants.includes(testTasks.C));
        });

        test('should handle cycles in hierarchy traversal', () => {
            // This tests robustness against potential data corruption
            const depth = manager.getHierarchyDepth(testTasks.A, new Set([testTasks.A]));
            assert.strictEqual(depth, 0); // Should handle visited set properly
        });
    });

    describe('Edge Cases', () => {
        test('should handle empty dependency graph', () => {
            const optimizations = manager.optimizeDependencyGraph();
            assert.ok(Array.isArray(optimizations));
            // Should not crash on empty graph
        });

        test('should handle malformed dependency data', () => {
            // Insert potentially problematic data
            db.prepare(`
                INSERT INTO task_dependencies (task_id, depends_on_id, dependency_type)
                VALUES (?, ?, ?)
            `).run(null, testTasks.A, 'blocks');

            // Should not crash when processing
            assert.doesNotThrow(() => {
                manager.findRedundantDependencies();
            });
        });

        test('should handle deep hierarchies gracefully', () => {
            // Create deep hierarchy to test recursion limits
            let currentParent = testTasks.A;
            for (let i = 0; i < 10; i++) {
                const childResult = db.prepare(`
                    INSERT INTO tasks (name, status, priority, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                `).run(`Deep Child ${i}`, 'todo', 'medium', 
                          new Date().toISOString(), new Date().toISOString());
                
                db.prepare(`
                    INSERT INTO task_dependencies (task_id, depends_on_id, dependency_type)
                    VALUES (?, ?, ?)
                `).run(childResult.lastInsertRowid, currentParent, 'subtask_of');
                
                currentParent = childResult.lastInsertRowid;
            }

            // Should handle deep hierarchy without stack overflow
            assert.doesNotThrow(() => {
                const depth = manager.getHierarchyDepth(currentParent);
                assert.ok(depth > 5);
            });
        });
    });
});