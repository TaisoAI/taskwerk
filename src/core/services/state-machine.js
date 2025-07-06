/**
 * State Machine Service
 * 
 * @description Handles task state transitions with validation and side effects
 * @module taskwerk/core/services/state-machine
 */

import { TaskStatus, STATE_TRANSITIONS } from '../constants.js';

export default class StateMachine {
  constructor(database) {
    this.db = database;
  }

  /**
   * Validate if a state transition is allowed
   * @param {string} fromStatus - Current status
   * @param {string} toStatus - Target status
   * @returns {boolean} Whether transition is valid
   */
  isValidTransition(fromStatus, toStatus) {
    const allowedTransitions = STATE_TRANSITIONS[fromStatus] || [];
    return allowedTransitions.includes(toStatus);
  }

  /**
   * Get allowed transitions from current state
   * @param {string} status - Current status
   * @returns {Array<string>} Allowed target statuses
   */
  getAllowedTransitions(status) {
    return STATE_TRANSITIONS[status] || [];
  }

  /**
   * Transition task to new status with all side effects
   * @param {number} taskId - Task ID
   * @param {string} newStatus - Target status
   * @param {Object} options - Additional options
   * @param {string} options.reason - Reason for transition (required for blocked)
   * @param {boolean} options.cascade - Whether to cascade to children
   * @returns {Object} Transition result
   */
  async transitionTask(taskId, newStatus, options = {}) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Get current task
    const stmt = this.db.prepare('SELECT * FROM tasks WHERE id = ?');
    const task = stmt.get(taskId);
    
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Validate transition
    if (!this.isValidTransition(task.status, newStatus)) {
      throw new Error(
        `Invalid status transition: ${task.status} → ${newStatus}. ` +
        `Allowed: ${this.getAllowedTransitions(task.status).join(', ')}`
      );
    }

    // Prepare updates
    const updates = { status: newStatus };
    const sideEffects = [];

    // Handle status-specific side effects
    switch (newStatus) {
      case TaskStatus.ACTIVE:
        // Clear blocked reason when activating
        if (task.status === TaskStatus.BLOCKED) {
          updates.blocked_reason = null;
        }
        break;

      case TaskStatus.BLOCKED:
        // Require reason for blocking
        if (!options.reason) {
          throw new Error('Blocked reason is required');
        }
        updates.blocked_reason = options.reason;
        break;

      case TaskStatus.COMPLETED:
        // Set completion timestamp
        updates.completed_at = new Date().toISOString();
        // Clear blocked reason if any
        updates.blocked_reason = null;
        sideEffects.push({ type: 'completion', taskId });
        break;

      case TaskStatus.ARCHIVED:
        // Can only archive completed tasks
        if (task.status !== TaskStatus.COMPLETED) {
          throw new Error('Only completed tasks can be archived');
        }
        break;
    }

    // Start transaction
    const transaction = this.db.transaction(() => {
      // Update task
      const updateFields = Object.keys(updates).map(k => `${k} = @${k}`);
      const updateStmt = this.db.prepare(
        `UPDATE tasks SET ${updateFields.join(', ')} WHERE id = @id`
      );
      updateStmt.run({ ...updates, id: taskId });

      // Record state change in history
      const historyStmt = this.db.prepare(`
        INSERT INTO task_history (task_id, field_name, old_value, new_value, change_type)
        VALUES (@task_id, 'status', @old_value, @new_value, 'status_change')
      `);
      historyStmt.run({
        task_id: taskId,
        old_value: task.status,
        new_value: newStatus
      });

      // Handle cascading to children if requested
      if (options.cascade) {
        const childrenResult = this._cascadeStatusToChildren(taskId, newStatus);
        sideEffects.push(...childrenResult);
      }
    });

    // Execute transaction
    transaction();

    return {
      taskId,
      oldStatus: task.status,
      newStatus,
      sideEffects
    };
  }

  /**
   * Cascade status changes to child tasks
   * @private
   * @param {number} parentId - Parent task ID
   * @param {string} parentStatus - New parent status
   * @returns {Array} Side effects
   */
  _cascadeStatusToChildren(parentId, parentStatus) {
    const effects = [];
    
    // Get child tasks
    const childStmt = this.db.prepare(
      'SELECT id, string_id, status FROM tasks WHERE parent_id = ?'
    );
    const children = childStmt.all(parentId);

    for (const child of children) {
      // Define cascade rules
      let childNewStatus = null;
      
      switch (parentStatus) {
        case TaskStatus.BLOCKED:
          // Block children of blocked tasks
          if (child.status === TaskStatus.ACTIVE || child.status === TaskStatus.TODO) {
            childNewStatus = TaskStatus.BLOCKED;
          }
          break;
          
        case TaskStatus.ARCHIVED:
          // Archive children of archived tasks
          if (child.status === TaskStatus.COMPLETED) {
            childNewStatus = TaskStatus.ARCHIVED;
          }
          break;
      }

      if (childNewStatus && this.isValidTransition(child.status, childNewStatus)) {
        // Recursively transition child
        const result = this.transitionTask(child.id, childNewStatus, {
          reason: `Parent task (${parentId}) changed to ${parentStatus}`,
          cascade: true
        });
        
        effects.push({
          type: 'child_transition',
          childId: child.id,
          childStringId: child.string_id,
          oldStatus: child.status,
          newStatus: childNewStatus
        });
      }
    }

    return effects;
  }

  /**
   * Get task state information including allowed transitions
   * @param {number} taskId - Task ID
   * @returns {Object} State information
   */
  async getTaskState(taskId) {
    const stmt = this.db.prepare('SELECT status FROM tasks WHERE id = ?');
    const task = stmt.get(taskId);
    
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    return {
      currentStatus: task.status,
      allowedTransitions: this.getAllowedTransitions(task.status),
      isTerminal: this.getAllowedTransitions(task.status).length === 0
    };
  }

  /**
   * Validate bulk status changes
   * @param {Array<{taskId: number, newStatus: string}>} changes - Proposed changes
   * @returns {Object} Validation result
   */
  async validateBulkTransitions(changes) {
    const results = [];
    
    for (const change of changes) {
      const stmt = this.db.prepare('SELECT status FROM tasks WHERE id = ?');
      const task = stmt.get(change.taskId);
      
      if (!task) {
        results.push({
          taskId: change.taskId,
          valid: false,
          error: 'Task not found'
        });
        continue;
      }

      const valid = this.isValidTransition(task.status, change.newStatus);
      results.push({
        taskId: change.taskId,
        currentStatus: task.status,
        targetStatus: change.newStatus,
        valid,
        error: valid ? null : `Invalid transition: ${task.status} → ${change.newStatus}`
      });
    }

    return {
      valid: results.every(r => r.valid),
      results
    };
  }
}