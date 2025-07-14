import { getDatabase } from '../db/database.js';
import { generateTaskId, taskIdExists } from '../db/task-id.js';
import { TaskNotFoundError, DuplicateTaskIdError } from '../errors/task-errors.js';
import { ValidationError } from '../errors/base-error.js';
import { Logger } from '../logging/logger.js';
import { query } from './query-builder.js';
import { TaskValidator } from './validation.js';

export class TaskwerkAPI {
  constructor(database = null) {
    this.db = database || getDatabase();
    this.logger = new Logger('api');
  }

  /**
   * Get database connection
   */
  getDatabase() {
    if (!this.db.isConnected()) {
      this.db.connect();
    }
    return this.db;
  }

  /**
   * Create a new task
   * @param {Object} taskData - Task data
   * @returns {Object} Created task
   */
  async createTask(taskData) {
    const db = this.getDatabase();
    
    // Validate input data
    const validation = TaskValidator.validateCreate(taskData);
    if (!validation.isValid) {
      const messages = validation.errors.map(err => `${err.field}: ${err.message}`);
      throw new ValidationError(`Validation failed: ${messages.join(', ')}`);
    }

    // Generate ID if not provided
    if (!taskData.id) {
      taskData.id = await generateTaskId('TASK', db);
    } else if (taskIdExists(taskData.id, db)) {
      throw new DuplicateTaskIdError(taskData.id);
    }

    // Set defaults
    const task = {
      id: taskData.id,
      name: taskData.name,
      description: taskData.description || null,
      status: taskData.status || 'todo',
      priority: taskData.priority || 'medium',
      assignee: taskData.assignee || null,
      created_by: taskData.created_by || 'system',
      updated_by: taskData.updated_by || taskData.created_by || 'system',
      estimate: taskData.estimate || null,
      actual: taskData.actual || null,
      estimated: taskData.estimated || null,
      actual_time: taskData.actual_time || null,
      progress: taskData.progress || 0,
      parent_id: taskData.parent_id || null,
      branch_name: taskData.branch_name || null,
      due_date: taskData.due_date || null,
      content: taskData.content || null,
      category: taskData.category || null,
      metadata: taskData.metadata ? JSON.stringify(taskData.metadata) : '{}',
      context: taskData.context ? JSON.stringify(taskData.context) : '{}'
    };

    try {
      const stmt = db.prepare(`
        INSERT INTO tasks (
          id, name, description, status, priority, assignee,
          created_by, updated_by, estimate, actual, estimated, actual_time,
          progress, parent_id, branch_name, due_date, content, category,
          metadata, context
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `);

      const result = stmt.run(
        task.id, task.name, task.description, task.status, task.priority,
        task.assignee, task.created_by, task.updated_by, task.estimate,
        task.actual, task.estimated, task.actual_time, task.progress,
        task.parent_id, task.branch_name, task.due_date, task.content,
        task.category, task.metadata, task.context
      );

      if (result.changes === 0) {
        throw new ValidationError('Failed to create task');
      }

      this.logger.info(`Created task ${task.id}: ${task.name}`);

      // Add to timeline
      await this.addTimelineEvent(task.id, 'created', task.created_by, 'Task created');

      return this.getTask(task.id);
    } catch (error) {
      this.logger.error(`Failed to create task: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get a task by ID
   * @param {string} taskId - Task ID
   * @returns {Object} Task data
   */
  getTask(taskId) {
    const db = this.getDatabase();
    
    const stmt = db.prepare('SELECT * FROM tasks WHERE id = ?');
    const task = stmt.get(taskId);
    
    if (!task) {
      throw new TaskNotFoundError(`Task ${taskId} not found`);
    }

    // Parse JSON fields
    try {
      task.metadata = JSON.parse(task.metadata || '{}');
      task.context = JSON.parse(task.context || '{}');
    } catch (error) {
      this.logger.warn(`Failed to parse JSON for task ${taskId}: ${error.message}`);
      task.metadata = {};
      task.context = {};
    }

    return task;
  }

  /**
   * Update a task
   * @param {string} taskId - Task ID
   * @param {Object} updates - Update data
   * @param {string} updatedBy - User making the update
   * @returns {Object} Updated task
   */
  async updateTask(taskId, updates, updatedBy = 'system') {
    const db = this.getDatabase();
    
    // Validate update data
    const validation = TaskValidator.validateUpdate(updates);
    if (!validation.isValid) {
      const messages = validation.errors.map(err => `${err.field}: ${err.message}`);
      throw new ValidationError(`Validation failed: ${messages.join(', ')}`);
    }
    
    // Check if task exists
    const currentTask = this.getTask(taskId);
    
    // Track changes for timeline
    const changes = {};
    const updateFields = [];
    const values = [];

    // Build dynamic update query
    for (const [field, value] of Object.entries(updates)) {
      if (field === 'id') {continue;} // Cannot update ID
      
      if (field === 'metadata' || field === 'context') {
        const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);
        updateFields.push(`${field} = ?`);
        values.push(jsonValue);
        changes[field] = { old: currentTask[field], new: value };
      } else {
        updateFields.push(`${field} = ?`);
        values.push(value);
        changes[field] = { old: currentTask[field], new: value };
      }
    }

    if (updateFields.length === 0) {
      return currentTask;
    }

    // Add updated_by and updated_at
    updateFields.push('updated_by = ?');
    values.push(updatedBy);

    const sql = `UPDATE tasks SET ${updateFields.join(', ')} WHERE id = ?`;
    values.push(taskId);

    try {
      const stmt = db.prepare(sql);
      const result = stmt.run(...values);

      if (result.changes === 0) {
        throw new ValidationError('Failed to update task');
      }

      this.logger.info(`Updated task ${taskId}`);

      // Add to timeline
      await this.addTimelineEvent(taskId, 'updated', updatedBy, 'Task updated', changes);

      return this.getTask(taskId);
    } catch (error) {
      this.logger.error(`Failed to update task ${taskId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a task
   * @param {string} taskId - Task ID
   * @param {string} deletedBy - User deleting the task
   * @returns {boolean} Success
   */
  async deleteTask(taskId, _deletedBy = 'system') {
    const db = this.getDatabase();
    
    // Check if task exists
    this.getTask(taskId);

    try {
      const stmt = db.prepare('DELETE FROM tasks WHERE id = ?');
      const result = stmt.run(taskId);

      if (result.changes === 0) {
        throw new ValidationError('Failed to delete task');
      }

      this.logger.info(`Deleted task ${taskId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete task ${taskId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * List tasks with optional filtering
   * @param {Object} options - Query options
   * @returns {Array} List of tasks
   */
  listTasks(options = {}) {
    const db = this.getDatabase();
    
    const conditions = [];
    const values = [];
    let joins = '';

    // Build WHERE conditions
    if (options.status) {
      conditions.push('tasks.status = ?');
      values.push(options.status);
    }

    if (options.priority) {
      conditions.push('tasks.priority = ?');
      values.push(options.priority);
    }

    if (options.assignee) {
      conditions.push('tasks.assignee = ?');
      values.push(options.assignee);
    }

    if (options.parent_id) {
      conditions.push('tasks.parent_id = ?');
      values.push(options.parent_id);
    }

    if (options.category) {
      conditions.push('tasks.category = ?');
      values.push(options.category);
    }

    // Handle tag filtering
    if (options.tags && options.tags.length > 0) {
      // Join with task_tags table and filter by tags
      joins = 'INNER JOIN task_tags ON tasks.id = task_tags.task_id';
      const tagPlaceholders = options.tags.map(() => '?').join(', ');
      conditions.push(`task_tags.tag IN (${tagPlaceholders})`);
      values.push(...options.tags);
    }

    // Build ORDER BY
    const orderBy = options.order_by || 'created_at';
    const orderDir = options.order_dir || 'DESC';

    // Build LIMIT
    const limit = options.limit ? `LIMIT ${parseInt(options.limit)}` : '';
    const offset = options.offset ? `OFFSET ${parseInt(options.offset)}` : '';

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Build the SQL query
    const sql = `
      SELECT DISTINCT tasks.* FROM tasks 
      ${joins}
      ${whereClause}
      ORDER BY tasks.${orderBy} ${orderDir}
      ${limit} ${offset}
    `;

    try {
      const stmt = db.prepare(sql);
      const tasks = stmt.all(...values);

      // Parse JSON fields for each task
      return tasks.map(task => {
        try {
          task.metadata = JSON.parse(task.metadata || '{}');
          task.context = JSON.parse(task.context || '{}');
        } catch (error) {
          this.logger.warn(`Failed to parse JSON for task ${task.id}: ${error.message}`);
          task.metadata = {};
          task.context = {};
        }
        return task;
      });
    } catch (error) {
      this.logger.error(`Failed to list tasks: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add a timeline event
   * @param {string} taskId - Task ID
   * @param {string} action - Action type
   * @param {string} user - User performing action
   * @param {string} note - Optional note
   * @param {Object} changes - Optional changes data
   */
  async addTimelineEvent(taskId, action, user, note = null, changes = null) {
    const db = this.getDatabase();
    
    try {
      const stmt = db.prepare(`
        INSERT INTO task_timeline (task_id, action, user, note, changes)
        VALUES (?, ?, ?, ?, ?)
      `);

      stmt.run(
        taskId,
        action,
        user,
        note,
        changes ? JSON.stringify(changes) : null
      );
    } catch (error) {
      this.logger.error(`Failed to add timeline event for task ${taskId}: ${error.message}`);
      // Don't throw - timeline is not critical
    }
  }

  /**
   * Get task timeline
   * @param {string} taskId - Task ID
   * @returns {Array} Timeline events
   */
  getTaskTimeline(taskId) {
    const db = this.getDatabase();
    
    const stmt = db.prepare(`
      SELECT * FROM task_timeline 
      WHERE task_id = ? 
      ORDER BY timestamp DESC
    `);

    const events = stmt.all(taskId);
    
    return events.map(event => {
      try {
        event.changes = event.changes ? JSON.parse(event.changes) : null;
      } catch (error) {
        this.logger.warn(`Failed to parse changes for timeline event ${event.id}: ${error.message}`);
        event.changes = null;
      }
      return event;
    });
  }

  /**
   * Execute operations in a transaction
   * @param {Function} operations - Function containing operations
   * @returns {*} Result of operations
   */
  transaction(operations) {
    const db = this.getDatabase();
    
    try {
      // For sync operations, use SQLite transaction
      if (operations.constructor.name !== 'AsyncFunction') {
        return db.executeTransaction(() => {
          return operations(this);
        });
      }
      
      // For async operations, handle manually
      db.prepare('BEGIN').run();
      try {
        const result = operations(this);
        db.prepare('COMMIT').run();
        return result;
      } catch (error) {
        db.prepare('ROLLBACK').run();
        throw error;
      }
    } catch (error) {
      this.logger.error(`Transaction failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get query builder for advanced queries
   * @returns {QueryBuilder} Query builder instance
   */
  query() {
    return query(this.getDatabase()).from('tasks');
  }

  /**
   * Search tasks by text
   * @param {string} searchTerm - Search term
   * @param {Object} options - Search options
   * @returns {Array} Matching tasks
   */
  searchTasks(searchTerm, options = {}) {
    const builder = this.query();
    
    if (searchTerm) {
      // Group the OR conditions together
      const searchConditions = [
        'name LIKE ?',
        'description LIKE ?', 
        'content LIKE ?'
      ].join(' OR ');
      
      builder.whereConditions.push(`(${searchConditions})`);
      builder.whereValues.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
    }

    // Apply filters
    if (options.status) {
      builder.andWhere('status', '=', options.status);
    }

    if (options.priority) {
      builder.andWhere('priority', '=', options.priority);
    }

    if (options.assignee) {
      builder.andWhere('assignee', '=', options.assignee);
    }

    if (options.category) {
      builder.andWhere('category', '=', options.category);
    }

    // Apply date filters
    if (options.created_after) {
      builder.andWhere('created_at', '>=', options.created_after);
    }

    if (options.created_before) {
      builder.andWhere('created_at', '<=', options.created_before);
    }

    if (options.due_after) {
      builder.andWhere('due_date', '>=', options.due_after);
    }

    if (options.due_before) {
      builder.andWhere('due_date', '<=', options.due_before);
    }

    // Apply ordering and pagination
    const orderBy = options.order_by || 'created_at';
    const orderDir = options.order_dir || 'DESC';
    builder.orderBy(orderBy, orderDir);

    if (options.limit) {
      builder.limit(options.limit);
    }

    if (options.offset) {
      builder.offset(options.offset);
    }

    const results = builder.get();
    
    // Parse JSON fields
    return results.map(task => {
      try {
        task.metadata = JSON.parse(task.metadata || '{}');
        task.context = JSON.parse(task.context || '{}');
      } catch (error) {
        this.logger.warn(`Failed to parse JSON for task ${task.id}: ${error.message}`);
        task.metadata = {};
        task.context = {};
      }
      return task;
    });
  }

  /**
   * Get tasks by status
   * @param {string} status - Task status
   * @param {Object} options - Query options
   * @returns {Array} Tasks with specified status
   */
  getTasksByStatus(status, options = {}) {
    const builder = this.query()
      .where('status', '=', status)
      .orderBy(options.order_by || 'created_at', options.order_dir || 'DESC');
    
    if (options.limit) {
      builder.limit(options.limit);
    }
    
    if (options.offset) {
      builder.offset(options.offset);
    }
    
    return builder.get();
  }

  /**
   * Get tasks by assignee
   * @param {string} assignee - Assignee
   * @param {Object} options - Query options
   * @returns {Array} Tasks assigned to user
   */
  getTasksByAssignee(assignee, options = {}) {
    const builder = this.query()
      .where('assignee', '=', assignee)
      .orderBy(options.order_by || 'created_at', options.order_dir || 'DESC');
    
    if (options.limit) {
      builder.limit(options.limit);
    }
    
    if (options.offset) {
      builder.offset(options.offset);
    }
    
    return builder.get();
  }

  /**
   * Get subtasks of a parent task
   * @param {string} parentId - Parent task ID
   * @param {Object} options - Query options
   * @returns {Array} Subtasks
   */
  getSubtasks(parentId, options = {}) {
    return this.query()
      .where('parent_id', '=', parentId)
      .orderBy(options.order_by || 'created_at', options.order_dir || 'ASC')
      .get();
  }

  /**
   * Get overdue tasks
   * @param {Object} options - Query options
   * @returns {Array} Overdue tasks
   */
  getOverdueTasks(options = {}) {
    const now = new Date().toISOString();
    
    const builder = this.query()
      .where('due_date', '<', now)
      .andWhere('status', 'NOT IN', ['done', 'completed', 'cancelled'])
      .orderBy('due_date', 'ASC');
    
    if (options.limit) {
      builder.limit(options.limit);
    }
    
    return builder.get();
  }

  /**
   * Get task statistics
   * @returns {Object} Task statistics
   */
  getTaskStats() {
    const db = this.getDatabase();
    
    const stats = {};
    
    // Status counts
    const statusCounts = db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM tasks 
      GROUP BY status
    `).all();
    
    stats.by_status = {};
    statusCounts.forEach(row => {
      stats.by_status[row.status] = row.count;
    });

    // Priority counts
    const priorityCounts = db.prepare(`
      SELECT priority, COUNT(*) as count 
      FROM tasks 
      GROUP BY priority
    `).all();
    
    stats.by_priority = {};
    priorityCounts.forEach(row => {
      stats.by_priority[row.priority] = row.count;
    });

    // Total counts
    stats.total = db.prepare('SELECT COUNT(*) as count FROM tasks').get().count;
    stats.completed = db.prepare(`
      SELECT COUNT(*) as count FROM tasks 
      WHERE status IN ('done', 'completed')
    `).get().count;
    
    stats.in_progress = db.prepare(`
      SELECT COUNT(*) as count FROM tasks 
      WHERE status IN ('in-progress', 'in_progress')
    `).get().count;

    stats.overdue = db.prepare(`
      SELECT COUNT(*) as count FROM tasks 
      WHERE due_date < datetime('now') 
      AND status NOT IN ('done', 'completed', 'cancelled')
    `).get().count;

    return stats;
  }

  /**
   * Add tags to a task
   * @param {string} taskId - Task ID
   * @param {Array} tags - Array of tag strings
   * @param {string} user - User adding tags
   * @returns {boolean} Success
   */
  async addTaskTags(taskId, tags, user = 'system') {
    const db = this.getDatabase();
    
    // Verify task exists
    this.getTask(taskId);

    try {
      const stmt = db.prepare('INSERT OR IGNORE INTO task_tags (task_id, tag) VALUES (?, ?)');
      
      for (const tag of tags) {
        stmt.run(taskId, tag.trim());
      }

      this.logger.info(`Added ${tags.length} tags to task ${taskId}`);
      await this.addTimelineEvent(taskId, 'tags_added', user, `Added tags: ${tags.join(', ')}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to add tags to task ${taskId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove tags from a task
   * @param {string} taskId - Task ID
   * @param {Array} tags - Array of tag strings to remove
   * @param {string} user - User removing tags
   * @returns {boolean} Success
   */
  async removeTaskTags(taskId, tags, user = 'system') {
    const db = this.getDatabase();
    
    try {
      const stmt = db.prepare('DELETE FROM task_tags WHERE task_id = ? AND tag = ?');
      
      for (const tag of tags) {
        stmt.run(taskId, tag.trim());
      }

      this.logger.info(`Removed ${tags.length} tags from task ${taskId}`);
      await this.addTimelineEvent(taskId, 'tags_removed', user, `Removed tags: ${tags.join(', ')}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to remove tags from task ${taskId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get task tags
   * @param {string} taskId - Task ID
   * @returns {Array} Array of tag strings
   */
  getTaskTags(taskId) {
    const db = this.getDatabase();
    
    const tags = db.prepare('SELECT tag FROM task_tags WHERE task_id = ? ORDER BY tag').all(taskId);
    return tags.map(row => row.tag);
  }

  /**
   * Get task notes
   * @param {string} taskId - Task ID
   * @returns {Array} Array of note objects
   */
  getTaskNotes(taskId) {
    const db = this.getDatabase();
    
    const notes = db.prepare(`
      SELECT id, note, content, user, created_at, updated_at 
      FROM task_notes 
      WHERE task_id = ? 
      ORDER BY created_at DESC
    `).all(taskId);
    
    return notes;
  }

  /**
   * Add a note to a task
   * @param {string} taskId - Task ID
   * @param {string} note - Note text
   * @param {string} user - User adding the note
   * @param {string} content - Optional longer content
   * @returns {boolean} Success
   */
  async addTaskNote(taskId, note, user = 'system', content = null) {
    const db = this.getDatabase();
    
    // Verify task exists
    this.getTask(taskId);

    try {
      const stmt = db.prepare(`
        INSERT INTO task_notes (task_id, note, content, user) 
        VALUES (?, ?, ?, ?)
      `);
      
      stmt.run(taskId, note, content, user);

      this.logger.info(`Added note to task ${taskId}`);
      await this.addTimelineEvent(taskId, 'note_added', user, `Added note: ${note}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to add note to task ${taskId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get tasks that this task depends on
   * @param {string} taskId - Task ID
   * @returns {Array} Array of tasks that this task depends on
   */
  getTaskDependencies(taskId) {
    const db = this.getDatabase();
    
    const dependencies = db.prepare(`
      SELECT t.id, t.name, t.status, t.priority
      FROM tasks t
      INNER JOIN task_dependencies td ON t.id = td.depends_on_id
      WHERE td.task_id = ?
      ORDER BY t.id
    `).all(taskId);
    
    return dependencies;
  }
}