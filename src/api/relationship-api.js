/**
 * TaskWerk v3 Task Relationship API
 * 
 * Provides relationship management for tasks including dependencies,
 * subtasks, and hierarchy operations with validation and integrity checking.
 */

import { BaseAPI, APIError, ValidationError } from './base-api.js';
import { validateTaskId } from './validation.js';

/**
 * Task Relationship API class
 */
export class RelationshipAPI extends BaseAPI {
    constructor(dbPath = null) {
        super(dbPath);
    }

    /**
     * Add a dependency between tasks
     */
    async addDependency(taskId, dependsOnId, dependencyType = 'blocks', context = {}) {
        const db = await this.getDatabase();
        
        return await this.transaction((db) => {
            // Validate both tasks exist
            const task = this.getTaskInfo(db, taskId);
            const dependsOnTask = this.getTaskInfo(db, dependsOnId);
            
            if (!task) {
                throw new APIError(`Task with ID ${taskId} not found`, 'TASK_NOT_FOUND');
            }
            if (!dependsOnTask) {
                throw new APIError(`Dependency target task with ID ${dependsOnId} not found`, 'TASK_NOT_FOUND');
            }

            // Validate dependency type
            const validTypes = ['blocks', 'requires'];
            if (!validTypes.includes(dependencyType)) {
                throw new ValidationError('Invalid dependency type', [
                    `Type must be one of: ${validTypes.join(', ')}`
                ]);
            }

            // Check for cycles
            this.validateNoCycles(db, taskId, dependsOnId, dependencyType);

            // Check if dependency already exists
            const existing = db.prepare(`
                SELECT id FROM task_dependencies 
                WHERE task_id = ? AND depends_on_id = ? AND dependency_type = ?
            `).get(taskId, dependsOnId, dependencyType);

            if (existing) {
                throw new ValidationError('Dependency already exists', [
                    `Task ${task.string_id || taskId} already has ${dependencyType} dependency on ${dependsOnTask.string_id || dependsOnId}`
                ]);
            }

            // Insert dependency
            const insertStmt = db.prepare(`
                INSERT INTO task_dependencies (task_id, depends_on_id, dependency_type, created_at)
                VALUES (?, ?, ?, ?)
            `);
            
            const result = insertStmt.run(taskId, dependsOnId, dependencyType, this.now());

            // Add timeline note
            const note = `Added ${dependencyType} dependency on ${dependsOnTask.name} (${dependsOnTask.string_id || dependsOnId})`;
            this.addTimelineNote(db, taskId, note, 'state_change', context.user);

            // Return dependency info
            return {
                id: result.lastInsertRowid,
                task_id: taskId,
                depends_on_id: dependsOnId,
                dependency_type: dependencyType,
                task_name: task.name,
                depends_on_name: dependsOnTask.name,
                created_at: this.now()
            };
        });
    }

    /**
     * Remove a dependency between tasks
     */
    async removeDependency(taskId, dependsOnId, dependencyType = null, context = {}) {
        const db = await this.getDatabase();
        
        return await this.transaction((db) => {
            // Build query based on whether type is specified
            let query = 'SELECT * FROM task_dependencies WHERE task_id = ? AND depends_on_id = ?';
            const params = [taskId, dependsOnId];
            
            if (dependencyType) {
                query += ' AND dependency_type = ?';
                params.push(dependencyType);
            }

            const dependency = db.prepare(query).get(...params);
            
            if (!dependency) {
                throw new APIError('Dependency not found', 'DEPENDENCY_NOT_FOUND');
            }

            // Get task info for timeline
            const task = this.getTaskInfo(db, taskId);
            const dependsOnTask = this.getTaskInfo(db, dependsOnId);

            // Delete dependency
            const deleteStmt = db.prepare(`
                DELETE FROM task_dependencies 
                WHERE task_id = ? AND depends_on_id = ? ${dependencyType ? 'AND dependency_type = ?' : ''}
            `);
            
            const result = deleteStmt.run(...params);

            if (result.changes === 0) {
                throw new APIError('Dependency not found', 'DEPENDENCY_NOT_FOUND');
            }

            // Add timeline note
            const note = `Removed ${dependency.dependency_type} dependency on ${dependsOnTask?.name || dependsOnId}`;
            this.addTimelineNote(db, taskId, note, 'state_change', context.user);

            return {
                success: true,
                removedDependency: dependency,
                removedAt: this.now()
            };
        });
    }

    /**
     * Get all dependencies for a task
     */
    async getDependencies(taskId, includeReverse = false) {
        const db = await this.getDatabase();
        
        // Validate that task exists
        const task = this.getTaskInfo(db, taskId);
        if (!task) {
            throw new APIError(`Task with ID ${taskId} not found`, 'TASK_NOT_FOUND');
        }
        
        const dependencies = {
            task_id: taskId,
            depends_on: [],
            dependents: []
        };

        // Get what this task depends on
        const dependsOnStmt = db.prepare(`
            SELECT td.*, t.name as depends_on_name, t.status as depends_on_status
            FROM task_dependencies td
            JOIN tasks t ON td.depends_on_id = t.id
            WHERE td.task_id = ?
            ORDER BY td.dependency_type, td.created_at
        `);
        dependencies.depends_on = dependsOnStmt.all(taskId);

        if (includeReverse) {
            // Get what depends on this task
            const dependentsStmt = db.prepare(`
                SELECT td.*, t.name as dependent_name, t.status as dependent_status
                FROM task_dependencies td
                JOIN tasks t ON td.task_id = t.id
                WHERE td.depends_on_id = ?
                ORDER BY td.dependency_type, td.created_at
            `);
            dependencies.dependents = dependentsStmt.all(taskId);
        }

        return dependencies;
    }

    /**
     * Add a subtask relationship (using requires dependency type)
     */
    async addSubtask(parentId, childId, context = {}) {
        return await this.addDependency(childId, parentId, 'requires', context);
    }

    /**
     * Remove a subtask relationship
     */
    async removeSubtask(parentId, childId, context = {}) {
        return await this.removeDependency(childId, parentId, 'requires', context);
    }

    /**
     * Promote a subtask to independent task
     */
    async promoteSubtask(taskId, context = {}) {
        const db = await this.getDatabase();
        
        return await this.transaction((db) => {
            // Find subtask relationship
            const subtaskRel = db.prepare(`
                SELECT * FROM task_dependencies 
                WHERE task_id = ? AND dependency_type = 'requires'
            `).get(taskId);

            if (!subtaskRel) {
                throw new APIError('Task is not a subtask', 'NOT_A_SUBTASK');
            }

            // Remove the subtask relationship
            const deleteStmt = db.prepare(`
                DELETE FROM task_dependencies 
                WHERE task_id = ? AND dependency_type = 'requires'
            `);
            deleteStmt.run(taskId);

            // Get task info
            const task = this.getTaskInfo(db, taskId);
            const parentTask = this.getTaskInfo(db, subtaskRel.depends_on_id);

            // Add timeline note
            const note = `Promoted from subtask of ${parentTask?.name || subtaskRel.depends_on_id} to independent task`;
            this.addTimelineNote(db, taskId, note, 'state_change', context.user);

            return {
                success: true,
                promotedTask: task,
                formerParent: parentTask,
                promotedAt: this.now()
            };
        });
    }

    /**
     * Demote a task to subtask of another
     */
    async demoteTask(taskId, newParentId, context = {}) {
        return await this.addSubtask(newParentId, taskId, context);
    }

    /**
     * Move a subtask to a different parent
     */
    async moveSubtask(taskId, newParentId, context = {}) {
        const db = await this.getDatabase();
        
        return await this.transaction((db) => {
            // Verify task is currently a subtask
            const currentRel = db.prepare(`
                SELECT * FROM task_dependencies 
                WHERE task_id = ? AND dependency_type = 'requires'
            `).get(taskId);

            if (!currentRel) {
                throw new APIError('Task is not a subtask', 'NOT_A_SUBTASK');
            }

            // Get task info
            const task = this.getTaskInfo(db, taskId);
            const oldParent = this.getTaskInfo(db, currentRel.depends_on_id);
            const newParent = this.getTaskInfo(db, newParentId);

            if (!newParent) {
                throw new APIError(`New parent task with ID ${newParentId} not found`, 'TASK_NOT_FOUND');
            }

            // Check for cycles in new hierarchy
            this.validateNoCycles(db, taskId, newParentId, 'requires');

            // Update the relationship
            const updateStmt = db.prepare(`
                UPDATE task_dependencies 
                SET depends_on_id = ?, created_at = ?
                WHERE task_id = ? AND dependency_type = 'requires'
            `);
            updateStmt.run(newParentId, this.now(), taskId);

            // Add timeline note
            const note = `Moved from subtask of ${oldParent?.name || currentRel.depends_on_id} to ${newParent.name}`;
            this.addTimelineNote(db, taskId, note, 'state_change', context.user);

            return {
                success: true,
                movedTask: task,
                oldParent: oldParent,
                newParent: newParent,
                movedAt: this.now()
            };
        });
    }

    /**
     * Get task hierarchy (parent and children)
     */
    async getTaskHierarchy(taskId, depth = 3) {
        const db = await this.getDatabase();
        
        const hierarchy = {
            task: this.getTaskInfo(db, taskId),
            parent: null,
            children: [],
            ancestors: [],
            descendants: []
        };

        if (!hierarchy.task) {
            throw new APIError(`Task with ID ${taskId} not found`, 'TASK_NOT_FOUND');
        }

        // Get immediate parent
        const parentRel = db.prepare(`
            SELECT td.*, t.* FROM task_dependencies td
            JOIN tasks t ON td.depends_on_id = t.id
            WHERE td.task_id = ? AND td.dependency_type = 'requires'
        `).get(taskId);

        if (parentRel) {
            hierarchy.parent = {
                id: parentRel.depends_on_id,
                name: parentRel.name,
                status: parentRel.status,
                string_id: `TASK-${parentRel.depends_on_id.toString().padStart(3, '0')}`
            };
        }

        // Get immediate children
        const childrenStmt = db.prepare(`
            SELECT td.*, t.* FROM task_dependencies td
            JOIN tasks t ON td.task_id = t.id
            WHERE td.depends_on_id = ? AND td.dependency_type = 'requires'
            ORDER BY t.created_at
        `);
        const children = childrenStmt.all(taskId);

        hierarchy.children = children.map(child => ({
            id: child.task_id,
            name: child.name,
            status: child.status,
            progress: child.progress,
            string_id: `TASK-${child.task_id.toString().padStart(3, '0')}`
        }));

        // Get ancestors (recursive up)
        if (depth > 1 && hierarchy.parent) {
            hierarchy.ancestors = this.getAncestors(db, hierarchy.parent.id, depth - 1);
        }

        // Get descendants (recursive down)
        if (depth > 1 && hierarchy.children.length > 0) {
            hierarchy.descendants = this.getDescendants(db, taskId, depth - 1);
        }

        return hierarchy;
    }

    /**
     * Get dependency chain analysis
     */
    async analyzeDependencyChain(taskId) {
        const db = await this.getDatabase();
        
        const analysis = {
            task_id: taskId,
            blocking_chain: [],
            blocked_by_chain: [],
            critical_path: [],
            cycle_risks: []
        };

        // Analyze what this task blocks (downstream impact)
        analysis.blocking_chain = this.getBlockingChain(db, taskId, new Set(), []);
        
        // Analyze what blocks this task (upstream dependencies)
        analysis.blocked_by_chain = this.getBlockedByChain(db, taskId, new Set(), []);

        // Calculate critical path
        analysis.critical_path = this.calculateCriticalPath(db, taskId);

        // Check for cycle risks
        analysis.cycle_risks = this.findPotentialCycles(db, taskId);

        return analysis;
    }

    // Helper methods

    /**
     * Get basic task info
     */
    getTaskInfo(db, taskId) {
        const stmt = db.prepare('SELECT id, name, status, progress, created_at FROM tasks WHERE id = ?');
        const task = stmt.get(taskId);
        if (task) {
            task.string_id = `TASK-${task.id.toString().padStart(3, '0')}`;
        }
        return task;
    }

    /**
     * Validate no circular dependencies
     */
    validateNoCycles(db, taskId, dependsOnId, dependencyType) {
        // Self-dependency check
        if (taskId === dependsOnId) {
            throw new ValidationError('Task cannot depend on itself', ['SELF_DEPENDENCY']);
        }

        // For subtask relationships (requires), check hierarchy cycles
        if (dependencyType === 'requires') {
            if (this.wouldCreateHierarchyCycle(db, taskId, dependsOnId)) {
                throw new ValidationError('Cannot create circular hierarchy', ['HIERARCHY_CYCLE']);
            }
        }

        // For blocking relationships, check dependency cycles
        if (dependencyType === 'blocks') {
            if (this.wouldCreateDependencyCycle(db, taskId, dependsOnId)) {
                throw new ValidationError('Cannot create circular dependency', ['DEPENDENCY_CYCLE']);
            }
        }
    }

    /**
     * Check if adding dependency would create hierarchy cycle
     */
    wouldCreateHierarchyCycle(db, childId, parentId, visited = new Set()) {
        if (visited.has(parentId)) {
            return true; // Cycle detected
        }

        visited.add(parentId);

        // Check if parentId is already a descendant of childId
        const children = db.prepare(`
            SELECT task_id FROM task_dependencies 
            WHERE depends_on_id = ? AND dependency_type = 'requires'
        `).all(childId);

        for (const child of children) {
            if (child.task_id === parentId) {
                return true; // Direct cycle
            }
            if (this.wouldCreateHierarchyCycle(db, child.task_id, parentId, new Set(visited))) {
                return true; // Indirect cycle
            }
        }

        return false;
    }

    /**
     * Check if adding dependency would create dependency cycle
     */
    wouldCreateDependencyCycle(db, taskId, dependsOnId, visited = new Set()) {
        if (visited.has(dependsOnId)) {
            return false; // Already checked this path
        }

        // Check if dependsOnId already has a path back to taskId
        return this.hasPathBetween(db, dependsOnId, taskId, new Set());
    }

    /**
     * Check if there's a dependency path from startId to endId
     */
    hasPathBetween(db, startId, endId, visited = new Set()) {
        if (visited.has(startId)) {
            return false;
        }

        visited.add(startId);

        // Get what startId depends on
        const dependencies = db.prepare(`
            SELECT depends_on_id FROM task_dependencies 
            WHERE task_id = ? AND dependency_type = 'blocks'
        `).all(startId);

        for (const dep of dependencies) {
            if (dep.depends_on_id === endId) {
                return true; // Direct path found
            }
            if (this.hasPathBetween(db, dep.depends_on_id, endId, new Set(visited))) {
                return true; // Indirect path found
            }
        }

        return false;
    }

    /**
     * Get ancestors up the hierarchy
     */
    getAncestors(db, taskId, maxDepth, visited = new Set()) {
        if (maxDepth <= 0 || visited.has(taskId)) {
            return [];
        }

        visited.add(taskId);
        const ancestors = [];

        const parentStmt = db.prepare(`
            SELECT td.depends_on_id, t.name, t.status 
            FROM task_dependencies td
            JOIN tasks t ON td.depends_on_id = t.id
            WHERE td.task_id = ? AND td.dependency_type = 'requires'
        `);
        
        const parent = parentStmt.get(taskId);
        if (parent) {
            ancestors.push({
                id: parent.depends_on_id,
                name: parent.name,
                status: parent.status,
                string_id: `TASK-${parent.depends_on_id.toString().padStart(3, '0')}`
            });

            // Recursively get higher ancestors
            const higherAncestors = this.getAncestors(db, parent.depends_on_id, maxDepth - 1, visited);
            ancestors.push(...higherAncestors);
        }

        return ancestors;
    }

    /**
     * Get descendants down the hierarchy
     */
    getDescendants(db, taskId, maxDepth, visited = new Set()) {
        if (maxDepth <= 0 || visited.has(taskId)) {
            return [];
        }

        visited.add(taskId);
        const descendants = [];

        const childrenStmt = db.prepare(`
            SELECT td.task_id, t.name, t.status, t.progress
            FROM task_dependencies td
            JOIN tasks t ON td.task_id = t.id
            WHERE td.depends_on_id = ? AND td.dependency_type = 'requires'
        `);
        
        const children = childrenStmt.all(taskId);
        for (const child of children) {
            descendants.push({
                id: child.task_id,
                name: child.name,
                status: child.status,
                progress: child.progress,
                string_id: `TASK-${child.task_id.toString().padStart(3, '0')}`
            });

            // Recursively get lower descendants
            const lowerDescendants = this.getDescendants(db, child.task_id, maxDepth - 1, visited);
            descendants.push(...lowerDescendants);
        }

        return descendants;
    }

    /**
     * Get chain of tasks this task blocks
     */
    getBlockingChain(db, taskId, visited = new Set(), chain = []) {
        if (visited.has(taskId)) {
            return chain;
        }

        visited.add(taskId);

        const blockedTasks = db.prepare(`
            SELECT td.task_id, t.name, t.status
            FROM task_dependencies td
            JOIN tasks t ON td.task_id = t.id
            WHERE td.depends_on_id = ? AND td.dependency_type = 'blocks'
        `).all(taskId);

        for (const blocked of blockedTasks) {
            const taskInfo = {
                id: blocked.task_id,
                name: blocked.name,
                status: blocked.status,
                string_id: `TASK-${blocked.task_id.toString().padStart(3, '0')}`
            };
            
            chain.push(taskInfo);
            this.getBlockingChain(db, blocked.task_id, visited, chain);
        }

        return chain;
    }

    /**
     * Get chain of tasks blocking this task
     */
    getBlockedByChain(db, taskId, visited = new Set(), chain = []) {
        if (visited.has(taskId)) {
            return chain;
        }

        visited.add(taskId);

        const blockingTasks = db.prepare(`
            SELECT td.depends_on_id, t.name, t.status
            FROM task_dependencies td
            JOIN tasks t ON td.depends_on_id = t.id
            WHERE td.task_id = ? AND td.dependency_type = 'blocks'
        `).all(taskId);

        for (const blocking of blockingTasks) {
            const taskInfo = {
                id: blocking.depends_on_id,
                name: blocking.name,
                status: blocking.status,
                string_id: `TASK-${blocking.depends_on_id.toString().padStart(3, '0')}`
            };
            
            chain.push(taskInfo);
            this.getBlockedByChain(db, blocking.depends_on_id, visited, chain);
        }

        return chain;
    }

    /**
     * Calculate critical path from task
     */
    calculateCriticalPath(db, taskId) {
        // Simplified critical path calculation
        // In a real implementation, this would use proper critical path method (CPM)
        const path = [];
        const visited = new Set();
        
        this.findLongestPath(db, taskId, visited, [], path);
        
        return path;
    }

    /**
     * Find longest dependency path (simplified CPM)
     */
    findLongestPath(db, taskId, visited, currentPath, longestPath) {
        if (visited.has(taskId)) {
            return;
        }

        visited.add(taskId);
        const task = this.getTaskInfo(db, taskId);
        currentPath.push(task);

        const dependencies = db.prepare(`
            SELECT depends_on_id FROM task_dependencies 
            WHERE task_id = ? AND dependency_type = 'blocks'
        `).all(taskId);

        if (dependencies.length === 0) {
            // End of path, check if this is longest
            if (currentPath.length > longestPath.length) {
                longestPath.splice(0, longestPath.length, ...currentPath);
            }
        } else {
            for (const dep of dependencies) {
                this.findLongestPath(db, dep.depends_on_id, new Set(visited), [...currentPath], longestPath);
            }
        }
    }

    /**
     * Find potential cycles
     */
    findPotentialCycles(db, taskId) {
        const risks = [];
        
        // Check for tasks that could create cycles if dependencies were added
        const relatedTasks = db.prepare(`
            SELECT DISTINCT t.id, t.name 
            FROM tasks t
            JOIN task_dependencies td ON (t.id = td.task_id OR t.id = td.depends_on_id)
            WHERE (td.task_id = ? OR td.depends_on_id = ?) AND t.id != ?
        `).all(taskId, taskId, taskId);

        for (const task of relatedTasks) {
            if (this.wouldCreateDependencyCycle(db, taskId, task.id)) {
                risks.push({
                    task_id: task.id,
                    task_name: task.name,
                    risk_type: 'POTENTIAL_CYCLE',
                    description: `Adding dependency to ${task.name} would create a cycle`
                });
            }
        }

        return risks;
    }

    /**
     * Add timeline note (reuse from BaseAPI)
     */
    addTimelineNote(db, taskId, note, type = 'system', author = null) {
        const noteStmt = db.prepare(`
            INSERT INTO task_notes (task_id, note, note_type, author, created_at)
            VALUES (?, ?, ?, ?, ?)
        `);
        
        noteStmt.run(taskId, note, type, author, this.now());
    }
}

export default RelationshipAPI;