/**
 * TaskWerk v3 Task Validation Utilities
 *
 * Provides advanced validation logic specific to task operations,
 * including business rule validation and constraint checking.
 */

import { ValidationError } from '../api/base-api.js';
// import { TASK_STATUSES, TASK_PRIORITIES } from '../api/validation.js';

/**
 * Task business rule validator
 */
export class TaskValidator {
  constructor(db) {
    this.db = db;
  }

  /**
   * Validate task creation rules
   */
  validateTaskCreation(taskData) {
    const errors = [];

    // Business rule: Task name must be unique within active tasks
    if (taskData.name) {
      const existingTask = this.db
        .prepare(
          `
                SELECT id FROM tasks 
                WHERE name = ? AND status NOT IN ('completed', 'archived')
            `
        )
        .get(taskData.name);

      if (existingTask) {
        errors.push(`A task with name "${taskData.name}" already exists and is not completed`);
      }
    }

    // Business rule: High priority tasks should have assignee
    if (taskData.priority === 'high' && !taskData.assignee) {
      errors.push('High priority tasks should have an assignee');
    }

    // Business rule: Tasks with estimates should have reasonable values
    if (taskData.estimated) {
      if (!this.isValidEstimate(taskData.estimated)) {
        errors.push('Estimate must be in valid format (e.g., "2 hours", "1 day", "3 weeks")');
      }
    }

    if (errors.length > 0) {
      throw new ValidationError('Task creation validation failed', errors);
    }

    return true;
  }

  /**
   * Validate task status transitions
   */
  validateStatusTransition(currentStatus, newStatus, taskData = {}) {
    const errors = [];

    // Define valid transitions
    const validTransitions = {
      todo: ['in_progress', 'blocked', 'archived'],
      in_progress: ['todo', 'blocked', 'completed', 'error'],
      blocked: ['todo', 'in_progress', 'archived'],
      completed: ['archived'], // Completed tasks can only be archived
      archived: [], // Archived tasks cannot transition
      error: ['todo', 'in_progress', 'blocked', 'archived'],
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      errors.push(`Invalid status transition from "${currentStatus}" to "${newStatus}"`);
    }

    // Business rules for specific transitions
    if (newStatus === 'completed') {
      // Validate completion requirements
      this.validateTaskCompletion(taskData, errors);
    }

    if (newStatus === 'in_progress') {
      // Task should have assignee to be in progress
      if (!taskData.assignee) {
        errors.push('Tasks must have an assignee to be marked as in progress');
      }
    }

    if (newStatus === 'blocked') {
      // Blocked tasks should have a reason (error_msg or note)
      if (!taskData.error_msg) {
        errors.push('Blocked tasks should have a reason specified in error_msg field');
      }
    }

    if (errors.length > 0) {
      throw new ValidationError('Status transition validation failed', errors);
    }

    return true;
  }

  /**
   * Validate task completion requirements
   */
  validateTaskCompletion(taskData, errors = []) {
    // Check dependencies - all blocking dependencies must be completed
    const blockingDependencies = this.db
      .prepare(
        `
            SELECT t.name, t.status 
            FROM task_dependencies td
            JOIN tasks t ON td.depends_on_id = t.id
            WHERE td.task_id = ? AND td.dependency_type = 'blocks' AND t.status != 'completed'
        `
      )
      .all(taskData.id);

    if (blockingDependencies.length > 0) {
      const incompleteNames = blockingDependencies.map(dep => dep.name).join(', ');
      errors.push(`Cannot complete task: dependent tasks not completed: ${incompleteNames}`);
    }

    // Progress should be 100% or close to it
    if (taskData.progress !== undefined && taskData.progress < 90) {
      errors.push('Tasks should be at least 90% complete before marking as completed');
    }

    return errors.length === 0;
  }

  /**
   * Validate task assignment
   */
  validateTaskAssignment(assignee, _taskData = {}) {
    const errors = [];

    // Basic email format validation
    if (assignee && !this.isValidEmail(assignee)) {
      errors.push('Assignee should be a valid email address');
    }

    // Business rule: Check assignee workload (optional)
    if (assignee) {
      const activeTaskCount = this.db
        .prepare(
          `
                SELECT COUNT(*) as count 
                FROM tasks 
                WHERE assignee = ? AND status IN ('todo', 'in_progress')
            `
        )
        .get(assignee);

      if (activeTaskCount.count >= 10) {
        errors.push(`Assignee ${assignee} already has ${activeTaskCount.count} active tasks`);
      }
    }

    if (errors.length > 0) {
      throw new ValidationError('Task assignment validation failed', errors);
    }

    return true;
  }

  /**
   * Validate task dependencies for cycles
   */
  validateDependencyCycle(taskId, dependsOnId) {
    if (taskId === dependsOnId) {
      throw new ValidationError('Task cannot depend on itself', ['SELF_DEPENDENCY']);
    }

    // Check for immediate reverse dependency
    const reverseDep = this.db
      .prepare(
        `
            SELECT 1 FROM task_dependencies 
            WHERE task_id = ? AND depends_on_id = ?
        `
      )
      .get(dependsOnId, taskId);

    if (reverseDep) {
      throw new ValidationError('Circular dependency detected', ['CIRCULAR_DEPENDENCY']);
    }

    // Deep cycle detection using recursive query
    const cyclePath = this.findDependencyCycle(taskId, dependsOnId);
    if (cyclePath.length > 0) {
      throw new ValidationError('Deep circular dependency detected', [
        `DEPENDENCY_CYCLE: ${cyclePath.join(' -> ')}`,
      ]);
    }

    return true;
  }

  /**
   * Validate task deletion
   */
  validateTaskDeletion(taskId) {
    const errors = [];

    // Check if task has dependents
    const dependents = this.db
      .prepare(
        `
            SELECT t.name 
            FROM task_dependencies td
            JOIN tasks t ON td.task_id = t.id
            WHERE td.depends_on_id = ? AND t.status NOT IN ('completed', 'archived')
        `
      )
      .all(taskId);

    if (dependents.length > 0) {
      const dependentNames = dependents.map(dep => dep.name).join(', ');
      errors.push(`Cannot delete task: other tasks depend on it: ${dependentNames}`);
    }

    // Check if task is in progress
    const task = this.db.prepare('SELECT status FROM tasks WHERE id = ?').get(taskId);
    if (task && task.status === 'in_progress') {
      errors.push('Cannot delete task that is currently in progress');
    }

    if (errors.length > 0) {
      throw new ValidationError('Task deletion validation failed', errors);
    }

    return true;
  }

  // Helper methods

  /**
   * Check if estimate format is valid
   */
  isValidEstimate(estimate) {
    const estimatePattern = /^\d+\s+(minute|minutes|hour|hours|day|days|week|weeks|month|months)$/i;
    return estimatePattern.test(estimate);
  }

  /**
   * Basic email validation
   */
  isValidEmail(email) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(email);
  }

  /**
   * Find dependency cycles using depth-first search
   */
  findDependencyCycle(startTaskId, targetTaskId, visited = new Set(), path = []) {
    if (visited.has(targetTaskId)) {
      return path; // Cycle found
    }

    visited.add(targetTaskId);
    path.push(targetTaskId);

    // Get tasks that the target depends on
    const dependencies = this.db
      .prepare(
        `
            SELECT depends_on_id 
            FROM task_dependencies 
            WHERE task_id = ?
        `
      )
      .all(targetTaskId);

    for (const dep of dependencies) {
      if (dep.depends_on_id === startTaskId) {
        return [...path, startTaskId]; // Found cycle back to start
      }

      const cyclePath = this.findDependencyCycle(startTaskId, dep.depends_on_id, new Set(visited), [
        ...path,
      ]);
      if (cyclePath.length > 0) {
        return cyclePath;
      }
    }

    return []; // No cycle found
  }

  /**
   * Validate task update constraints
   */
  validateTaskUpdate(existingTask, updates) {
    const errors = [];

    // Cannot change ID
    if (updates.id !== undefined && updates.id !== existingTask.id) {
      errors.push('Task ID cannot be changed');
    }

    // Cannot change creation timestamp
    if (updates.created_at !== undefined && updates.created_at !== existingTask.created_at) {
      errors.push('Task creation timestamp cannot be changed');
    }

    // Status transition validation
    if (updates.status && updates.status !== existingTask.status) {
      this.validateStatusTransition(existingTask.status, updates.status, {
        ...existingTask,
        ...updates,
      });
    }

    // Assignment validation
    if (updates.assignee !== undefined) {
      this.validateTaskAssignment(updates.assignee, { ...existingTask, ...updates });
    }

    // Progress validation
    if (updates.progress !== undefined) {
      if (updates.progress < 0 || updates.progress > 100) {
        errors.push('Progress must be between 0 and 100');
      }

      // Progress cannot decrease if task is completed
      if (existingTask.status === 'completed' && updates.progress < existingTask.progress) {
        errors.push('Cannot decrease progress of completed task');
      }
    }

    if (errors.length > 0) {
      throw new ValidationError('Task update validation failed', errors);
    }

    return true;
  }
}

/**
 * Standalone validation functions
 */

/**
 * Validate task name uniqueness
 */
export function validateTaskNameUniqueness(db, name, excludeId = null) {
  let query = 'SELECT id FROM tasks WHERE name = ? AND status NOT IN (?, ?)';
  const params = [name, 'completed', 'archived'];

  if (excludeId) {
    query += ' AND id != ?';
    params.push(excludeId);
  }

  const existing = db.prepare(query).get(...params);

  if (existing) {
    throw new ValidationError('Task name must be unique among active tasks', [
      `Task "${name}" already exists`,
    ]);
  }

  return true;
}

/**
 * Validate task priority escalation rules
 */
export function validatePriorityEscalation(db, taskId, newPriority) {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  if (!task) {
    return true;
  }

  // Auto-escalation rules based on age
  const created = new Date(task.created_at);
  const now = new Date();
  const ageInDays = (now - created) / (1000 * 60 * 60 * 24);

  // Tasks older than 30 days should be high priority
  if (ageInDays > 30 && newPriority === 'low') {
    throw new ValidationError('Old tasks should not be lowered to low priority', [
      `Task is ${Math.floor(ageInDays)} days old and should remain high priority`,
    ]);
  }

  return true;
}

export default TaskValidator;
