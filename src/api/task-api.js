/**
 * TaskWerk v3 Core Task CRUD API
 * 
 * Provides complete CRUD operations for tasks with validation, 
 * relationship handling, and timeline management.
 */

import { BaseAPI, APIError, ValidationError } from './base-api.js';
import { TaskSchema, validateTaskId } from './validation.js';

/**
 * Core Task API class providing CRUD operations
 */
export class TaskAPI extends BaseAPI {
    constructor(dbPath = null) {
        super(dbPath);
    }

    /**
     * Create a new task
     */
    async createTask(taskData, context = {}) {
        const sanitized = this.sanitize(taskData);
        
        // Validate input
        this.validate(sanitized, TaskSchema);

        const db = await this.getDatabase();
        
        return await this.transaction((db) => {
            const now = this.now();
            
            // Prepare task data with defaults
            const taskRecord = {
                name: sanitized.name,
                description: sanitized.description || null,
                status: sanitized.status || 'todo',
                priority: sanitized.priority || 'medium',
                category: sanitized.category || null,
                assignee: sanitized.assignee || null,
                estimated: sanitized.estimated || null,
                progress: sanitized.progress || 0,
                error_msg: null,
                validation_state: null,
                created_at: now,
                updated_at: now,
                completed_at: null,
                format: 'v3'
            };

            // Insert the task
            const insertStmt = db.prepare(`
                INSERT INTO tasks (
                    name, description, status, priority, category, assignee, 
                    estimated, progress, created_at, updated_at, format
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            const result = insertStmt.run(
                taskRecord.name,
                taskRecord.description,
                taskRecord.status,
                taskRecord.priority,
                taskRecord.category,
                taskRecord.assignee,
                taskRecord.estimated,
                taskRecord.progress,
                taskRecord.created_at,
                taskRecord.updated_at,
                taskRecord.format
            );

            const taskId = result.lastInsertRowid;

            // Add creation note to timeline
            this.addTimelineNote(db, taskId, `Task created`, 'system', context.user);

            // Fetch and return the complete task
            return this.getTaskById(db, taskId);
        });
    }

    /**
     * Get a task by ID
     */
    async getTask(taskId, context = {}) {
        const db = await this.getDatabase();
        
        if (typeof taskId === 'string') {
            return this.getTaskByStringId(db, taskId);
        } else {
            return this.getTaskById(db, taskId);
        }
    }

    /**
     * Update an existing task
     */
    async updateTask(taskId, updates, context = {}) {
        const sanitized = this.sanitize(updates);
        
        // Validate updates (partial validation)
        const updateSchema = {
            properties: TaskSchema.properties
        };
        this.validate(sanitized, updateSchema);

        const db = await this.getDatabase();
        
        return await this.transaction((db) => {
            // Get existing task
            const existingTask = this.getTaskById(db, taskId);
            if (!existingTask) {
                throw new APIError(`Task with ID ${taskId} not found`, 'TASK_NOT_FOUND');
            }

            // Build update query dynamically
            const updateFields = [];
            const updateValues = [];
            const changes = [];

            for (const [field, newValue] of Object.entries(sanitized)) {
                if (field !== 'id' && newValue !== undefined) {
                    const oldValue = existingTask[field];
                    
                    if (oldValue !== newValue) {
                        updateFields.push(`${field} = ?`);
                        updateValues.push(newValue);
                        changes.push({ field, oldValue, newValue });
                    }
                }
            }

            if (updateFields.length === 0) {
                return existingTask; // No changes
            }

            // Add updated_at timestamp
            updateFields.push('updated_at = ?');
            updateValues.push(this.now());

            // Handle status-specific updates
            if (sanitized.status === 'completed' && existingTask.status !== 'completed') {
                updateFields.push('completed_at = ?');
                updateValues.push(this.now());
                updateFields.push('progress = ?');
                updateValues.push(100);
            } else if (sanitized.status !== 'completed' && existingTask.status === 'completed') {
                updateFields.push('completed_at = ?');
                updateValues.push(null);
            }

            // Execute update
            const updateStmt = db.prepare(`
                UPDATE tasks 
                SET ${updateFields.join(', ')} 
                WHERE id = ?
            `);
            
            updateValues.push(taskId);
            updateStmt.run(...updateValues);

            // Add timeline notes for significant changes
            this.recordTaskChanges(db, taskId, changes, context.user);

            // Return updated task
            return this.getTaskById(db, taskId);
        });
    }

    /**
     * Delete a task
     */
    async deleteTask(taskId, context = {}) {
        const db = await this.getDatabase();
        
        return await this.transaction((db) => {
            // Get task before deletion for audit
            const task = this.getTaskById(db, taskId);
            if (!task) {
                throw new APIError(`Task with ID ${taskId} not found`, 'TASK_NOT_FOUND');
            }

            // Add deletion note
            this.addTimelineNote(db, taskId, `Task deleted`, 'system', context.user);

            // Delete task (cascading deletes will handle related records)
            const deleteStmt = db.prepare('DELETE FROM tasks WHERE id = ?');
            const result = deleteStmt.run(taskId);

            if (result.changes === 0) {
                throw new APIError(`Task with ID ${taskId} not found`, 'TASK_NOT_FOUND');
            }

            return {
                success: true,
                deletedTask: task,
                deletedAt: this.now()
            };
        });
    }

    /**
     * List tasks with filtering and pagination
     */
    async listTasks(options = {}) {
        const db = await this.getDatabase();
        
        const {
            status,
            priority,
            assignee,
            category,
            keyword,
            limit = 100,
            offset = 0,
            sortBy = 'updated_at',
            sortOrder = 'desc'
        } = options;

        // Build WHERE clause
        const whereConditions = [];
        const whereValues = [];

        if (status) {
            whereConditions.push('status = ?');
            whereValues.push(status);
        }
        
        if (priority) {
            whereConditions.push('priority = ?');
            whereValues.push(priority);
        }
        
        if (assignee) {
            whereConditions.push('assignee = ?');
            whereValues.push(assignee);
        }
        
        if (category) {
            whereConditions.push('category = ?');
            whereValues.push(category);
        }

        if (keyword) {
            // Join with keywords table for keyword filtering
            whereConditions.push(`EXISTS (
                SELECT 1 FROM task_keywords tk 
                WHERE tk.task_id = tasks.id AND tk.keyword = ?
            )`);
            whereValues.push(keyword);
        }

        // Build final query
        let query = 'SELECT * FROM tasks';
        
        if (whereConditions.length > 0) {
            query += ' WHERE ' + whereConditions.join(' AND ');
        }

        // Add sorting
        const validSortFields = ['id', 'name', 'status', 'priority', 'created_at', 'updated_at'];
        const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'updated_at';
        const safeSortOrder = ['asc', 'desc'].includes(sortOrder.toLowerCase()) ? sortOrder.toUpperCase() : 'DESC';
        
        query += ` ORDER BY ${safeSortBy} ${safeSortOrder}`;
        
        // Add pagination
        query += ' LIMIT ? OFFSET ?';
        whereValues.push(limit, offset);

        // Execute query
        const stmt = db.prepare(query);
        const tasks = stmt.all(...whereValues);

        // Get total count for pagination
        let countQuery = 'SELECT COUNT(*) as total FROM tasks';
        if (whereConditions.length > 0) {
            countQuery += ' WHERE ' + whereConditions.join(' AND ');
        }
        
        const countStmt = db.prepare(countQuery);
        const countValues = whereValues.slice(0, whereValues.length - 2); // Remove limit/offset
        const { total } = countStmt.get(...countValues);

        return {
            tasks,
            pagination: {
                total,
                limit,
                offset,
                hasMore: offset + limit < total
            },
            filters: {
                status,
                priority,
                assignee,
                category,
                keyword
            }
        };
    }

    /**
     * Search tasks by text
     */
    async searchTasks(query, options = {}) {
        const {
            fields = ['name', 'description'],
            limit = 50
        } = options;

        const db = await this.getDatabase();
        
        // Build search conditions
        const searchConditions = [];
        const searchValues = [];
        const searchTerm = `%${query}%`;

        if (fields.includes('name')) {
            searchConditions.push('name LIKE ?');
            searchValues.push(searchTerm);
        }

        if (fields.includes('description')) {
            searchConditions.push('description LIKE ?');
            searchValues.push(searchTerm);
        }

        if (fields.includes('notes')) {
            searchConditions.push(`EXISTS (
                SELECT 1 FROM task_notes tn 
                WHERE tn.task_id = tasks.id AND tn.note LIKE ?
            )`);
            searchValues.push(searchTerm);
        }

        if (fields.includes('keywords')) {
            searchConditions.push(`EXISTS (
                SELECT 1 FROM task_keywords tk 
                WHERE tk.task_id = tasks.id AND tk.keyword LIKE ?
            )`);
            searchValues.push(searchTerm);
        }

        if (searchConditions.length === 0) {
            throw new APIError('No valid search fields specified', 'INVALID_SEARCH_FIELDS');
        }

        // Execute search
        const searchQuery = `
            SELECT DISTINCT * FROM tasks 
            WHERE ${searchConditions.join(' OR ')}
            ORDER BY updated_at DESC 
            LIMIT ?
        `;
        
        const stmt = db.prepare(searchQuery);
        const results = stmt.all(...searchValues, limit);

        return {
            query,
            results,
            total: results.length,
            searchFields: fields
        };
    }

    /**
     * Get task statistics
     */
    async getTaskStats() {
        const db = await this.getDatabase();
        
        const stats = {
            total: 0,
            byStatus: {},
            byPriority: {},
            byCategory: {},
            recent: {
                created: 0,
                updated: 0,
                completed: 0
            }
        };

        // Total count
        const totalResult = db.prepare('SELECT COUNT(*) as count FROM tasks').get();
        stats.total = totalResult.count;

        // By status
        const statusResults = db.prepare('SELECT status, COUNT(*) as count FROM tasks GROUP BY status').all();
        for (const row of statusResults) {
            stats.byStatus[row.status] = row.count;
        }

        // By priority
        const priorityResults = db.prepare('SELECT priority, COUNT(*) as count FROM tasks GROUP BY priority').all();
        for (const row of priorityResults) {
            stats.byPriority[row.priority] = row.count;
        }

        // By category
        const categoryResults = db.prepare('SELECT category, COUNT(*) as count FROM tasks WHERE category IS NOT NULL GROUP BY category').all();
        for (const row of categoryResults) {
            stats.byCategory[row.category] = row.count;
        }

        // Recent activity (last 7 days)
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        
        const recentCreated = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE created_at >= ?').get(weekAgo);
        stats.recent.created = recentCreated.count;
        
        const recentUpdated = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE updated_at >= ? AND created_at < ?').get(weekAgo, weekAgo);
        stats.recent.updated = recentUpdated.count;
        
        const recentCompleted = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE completed_at >= ?').get(weekAgo);
        stats.recent.completed = recentCompleted.count;

        return stats;
    }

    // Helper methods

    /**
     * Get task by numeric ID
     */
    getTaskById(db, taskId) {
        const stmt = db.prepare('SELECT * FROM tasks WHERE id = ?');
        const task = stmt.get(taskId);
        
        if (!task) {
            return null;
        }

        return this.enrichTask(db, task);
    }

    /**
     * Get task by string ID (TASK-XXX format)
     */
    getTaskByStringId(db, taskStringId) {
        if (!validateTaskId(taskStringId)) {
            throw new ValidationError('Invalid task ID format', [`Task ID must match pattern TASK-XXX where XXX is a number`]);
        }
        
        // Extract numeric ID from TASK-XXX format
        const numericId = parseInt(taskStringId.replace('TASK-', ''), 10);
        return this.getTaskById(db, numericId);
    }

    /**
     * Enrich task with related data
     */
    enrichTask(db, task) {
        // Add string ID
        task.string_id = `TASK-${task.id.toString().padStart(3, '0')}`;
        
        // Get dependencies
        const depsStmt = db.prepare(`
            SELECT td.*, t.name as depends_on_name 
            FROM task_dependencies td
            JOIN tasks t ON td.depends_on_id = t.id
            WHERE td.task_id = ?
        `);
        task.dependencies = depsStmt.all(task.id);

        // Get dependents (tasks that depend on this one)
        const dependentsStmt = db.prepare(`
            SELECT td.*, t.name as dependent_name 
            FROM task_dependencies td
            JOIN tasks t ON td.task_id = t.id
            WHERE td.depends_on_id = ?
        `);
        task.dependents = dependentsStmt.all(task.id);

        // Get recent notes (last 5)
        const notesStmt = db.prepare(`
            SELECT * FROM task_notes 
            WHERE task_id = ? 
            ORDER BY created_at DESC 
            LIMIT 5
        `);
        task.recent_notes = notesStmt.all(task.id);

        // Get keywords
        const keywordsStmt = db.prepare('SELECT keyword, keyword_type FROM task_keywords WHERE task_id = ?');
        task.keywords = keywordsStmt.all(task.id);

        return task;
    }

    /**
     * Add a timeline note
     */
    addTimelineNote(db, taskId, note, type = 'system', author = null) {
        const noteStmt = db.prepare(`
            INSERT INTO task_notes (task_id, note, note_type, author, created_at)
            VALUES (?, ?, ?, ?, ?)
        `);
        
        noteStmt.run(taskId, note, type, author, this.now());
    }

    /**
     * Record task changes in timeline
     */
    recordTaskChanges(db, taskId, changes, author = null) {
        for (const change of changes) {
            let note;
            
            switch (change.field) {
                case 'status':
                    note = `Status changed from "${change.oldValue}" to "${change.newValue}"`;
                    break;
                case 'priority':
                    note = `Priority changed from "${change.oldValue}" to "${change.newValue}"`;
                    break;
                case 'assignee':
                    note = `Assignee changed from "${change.oldValue || 'none'}" to "${change.newValue || 'none'}"`;
                    break;
                case 'progress':
                    note = `Progress updated from ${change.oldValue}% to ${change.newValue}%`;
                    break;
                default:
                    note = `${change.field} updated`;
            }
            
            this.addTimelineNote(db, taskId, note, 'state_change', author);
        }
    }
}

export default TaskAPI;