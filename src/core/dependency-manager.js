/**
 * TaskWerk v3 Dependency Manager
 *
 * Core utility for managing task dependencies, hierarchy validation,
 * and complex relationship operations.
 */

import { ValidationError } from '../api/base-api.js';

/**
 * Dependency Manager class for advanced dependency operations
 */
export class DependencyManager {
  constructor(db) {
    this.db = db;
  }

  /**
   * Validate dependency addition with comprehensive checks
   */
  validateDependencyAddition(fromTaskId, toTaskId, dependencyType) {
    const errors = [];

    // Basic validation
    if (fromTaskId === toTaskId) {
      errors.push('Task cannot depend on itself');
    }

    // Check if both tasks exist
    const fromTask = this.getTask(fromTaskId);
    const toTask = this.getTask(toTaskId);

    if (!fromTask) {
      errors.push(`Source task ${fromTaskId} not found`);
    }
    if (!toTask) {
      errors.push(`Target task ${toTaskId} not found`);
    }

    if (errors.length > 0) {
      throw new ValidationError('Dependency validation failed', errors);
    }

    // Type-specific validation
    switch (dependencyType) {
      case 'blocks':
        this.validateBlockingDependency(fromTaskId, toTaskId, errors);
        break;
      case 'requires':
        this.validateRequiresRelationship(fromTaskId, toTaskId, errors);
        break;
    }

    // Cycle detection
    if (this.wouldCreateCycle(fromTaskId, toTaskId, dependencyType)) {
      errors.push('Adding this dependency would create a circular dependency');
    }

    if (errors.length > 0) {
      throw new ValidationError('Dependency validation failed', errors);
    }

    return true;
  }

  /**
   * Validate blocking dependency rules
   */
  validateBlockingDependency(blockerId, blockedId, errors) {
    const blocker = this.getTask(blockerId);
    const blocked = this.getTask(blockedId);

    // Business rule: Cannot block a completed task
    if (blocked.status === 'completed') {
      errors.push('Cannot add blocking dependency to completed task');
    }

    // Business rule: Archived tasks cannot block other tasks
    if (blocker.status === 'archived') {
      errors.push('Archived tasks cannot block other tasks');
    }

    // Business rule: Check priority relationships
    if (this.getPriorityWeight(blocker.priority) < this.getPriorityWeight(blocked.priority)) {
      errors.push('Lower priority tasks should not block higher priority tasks');
    }
  }

  /**
   * Validate requires relationship rules
   */
  validateRequiresRelationship(dependentId, dependencyId, errors) {
    const dependent = this.getTask(dependentId);
    const dependency = this.getTask(dependencyId);

    // Business rule: Cannot depend on archived task
    if (dependency.status === 'archived') {
      errors.push('Cannot depend on archived task');
    }

    // Business rule: Completed tasks should not depend on incomplete tasks
    if (dependent.status === 'completed' && dependency.status !== 'completed') {
      errors.push('Completed tasks cannot depend on incomplete tasks');
    }

    // Business rule: For subtask relationships, incomplete task cannot be subtask of completed task
    if (dependent.status !== 'completed' && dependency.status === 'completed') {
      errors.push('Incomplete task cannot be subtask of completed task');
    }
  }

  // Note: Subtask relationships are now handled using 'requires' type
  // No separate validation method needed since requires validation covers it

  /**
   * Comprehensive cycle detection
   */
  wouldCreateCycle(fromTaskId, toTaskId, dependencyType) {
    // Use different algorithms based on dependency type
    switch (dependencyType) {
      case 'requires':
        // For requires (including subtasks), check for cycles
        return this.detectDependencyCycle(fromTaskId, toTaskId);
      case 'blocks':
        return this.detectDependencyCycle(fromTaskId, toTaskId);
      default:
        return this.detectDependencyCycle(fromTaskId, toTaskId);
    }
  }

  /**
   * Detect hierarchy cycles for subtask relationships
   */
  detectHierarchyCycle(childId, proposedParentId, visited = new Set()) {
    if (visited.has(proposedParentId)) {
      return false; // Already visited this node
    }

    if (proposedParentId === childId) {
      return true; // Direct cycle
    }

    visited.add(proposedParentId);

    // Check if proposed parent is already a descendant of child
    const descendants = this.getDescendants(childId, 'requires');
    if (descendants.includes(proposedParentId)) {
      return true;
    }

    // Check ancestors of proposed parent
    const parentOfProposed = this.db
      .prepare(
        `
            SELECT depends_on_id FROM task_dependencies 
            WHERE task_id = ? AND dependency_type = 'requires'
        `
      )
      .get(proposedParentId);

    if (parentOfProposed) {
      return this.detectHierarchyCycle(childId, parentOfProposed.depends_on_id, visited);
    }

    return false;
  }

  /**
   * Detect dependency cycles using DFS
   */
  detectDependencyCycle(fromTaskId, toTaskId, visited = new Set(), path = new Set()) {
    if (path.has(toTaskId)) {
      return true; // Cycle detected
    }

    if (visited.has(toTaskId)) {
      return false; // Already explored this path
    }

    visited.add(toTaskId);
    path.add(toTaskId);

    // Get all tasks that toTaskId depends on
    const dependencies = this.db
      .prepare(
        `
            SELECT depends_on_id FROM task_dependencies 
            WHERE task_id = ? AND dependency_type IN ('blocks', 'requires')
        `
      )
      .all(toTaskId);

    for (const dep of dependencies) {
      if (dep.depends_on_id === fromTaskId) {
        return true; // Direct cycle back to start
      }

      if (this.detectDependencyCycle(fromTaskId, dep.depends_on_id, visited, new Set(path))) {
        return true; // Indirect cycle found
      }
    }

    path.delete(toTaskId);
    return false;
  }

  /**
   * Calculate dependency impact when task status changes
   */
  calculateDependencyImpact(taskId, newStatus) {
    const impact = {
      task_id: taskId,
      new_status: newStatus,
      affected_tasks: [],
      validation_errors: [],
      recommended_actions: [],
    };

    const task = this.getTask(taskId);
    const oldStatus = task.status;

    // Get all dependent tasks
    const dependents = this.db
      .prepare(
        `
            SELECT td.task_id, td.dependency_type, t.name, t.status, t.priority
            FROM task_dependencies td
            JOIN tasks t ON td.task_id = t.id
            WHERE td.depends_on_id = ?
        `
      )
      .all(taskId);

    for (const dependent of dependents) {
      const affectedTask = {
        id: dependent.task_id,
        name: dependent.name,
        current_status: dependent.status,
        dependency_type: dependent.dependency_type,
        impact_type: null,
        suggested_action: null,
      };

      // Analyze impact based on dependency type and status change
      switch (dependent.dependency_type) {
        case 'blocks':
          if (newStatus === 'completed' && dependent.status === 'blocked') {
            affectedTask.impact_type = 'unblocked';
            affectedTask.suggested_action = 'Task can now proceed';
            impact.recommended_actions.push(`Unblock ${dependent.name} (${dependent.task_id})`);
          } else if (newStatus === 'blocked' && dependent.status === 'in_progress') {
            affectedTask.impact_type = 'newly_blocked';
            affectedTask.suggested_action = 'Task should be paused';
            impact.validation_errors.push(`${dependent.name} should be paused due to blocker`);
          }
          break;

        case 'requires':
          if (oldStatus === 'completed' && newStatus !== 'completed') {
            affectedTask.impact_type = 'dependency_regressed';
            affectedTask.suggested_action = 'Review task status';
            impact.validation_errors.push(`${dependent.name} depends on task that was uncompleted`);
          }
          // For subtask relationships (also using 'requires'), handle parent progress
          if (newStatus === 'completed') {
            affectedTask.impact_type = 'parent_progress_update';
            affectedTask.suggested_action = 'Update parent progress';
            impact.recommended_actions.push(`Update progress on parent task`);
          }
          break;
      }

      if (affectedTask.impact_type) {
        impact.affected_tasks.push(affectedTask);
      }
    }

    // Check if task can transition to new status given dependencies
    this.validateStatusTransitionWithDependencies(taskId, newStatus, impact);

    return impact;
  }

  /**
   * Validate status transition considering dependencies
   */
  validateStatusTransitionWithDependencies(taskId, newStatus, impact) {
    if (newStatus === 'completed') {
      // Check if all blocking dependencies are completed
      const blockingDeps = this.db
        .prepare(
          `
                SELECT t.name, t.status 
                FROM task_dependencies td
                JOIN tasks t ON td.depends_on_id = t.id
                WHERE td.task_id = ? AND td.dependency_type = 'blocks' AND t.status != 'completed'
            `
        )
        .all(taskId);

      for (const dep of blockingDeps) {
        impact.validation_errors.push(`Cannot complete: blocked by "${dep.name}" (${dep.status})`);
      }

      // Check if all subtasks are completed (using 'requires' for subtask relationships)
      const incompleteSubtasks = this.db
        .prepare(
          `
                SELECT t.name, t.status 
                FROM task_dependencies td
                JOIN tasks t ON td.task_id = t.id
                WHERE td.depends_on_id = ? AND td.dependency_type = 'requires' AND t.status != 'completed'
            `
        )
        .all(taskId);

      for (const subtask of incompleteSubtasks) {
        impact.validation_errors.push(
          `Cannot complete: subtask "${subtask.name}" is ${subtask.status}`
        );
      }
    }

    if (newStatus === 'archived') {
      // Check if any active tasks depend on this one
      const activeDependents = this.db
        .prepare(
          `
                SELECT t.name, t.status, td.dependency_type
                FROM task_dependencies td
                JOIN tasks t ON td.task_id = t.id
                WHERE td.depends_on_id = ? AND t.status IN ('todo', 'in_progress', 'blocked')
            `
        )
        .all(taskId);

      for (const dependent of activeDependents) {
        impact.validation_errors.push(
          `Cannot archive: "${dependent.name}" still depends on this task`
        );
      }
    }
  }

  /**
   * Auto-resolve dependency conflicts
   */
  suggestDependencyResolution(taskId, targetStatus) {
    const suggestions = [];
    const impact = this.calculateDependencyImpact(taskId, targetStatus);

    for (const error of impact.validation_errors) {
      if (error.includes('blocked by')) {
        suggestions.push({
          type: 'complete_blocker',
          description: 'Complete or remove blocking dependencies',
          automatic: false,
        });
      }

      if (error.includes('subtask')) {
        suggestions.push({
          type: 'complete_subtasks',
          description: 'Complete remaining subtasks first',
          automatic: false,
        });
      }

      if (error.includes('still depends')) {
        suggestions.push({
          type: 'remove_dependencies',
          description: 'Remove or reassign dependent tasks',
          automatic: true,
          action: 'remove_dependents',
        });
      }
    }

    return suggestions;
  }

  /**
   * Optimize dependency graph
   */
  optimizeDependencyGraph(rootTaskId = null) {
    const optimizations = [];

    // Find redundant dependencies
    const redundantDeps = this.findRedundantDependencies();
    optimizations.push(
      ...redundantDeps.map(dep => ({
        type: 'remove_redundant',
        description: `Remove redundant dependency: ${dep.from_name} -> ${dep.to_name}`,
        task_ids: [dep.from_id, dep.to_id],
        action: 'remove_dependency',
      }))
    );

    // Find potential parallelization opportunities
    const parallelizable = this.findParallelizableChains(rootTaskId);
    optimizations.push(
      ...parallelizable.map(chain => ({
        type: 'parallelize',
        description: `Tasks can be done in parallel: ${chain.map(t => t.name).join(', ')}`,
        task_ids: chain.map(t => t.id),
        action: 'suggest_parallel',
      }))
    );

    // Find critical path bottlenecks
    const bottlenecks = this.findCriticalPathBottlenecks(rootTaskId);
    optimizations.push(
      ...bottlenecks.map(bottleneck => ({
        type: 'critical_path',
        description: `Critical path bottleneck: ${bottleneck.name}`,
        task_ids: [bottleneck.id],
        action: 'prioritize',
      }))
    );

    return optimizations;
  }

  // Utility methods

  /**
   * Get task by ID
   */
  getTask(taskId) {
    return this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) || null;
  }

  /**
   * Get priority weight for comparison
   */
  getPriorityWeight(priority) {
    const weights = { low: 1, medium: 2, high: 3, urgent: 4 };
    return weights[priority] || 2;
  }

  /**
   * Get hierarchy depth of a task
   */
  getHierarchyDepth(taskId, visited = new Set()) {
    if (visited.has(taskId)) {
      return 0; // Prevent infinite recursion
    }

    visited.add(taskId);

    const parent = this.db
      .prepare(
        `
            SELECT depends_on_id FROM task_dependencies 
            WHERE task_id = ? AND dependency_type = 'requires'
        `
      )
      .get(taskId);

    if (parent) {
      return 1 + this.getHierarchyDepth(parent.depends_on_id, visited);
    }

    return 0;
  }

  /**
   * Get all descendants of a task
   */
  getDescendants(taskId, dependencyType, visited = new Set()) {
    if (visited.has(taskId)) {
      return [];
    }

    visited.add(taskId);
    const descendants = [];

    const children = this.db
      .prepare(
        `
            SELECT task_id FROM task_dependencies 
            WHERE depends_on_id = ? AND dependency_type = ?
        `
      )
      .all(taskId, dependencyType);

    for (const child of children) {
      descendants.push(child.task_id);
      const childDescendants = this.getDescendants(child.task_id, dependencyType, visited);
      descendants.push(...childDescendants);
    }

    return descendants;
  }

  /**
   * Find redundant dependencies (transitive reduction)
   */
  findRedundantDependencies() {
    const redundant = [];

    // Get all direct dependencies
    const allDeps = this.db
      .prepare(
        `
            SELECT td1.task_id as from_id, td1.depends_on_id as to_id, 
                   t1.name as from_name, t2.name as to_name
            FROM task_dependencies td1
            JOIN tasks t1 ON td1.task_id = t1.id
            JOIN tasks t2 ON td1.depends_on_id = t2.id
            WHERE td1.dependency_type IN ('blocks', 'requires')
        `
      )
      .all();

    for (const dep of allDeps) {
      // Check if there's an indirect path from dep.from_id to dep.to_id
      // without using the direct edge
      if (this.hasIndirectPath(dep.from_id, dep.to_id)) {
        redundant.push(dep);
      }
    }

    return redundant;
  }

  /**
   * Check if indirect path exists
   */
  hasIndirectPath(fromId, toId) {
    // Use BFS to find if there's a path from fromId to toId
    // that doesn't use the direct edge
    const visited = new Set();
    const queue = [];

    // Get all nodes that fromId directly depends on (except toId)
    const directDeps = this.db
      .prepare(
        `
            SELECT depends_on_id FROM task_dependencies 
            WHERE task_id = ? AND dependency_type IN ('blocks', 'requires')
            AND depends_on_id != ?
        `
      )
      .all(fromId, toId);

    for (const dep of directDeps) {
      queue.push(dep.depends_on_id);
    }

    while (queue.length > 0) {
      const current = queue.shift();

      if (visited.has(current)) {
        continue;
      }

      visited.add(current);

      if (current === toId) {
        return true; // Found indirect path
      }

      // Get next level dependencies
      const nextDeps = this.db
        .prepare(
          `
                SELECT depends_on_id FROM task_dependencies 
                WHERE task_id = ? AND dependency_type IN ('blocks', 'requires')
            `
        )
        .all(current);

      for (const dep of nextDeps) {
        if (!visited.has(dep.depends_on_id)) {
          queue.push(dep.depends_on_id);
        }
      }
    }

    return false;
  }

  /**
   * Find parallelizable task chains
   */
  findParallelizableChains(rootTaskId) {
    // Simplified: find tasks with no dependencies that could run in parallel
    const parallelizable = [];

    const independentTasks = this.db
      .prepare(
        `
            SELECT t.id, t.name FROM tasks t
            LEFT JOIN task_dependencies td ON t.id = td.task_id
            WHERE td.task_id IS NULL AND t.status IN ('todo', 'in_progress')
            ${rootTaskId ? 'AND t.id != ?' : ''}
        `
      )
      .all(rootTaskId ? [rootTaskId] : []);

    if (independentTasks.length > 1) {
      parallelizable.push(independentTasks);
    }

    return parallelizable;
  }

  /**
   * Find critical path bottlenecks
   */
  findCriticalPathBottlenecks(_rootTaskId) {
    const bottlenecks = [];

    // Find tasks with many dependents
    const highDependencyTasks = this.db
      .prepare(
        `
            SELECT td.depends_on_id as id, t.name, COUNT(*) as dependent_count
            FROM task_dependencies td
            JOIN tasks t ON td.depends_on_id = t.id
            WHERE td.dependency_type IN ('blocks', 'requires')
            GROUP BY td.depends_on_id
            HAVING COUNT(*) > 2
            ORDER BY COUNT(*) DESC
        `
      )
      .all();

    for (const task of highDependencyTasks) {
      bottlenecks.push({
        id: task.id,
        name: task.name,
        reason: `Blocks ${task.dependent_count} other tasks`,
      });
    }

    return bottlenecks;
  }
}

export default DependencyManager;
