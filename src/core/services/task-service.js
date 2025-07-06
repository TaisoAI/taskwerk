/**
 * Task Service
 * 
 * @description Handles all task-related operations
 * @module taskwerk/core/services/task-service
 */

import { getNextTaskId } from '../../storage/index.js';
import { TaskStatus, Priority, DEFAULTS, STATE_TRANSITIONS } from '../constants.js';
import StateMachine from './state-machine.js';

export default class TaskService {
  constructor(database) {
    this.db = database;
    this.stateMachine = new StateMachine(database);
  }

  /**
   * Create a new task
   * @param {Object} data - Task data
   * @returns {Object} Created task
   */
  async createTask(data) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    if (!data.name) {
      throw new Error('Task name is required');
    }

    // Get next task ID
    const stringId = getNextTaskId(this.db);

    // Resolve parent_id if it's a string ID
    let parentId = null;
    if (data.parent_id) {
      if (typeof data.parent_id === 'string' && data.parent_id.startsWith('TASK-')) {
        // Resolve string ID to numeric ID
        const parentStmt = this.db.prepare('SELECT id FROM tasks WHERE string_id = ?');
        const parent = parentStmt.get(data.parent_id);
        if (!parent) {
          throw new Error(`Parent task not found: ${data.parent_id}`);
        }
        parentId = parent.id;
      } else {
        parentId = data.parent_id;
      }
    }

    // Prepare task data with defaults
    const task = {
      string_id: stringId,
      name: data.name,
      description: data.description || null,
      notes: data.notes || '',
      status: data.status || DEFAULTS.STATUS,
      assignee: data.assignee || null,
      priority: data.priority || DEFAULTS.PRIORITY,
      estimate: data.estimate || null,
      actual: data.actual || null,
      due_date: data.due_date || null,
      progress: data.progress || DEFAULTS.PROGRESS,
      parent_id: parentId,
      branch: data.branch || null,
      category: data.category || null,
      blocked_reason: data.blocked_reason || null,
      is_milestone: data.is_milestone ? 1 : 0,
      is_template: data.is_template ? 1 : 0
    };

    // Validate status and priority
    if (!Object.values(TaskStatus).includes(task.status)) {
      throw new Error(`Invalid status: ${task.status}`);
    }
    if (!Object.values(Priority).includes(task.priority)) {
      throw new Error(`Invalid priority: ${task.priority}`);
    }

    // Insert task
    const stmt = this.db.prepare(`
      INSERT INTO tasks (
        string_id, name, description, notes, status, assignee,
        priority, estimate, actual, due_date, progress, parent_id,
        branch, category, blocked_reason, is_milestone, is_template
      ) VALUES (
        @string_id, @name, @description, @notes, @status, @assignee,
        @priority, @estimate, @actual, @due_date, @progress, @parent_id,
        @branch, @category, @blocked_reason, @is_milestone, @is_template
      )
    `);

    const info = stmt.run(task);
    task.id = info.lastInsertRowid;

    // Add tags if provided
    if (data.tags && Array.isArray(data.tags)) {
      await this._addTags(task.id, data.tags);
    }

    // Record creation in history
    await this._recordHistory(task.id, 'create', null, null, 'CREATE');

    // Return complete task
    return this.getTask(stringId);
  }

  /**
   * Get a task by ID
   * @param {string} id - Task ID (numeric or string ID)
   * @returns {Object|null} Task object or null
   */
  async getTask(id) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Query by string_id or numeric id
    const stmt = this.db.prepare(`
      SELECT * FROM tasks 
      WHERE string_id = @id OR id = @id
    `);

    const task = stmt.get({ id });
    if (!task) {
      return null;
    }

    // Get tags
    const tagStmt = this.db.prepare(`
      SELECT t.name FROM tags t
      JOIN task_tags tt ON t.id = tt.tag_id
      WHERE tt.task_id = @taskId
    `);
    
    task.tags = tagStmt.all({ taskId: task.id }).map(row => row.name);

    // Convert timestamps
    task.created_at = new Date(task.created_at);
    task.updated_at = new Date(task.updated_at);
    if (task.completed_at) {
      task.completed_at = new Date(task.completed_at);
    }
    if (task.due_date) {
      task.due_date = new Date(task.due_date);
    }

    // Convert integers to booleans
    task.is_milestone = task.is_milestone === 1;
    task.is_template = task.is_template === 1;

    return task;
  }

  /**
   * Update a task
   * @param {string} id - Task ID
   * @param {Object} updates - Fields to update
   * @returns {Object} Updated task
   */
  async updateTask(id, updates) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Get existing task
    const existing = await this.getTask(id);
    if (!existing) {
      throw new Error(`Task not found: ${id}`);
    }

    // Build update fields
    const fields = [];
    const params = { id: existing.id };

    // Allowed update fields
    const allowedFields = [
      'name', 'description', 'notes', 'status', 'assignee',
      'priority', 'estimate', 'actual', 'due_date', 'progress',
      'parent_id', 'branch', 'category', 'blocked_reason',
      'is_milestone', 'is_template'
    ];

    // Handle parent_id resolution
    if ('parent_id' in updates && updates.parent_id) {
      if (typeof updates.parent_id === 'string' && updates.parent_id.startsWith('TASK-')) {
        // Resolve string ID to numeric ID
        const parentStmt = this.db.prepare('SELECT id FROM tasks WHERE string_id = ?');
        const parent = parentStmt.get(updates.parent_id);
        if (!parent) {
          throw new Error(`Parent task not found: ${updates.parent_id}`);
        }
        updates.parent_id = parent.id;
      }
    }

    for (const field of allowedFields) {
      if (field in updates) {
        fields.push(`${field} = @${field}`);
        // Convert booleans to integers for SQLite
        if (field === 'is_milestone' || field === 'is_template') {
          params[field] = updates[field] ? 1 : 0;
        } else {
          params[field] = updates[field];
        }
      }
    }

    // Special handling for status changes
    if (updates.status) {
      // Validate status transition
      const currentStatus = existing.status;
      const newStatus = updates.status;
      
      if (!Object.values(TaskStatus).includes(newStatus)) {
        throw new Error(`Invalid status: ${newStatus}`);
      }

      const allowedTransitions = STATE_TRANSITIONS[currentStatus] || [];
      if (!allowedTransitions.includes(newStatus)) {
        throw new Error(`Invalid status transition: ${currentStatus} → ${newStatus}`);
      }

      // Set completed_at if transitioning to completed
      if (newStatus === TaskStatus.COMPLETED && currentStatus !== TaskStatus.COMPLETED) {
        fields.push('completed_at = CURRENT_TIMESTAMP');
      }
    }

    // Update tags if provided (do this even if no other fields change)
    if ('tags' in updates) {
      await this._updateTags(existing.id, updates.tags);
    }

    if (fields.length === 0 && !('tags' in updates)) {
      return existing; // No changes
    }

    // Update task fields if any
    if (fields.length > 0) {
      const updateStmt = this.db.prepare(`
        UPDATE tasks SET ${fields.join(', ')}
        WHERE id = @id
      `);

      updateStmt.run(params);
    }

    // Record history for each changed field
    for (const field of Object.keys(updates)) {
      if (allowedFields.includes(field) && updates[field] !== existing[field]) {
        await this._recordHistory(
          existing.id,
          field,
          existing[field],
          updates[field],
          field === 'status' ? 'STATUS_CHANGE' : 'UPDATE'
        );
      }
    }

    // Return updated task
    return this.getTask(existing.string_id);
  }

  /**
   * Delete a task
   * @param {string} id - Task ID
   * @param {boolean} force - Force delete even if has dependencies
   * @returns {void}
   */
  async deleteTask(id, force = false) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const task = await this.getTask(id);
    if (!task) {
      throw new Error(`Task not found: ${id}`);
    }

    // Check for dependencies
    if (!force) {
      const depStmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM task_dependencies
        WHERE depends_on_id = @taskId
      `);
      
      const { count } = depStmt.get({ taskId: task.id });
      if (count > 0) {
        throw new Error(`Task ${id} has ${count} dependent tasks. Use force=true to delete anyway.`);
      }

      // Check for children
      const childStmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM tasks
        WHERE parent_id = @taskId
      `);
      
      const { count: childCount } = childStmt.get({ taskId: task.id });
      if (childCount > 0) {
        throw new Error(`Task ${id} has ${childCount} child tasks. Use force=true to delete anyway.`);
      }
    }

    // Delete task (cascade will handle related records)
    const deleteStmt = this.db.prepare('DELETE FROM tasks WHERE id = @id');
    deleteStmt.run({ id: task.id });
  }

  /**
   * List tasks with filters
   * @param {Object} filters - Filter options
   * @returns {Array} Array of tasks
   */
  async listTasks(filters = {}) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Build query
    const conditions = [];
    const params = {};

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        conditions.push(`status IN (${filters.status.map((_, i) => `@status${i}`).join(', ')})`);
        filters.status.forEach((s, i) => params[`status${i}`] = s);
      } else {
        conditions.push('status = @status');
        params.status = filters.status;
      }
    }

    if (filters.assignee) {
      conditions.push('assignee = @assignee');
      params.assignee = filters.assignee;
    }

    if (filters.priority) {
      conditions.push('priority = @priority');
      params.priority = filters.priority;
    }

    if (filters.parent_id !== undefined) {
      if (filters.parent_id === null) {
        conditions.push('parent_id IS NULL');
      } else {
        conditions.push('parent_id = @parent_id');
        params.parent_id = filters.parent_id;
      }
    }

    if (filters.is_milestone !== undefined) {
      conditions.push('is_milestone = @is_milestone');
      params.is_milestone = filters.is_milestone ? 1 : 0;
    }

    // Exclude archived by default unless specifically requested
    if (!filters.include_archived) {
      conditions.push("status != 'archived'");
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Default ordering
    const orderBy = filters.order_by || 'created_at DESC';

    const stmt = this.db.prepare(`
      SELECT * FROM tasks
      ${whereClause}
      ORDER BY ${orderBy}
    `);

    const tasks = stmt.all(params);

    // Get tags for all tasks in one query
    if (tasks.length > 0) {
      const taskIds = tasks.map(t => t.id);
      const tagStmt = this.db.prepare(`
        SELECT tt.task_id, t.name 
        FROM tags t
        JOIN task_tags tt ON t.id = tt.tag_id
        WHERE tt.task_id IN (${taskIds.map(() => '?').join(', ')})
      `);

      const tagRows = tagStmt.all(...taskIds);
      const tagsByTask = {};
      
      for (const row of tagRows) {
        if (!tagsByTask[row.task_id]) {
          tagsByTask[row.task_id] = [];
        }
        tagsByTask[row.task_id].push(row.name);
      }

      // Add tags to tasks
      for (const task of tasks) {
        task.tags = tagsByTask[task.id] || [];
      }
    }

    // Convert integers to booleans for all tasks
    for (const task of tasks) {
      task.is_milestone = task.is_milestone === 1;
      task.is_template = task.is_template === 1;
    }

    return tasks;
  }

  /**
   * Change task status with validation
   * @param {string} id - Task ID
   * @param {string} status - New status
   * @param {Object} options - Additional options
   * @param {string} options.reason - Reason for status change (required for blocked)
   * @param {boolean} options.cascade - Whether to cascade to children
   * @returns {Object} Updated task with transition details
   */
  async changeTaskStatus(id, status, options = {}) {
    // Get task to get numeric ID
    const task = await this.getTask(id);
    if (!task) {
      throw new Error(`Task not found: ${id}`);
    }

    // Use state machine for transition
    const result = await this.stateMachine.transitionTask(task.id, status, options);

    // Return updated task with transition details
    const updatedTask = await this.getTask(id);
    return {
      task: updatedTask,
      transition: result
    };
  }

  /**
   * Add tags to a task
   * @private
   */
  async _addTags(taskId, tags) {
    if (!tags || tags.length === 0) return;

    const insertTag = this.db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
    const getTag = this.db.prepare('SELECT id FROM tags WHERE name = ?');
    const linkTag = this.db.prepare('INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)');

    for (const tag of tags) {
      insertTag.run(tag);
      const { id: tagId } = getTag.get(tag);
      linkTag.run(taskId, tagId);
    }
  }

  /**
   * Update tags for a task
   * @private
   */
  async _updateTags(taskId, tags) {
    // Remove existing tags
    this.db.prepare('DELETE FROM task_tags WHERE task_id = ?').run(taskId);
    
    // Add new tags if provided
    if (tags && tags.length > 0) {
      await this._addTags(taskId, tags);
    }
  }

  /**
   * Record task history
   * @private
   */
  async _recordHistory(taskId, fieldName, oldValue, newValue, changeType) {
    const stmt = this.db.prepare(`
      INSERT INTO task_history (
        task_id, field_name, old_value, new_value, change_type
      ) VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      taskId,
      fieldName,
      oldValue === null ? null : String(oldValue),
      newValue === null ? null : String(newValue),
      changeType
    );
  }
}