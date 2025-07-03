/**
 * TaskWerk v3 Notes and Timeline API
 * 
 * Provides comprehensive note management and timeline generation for tasks,
 * including auto-tracking of state changes and user-created notes.
 */

import { BaseAPI, APIError, ValidationError } from './base-api.js';
import { TaskNoteSchema } from './validation.js';
import { validateTaskId } from './validation.js';

/**
 * Notes and Timeline API class
 */
export class NotesAPI extends BaseAPI {
    constructor(dbPath = null) {
        super(dbPath);
    }

    /**
     * Add a note to a task
     */
    async addNote(taskId, note, noteType = 'comment', context = {}) {
        // Validate task ID format
        if (!validateTaskId(taskId)) {
            throw new ValidationError('Invalid task ID format', ['Task ID must be a positive integer or string']);
        }

        await this.getDatabase();
        
        return await this.transaction((db) => {
            // Check if task exists
            const task = this.getTaskInfo(db, taskId);
            if (!task) {
                throw new APIError(`Task with ID ${taskId} not found`, 'TASK_NOT_FOUND');
            }

            // Validate note data
            const noteData = {
                task_id: task.id,
                note: note,
                note_type: noteType,
                author: context.user || 'system'
            };

            this.validate(noteData, TaskNoteSchema);

            // Insert note
            const stmt = db.prepare(`
                INSERT INTO task_notes (task_id, note, note_type, author, created_at)
                VALUES (?, ?, ?, ?, ?)
            `);

            const result = stmt.run(
                task.id,
                noteData.note,
                noteData.note_type,
                noteData.author,
                this.now()
            );

            // Get the created note
            const createdNote = db.prepare(`
                SELECT * FROM task_notes WHERE id = ?
            `).get(result.lastInsertRowid);


            return {
                ...createdNote,
                task_name: task.name,
                task_string_id: `TASK-${String(task.id).padStart(3, '0')}`
            };
        });
    }

    /**
     * Get notes for a task
     */
    async getNotes(taskId, options = {}) {
        const {
            noteType = null,
            author = null,
            limit = 50,
            offset = 0,
            orderBy = 'created_at',
            orderDir = 'DESC'
        } = options;

        // Validate task ID
        if (!validateTaskId(taskId)) {
            throw new ValidationError('Invalid task ID format', ['Task ID must be a positive integer or string']);
        }

        const db = await this.getDatabase();
        
        // Check if task exists
        const task = this.getTaskInfo(db, taskId);
        if (!task) {
            throw new APIError(`Task with ID ${taskId} not found`, 'TASK_NOT_FOUND');
        }

        // Build query
        let query = 'SELECT * FROM task_notes WHERE task_id = ?';
        const params = [task.id];

        if (noteType) {
            query += ' AND note_type = ?';
            params.push(noteType);
        }

        if (author) {
            query += ' AND author = ?';
            params.push(author);
        }

        // Validate order column
        const validOrderColumns = ['created_at', 'note_type', 'author'];
        if (!validOrderColumns.includes(orderBy)) {
            throw new ValidationError('Invalid order column', [`Must be one of: ${validOrderColumns.join(', ')}`]);
        }

        query += ` ORDER BY ${orderBy} ${orderDir === 'ASC' ? 'ASC' : 'DESC'}, id ${orderDir === 'ASC' ? 'ASC' : 'DESC'}`;
        query += ' LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const notes = db.prepare(query).all(...params);

        // Get total count
        let countQuery = 'SELECT COUNT(*) as count FROM task_notes WHERE task_id = ?';
        const countParams = [task.id];

        if (noteType) {
            countQuery += ' AND note_type = ?';
            countParams.push(noteType);
        }

        if (author) {
            countQuery += ' AND author = ?';
            countParams.push(author);
        }

        const { count } = db.prepare(countQuery).get(...countParams);

        return {
            task_id: task.id,
            task_name: task.name,
            task_string_id: `TASK-${String(task.id).padStart(3, '0')}`,
            notes: notes,
            pagination: {
                total: count,
                limit: limit,
                offset: offset,
                has_more: offset + notes.length < count
            },
            filters: {
                note_type: noteType,
                author: author
            }
        };
    }

    /**
     * Update a note
     */
    async updateNote(noteId, updates, context = {}) {
        await this.getDatabase();
        
        return await this.transaction((db) => {
            // Get existing note
            const existingNote = db.prepare('SELECT * FROM task_notes WHERE id = ?').get(noteId);
            
            if (!existingNote) {
                throw new APIError(`Note with ID ${noteId} not found`, 'NOTE_NOT_FOUND');
            }

            // Only allow updating the note content and type
            const allowedUpdates = ['note', 'note_type'];
            const updateData = {};
            
            for (const field of allowedUpdates) {
                if (updates[field] !== undefined) {
                    updateData[field] = updates[field];
                }
            }

            if (Object.keys(updateData).length === 0) {
                throw new ValidationError('No valid updates provided', ['Allowed fields: note, note_type']);
            }

            // Validate updated data
            const validatedData = {
                task_id: existingNote.task_id,
                note: updateData.note !== undefined ? updateData.note : existingNote.note,
                note_type: updateData.note_type !== undefined ? updateData.note_type : existingNote.note_type,
                author: existingNote.author
            };

            this.validate(validatedData, TaskNoteSchema);

            // Build update query
            const updateFields = Object.keys(updateData).map(field => `${field} = ?`);
            const updateValues = Object.values(updateData);
            updateValues.push(this.now(), noteId);

            const updateStmt = db.prepare(`
                UPDATE task_notes 
                SET ${updateFields.join(', ')}, updated_at = ?
                WHERE id = ?
            `);

            updateStmt.run(...updateValues);

            // Get updated note
            const updatedNote = db.prepare('SELECT * FROM task_notes WHERE id = ?').get(noteId);

            // Add timeline note for the update
            this.addTimelineNote(
                db, 
                existingNote.task_id, 
                `Updated note: "${updatedNote.note.substring(0, 50)}${updatedNote.note.length > 50 ? '...' : ''}"`,
                'state_change',
                context.user || 'system'
            );

            return updatedNote;
        });
    }

    /**
     * Delete a note
     */
    async deleteNote(noteId, context = {}) {
        await this.getDatabase();
        
        return await this.transaction((db) => {
            // Get note details before deletion
            const note = db.prepare('SELECT * FROM task_notes WHERE id = ?').get(noteId);
            
            if (!note) {
                throw new APIError(`Note with ID ${noteId} not found`, 'NOTE_NOT_FOUND');
            }

            // System notes cannot be deleted
            if (note.note_type === 'system') {
                throw new ValidationError('Cannot delete system notes', ['System-generated notes are part of the audit trail']);
            }

            // Delete the note
            const deleteStmt = db.prepare('DELETE FROM task_notes WHERE id = ?');
            const result = deleteStmt.run(noteId);

            if (result.changes === 0) {
                throw new APIError('Failed to delete note', 'DELETE_FAILED');
            }

            // Add timeline note for deletion
            this.addTimelineNote(
                db,
                note.task_id,
                `Deleted ${note.note_type} note: "${note.note.substring(0, 30)}${note.note.length > 30 ? '...' : ''}"`,
                'state_change',
                context.user || 'system'
            );

            return {
                success: true,
                deleted_note: note,
                deleted_at: this.now()
            };
        });
    }

    /**
     * Get task timeline (all notes ordered chronologically)
     */
    async getTimeline(taskId, options = {}) {
        const {
            startDate = null,
            endDate = null,
            types = null, // Array of note types to include
            limit = 100,
            offset = 0
        } = options;

        // Validate task ID
        if (!validateTaskId(taskId)) {
            throw new ValidationError('Invalid task ID format', ['Task ID must be a positive integer or string']);
        }

        const db = await this.getDatabase();
        
        // Check if task exists
        const task = this.getTaskInfo(db, taskId);
        if (!task) {
            throw new APIError(`Task with ID ${taskId} not found`, 'TASK_NOT_FOUND');
        }

        // Build timeline query
        let query = `
            SELECT 
                id,
                note,
                note_type,
                author,
                created_at,
                updated_at
            FROM task_notes 
            WHERE task_id = ?
        `;
        const params = [task.id];

        if (startDate) {
            query += ' AND created_at >= ?';
            params.push(startDate);
        }

        if (endDate) {
            query += ' AND created_at <= ?';
            params.push(endDate);
        }

        if (types && Array.isArray(types) && types.length > 0) {
            const placeholders = types.map(() => '?').join(', ');
            query += ` AND note_type IN (${placeholders})`;
            params.push(...types);
        }

        query += ' ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const events = db.prepare(query).all(...params);

        // Get total count for pagination
        let countQuery = 'SELECT COUNT(*) as count FROM task_notes WHERE task_id = ?';
        const countParams = [task.id];

        if (startDate) {
            countQuery += ' AND created_at >= ?';
            countParams.push(startDate);
        }

        if (endDate) {
            countQuery += ' AND created_at <= ?';
            countParams.push(endDate);
        }

        if (types && Array.isArray(types) && types.length > 0) {
            const placeholders = types.map(() => '?').join(', ');
            countQuery += ` AND note_type IN (${placeholders})`;
            countParams.push(...types);
        }

        const { count } = db.prepare(countQuery).get(...countParams);

        // Group events by date for easier visualization
        const eventsByDate = {};
        for (const event of events) {
            const date = event.created_at.split('T')[0];
            if (!eventsByDate[date]) {
                eventsByDate[date] = [];
            }
            eventsByDate[date].push(event);
        }

        return {
            task: {
                id: task.id,
                string_id: `TASK-${String(task.id).padStart(3, '0')}`,
                name: task.name,
                status: task.status,
                created_at: task.created_at,
                updated_at: task.updated_at
            },
            timeline: {
                events: events,
                events_by_date: eventsByDate,
                total_events: count,
                pagination: {
                    limit: limit,
                    offset: offset,
                    has_more: offset + events.length < count
                }
            },
            filters: {
                start_date: startDate,
                end_date: endDate,
                types: types
            }
        };
    }

    /**
     * Get activity summary for a task
     */
    async getActivitySummary(taskId, days = 30) {
        const db = await this.getDatabase();
        
        // Check if task exists
        const task = this.getTaskInfo(db, taskId);
        if (!task) {
            throw new APIError(`Task with ID ${taskId} not found`, 'TASK_NOT_FOUND');
        }

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Get activity counts by type
        const activityByType = db.prepare(`
            SELECT 
                note_type,
                COUNT(*) as count
            FROM task_notes
            WHERE task_id = ? AND created_at >= ?
            GROUP BY note_type
            ORDER BY count DESC
        `).all(task.id, startDate.toISOString());

        // Get activity by author
        const activityByAuthor = db.prepare(`
            SELECT 
                author,
                COUNT(*) as count
            FROM task_notes
            WHERE task_id = ? AND created_at >= ?
            GROUP BY author
            ORDER BY count DESC
        `).all(task.id, startDate.toISOString());

        // Get daily activity
        const dailyActivity = db.prepare(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as count
            FROM task_notes
            WHERE task_id = ? AND created_at >= ?
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        `).all(task.id, startDate.toISOString());

        // Get recent events
        const recentEvents = db.prepare(`
            SELECT 
                note,
                note_type,
                author,
                created_at
            FROM task_notes
            WHERE task_id = ?
            ORDER BY created_at DESC
            LIMIT 10
        `).all(task.id);

        return {
            task: {
                id: task.id,
                string_id: `TASK-${String(task.id).padStart(3, '0')}`,
                name: task.name,
                status: task.status
            },
            summary: {
                period_days: days,
                start_date: startDate.toISOString(),
                activity_by_type: activityByType,
                activity_by_author: activityByAuthor,
                daily_activity: dailyActivity,
                recent_events: recentEvents,
                total_events: activityByType.reduce((sum, item) => sum + item.count, 0)
            }
        };
    }

    /**
     * Bulk add notes (useful for imports or batch operations)
     */
    async bulkAddNotes(notes, context = {}) {
        await this.getDatabase();
        
        return await this.transaction((db) => {
            const results = {
                created: [],
                failed: [],
                total: notes.length
            };

            const stmt = db.prepare(`
                INSERT INTO task_notes (task_id, note, note_type, author, created_at)
                VALUES (?, ?, ?, ?, ?)
            `);

            for (const noteData of notes) {
                try {
                    // Validate task exists
                    const task = this.getTaskInfo(db, noteData.task_id);
                    if (!task) {
                        results.failed.push({
                            data: noteData,
                            error: `Task ${noteData.task_id} not found`
                        });
                        continue;
                    }

                    // Validate note data
                    const validatedNote = {
                        task_id: task.id,
                        note: noteData.note,
                        note_type: noteData.note_type || 'comment',
                        author: noteData.author || context.user || 'system'
                    };

                    this.validate(validatedNote, TaskNoteSchema);

                    // Insert note
                    const result = stmt.run(
                        validatedNote.task_id,
                        validatedNote.note,
                        validatedNote.note_type,
                        validatedNote.author,
                        noteData.created_at || this.now()
                    );

                    results.created.push({
                        id: result.lastInsertRowid,
                        task_id: task.id,
                        task_string_id: `TASK-${String(task.id).padStart(3, '0')}`
                    });

                } catch (error) {
                    let errorMessage = error.message;
                    if (error.name === 'ValidationError' && error.errors && error.errors.length > 0) {
                        errorMessage = error.errors.join(', ');
                    }
                    results.failed.push({
                        data: noteData,
                        error: errorMessage
                    });
                }
            }

            return results;
        });
    }
}

export default NotesAPI;