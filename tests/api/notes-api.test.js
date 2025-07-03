/**
 * Tests for TaskWerk v3 Notes and Timeline API
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { join } from 'path';
import { unlinkSync, existsSync } from 'fs';
import { NotesAPI } from '../../src/api/notes-api.js';
import { TaskAPI } from '../../src/api/task-api.js';
import { APIError, ValidationError } from '../../src/api/base-api.js';

describe('Notes API', () => {
    let notesAPI;
    let taskAPI;
    let dbPath;
    let testTask;

    beforeEach(async () => {
        // Use temporary database for each test
        dbPath = join('/tmp', `taskwerk-notes-test-${Date.now()}.db`);
        notesAPI = new NotesAPI(dbPath);
        taskAPI = new TaskAPI(dbPath);
        await notesAPI.initialize();

        // Create a test task
        testTask = await taskAPI.createTask({
            name: 'Test Task',
            description: 'A task for testing notes',
            priority: 'medium'
        });
    });

    afterEach(() => {
        // Clean up test database
        if (notesAPI) {
            notesAPI.close();
        }
        if (existsSync(dbPath)) {
            unlinkSync(dbPath);
        }
    });

    describe('Note Creation', () => {
        test('should add a comment note', async () => {
            const note = await notesAPI.addNote(
                testTask.id,
                'This is a test comment',
                'comment',
                { user: 'test@example.com' }
            );

            assert.ok(note);
            assert.strictEqual(note.task_id, testTask.id);
            assert.strictEqual(note.note, 'This is a test comment');
            assert.strictEqual(note.note_type, 'comment');
            assert.strictEqual(note.author, 'test@example.com');
            assert.ok(note.created_at);
            assert.strictEqual(note.task_name, 'Test Task');
            assert.ok(note.task_string_id);
        });

        test('should add a system note', async () => {
            const note = await notesAPI.addNote(
                testTask.id,
                'Task status changed',
                'system'
            );

            assert.strictEqual(note.note_type, 'system');
            assert.strictEqual(note.author, 'system');
        });

        test('should validate note types', async () => {
            await assert.rejects(
                async () => await notesAPI.addNote(
                    testTask.id,
                    'Invalid note',
                    'invalid_type'
                ),
                ValidationError
            );
        });

        test('should require note content', async () => {
            await assert.rejects(
                async () => await notesAPI.addNote(
                    testTask.id,
                    '',
                    'comment'
                ),
                ValidationError
            );
        });

        test('should validate task existence', async () => {
            await assert.rejects(
                async () => await notesAPI.addNote(
                    99999,
                    'Note for non-existent task',
                    'comment'
                ),
                APIError
            );
        });

        test('should handle long notes', async () => {
            const longNote = 'a'.repeat(1000);
            const note = await notesAPI.addNote(testTask.id, longNote, 'comment');
            
            assert.strictEqual(note.note, longNote);
        });
    });

    describe('Note Retrieval', () => {
        beforeEach(async () => {
            // Add various notes for testing
            await notesAPI.addNote(testTask.id, 'Comment 1', 'comment', { user: 'user1@example.com' });
            await notesAPI.addNote(testTask.id, 'State change', 'state_change', { user: 'system' });
            await notesAPI.addNote(testTask.id, 'Comment 2', 'comment', { user: 'user2@example.com' });
            await notesAPI.addNote(testTask.id, 'Decision made', 'decision', { user: 'user1@example.com' });
            await notesAPI.addNote(testTask.id, 'System event', 'system', { user: 'system' });
        });

        test('should get all notes for a task', async () => {
            const result = await notesAPI.getNotes(testTask.id);

            assert.strictEqual(result.task_id, testTask.id);
            assert.strictEqual(result.task_name, 'Test Task');
            assert.ok(result.task_string_id);
            assert.strictEqual(result.notes.length, 6); // 5 test notes + 1 system note from task creation
            assert.strictEqual(result.pagination.total, 6);
            assert.strictEqual(result.pagination.has_more, false);
        });

        test('should filter notes by type', async () => {
            const result = await notesAPI.getNotes(testTask.id, { noteType: 'comment' });

            assert.strictEqual(result.notes.length, 2);
            assert.ok(result.notes.every(note => note.note_type === 'comment'));
            assert.strictEqual(result.filters.note_type, 'comment');
        });

        test('should filter notes by author', async () => {
            const result = await notesAPI.getNotes(testTask.id, { author: 'user1@example.com' });

            assert.strictEqual(result.notes.length, 2);
            assert.ok(result.notes.every(note => note.author === 'user1@example.com'));
            assert.strictEqual(result.filters.author, 'user1@example.com');
        });

        test('should paginate notes', async () => {
            const page1 = await notesAPI.getNotes(testTask.id, { limit: 2, offset: 0 });
            const page2 = await notesAPI.getNotes(testTask.id, { limit: 2, offset: 2 });

            assert.strictEqual(page1.notes.length, 2);
            assert.strictEqual(page2.notes.length, 2);
            assert.strictEqual(page1.pagination.has_more, true);
            assert.notDeepStrictEqual(page1.notes[0].id, page2.notes[0].id);
        });

        test('should order notes by creation date descending', async () => {
            const result = await notesAPI.getNotes(testTask.id);

            // Should be ordered by creation date descending
            // Since all test notes might have the same timestamp, we check that we have all notes
            assert.strictEqual(result.notes.length, 6);
            // The task creation system note should be last (oldest)
            assert.strictEqual(result.notes[5].note, 'Task created');
            assert.strictEqual(result.notes[5].note_type, 'system');
        });

        test('should order notes ascending when specified', async () => {
            const result = await notesAPI.getNotes(testTask.id, { orderDir: 'ASC' });

            // When ordered ascending, the task creation note should be first (oldest)
            assert.strictEqual(result.notes[0].note, 'Task created');
            assert.strictEqual(result.notes[0].note_type, 'system');
            assert.strictEqual(result.notes.length, 6);
        });
    });

    describe('Note Updates', () => {
        let testNote;

        beforeEach(async () => {
            testNote = await notesAPI.addNote(testTask.id, 'Original note', 'comment');
        });

        test('should update note content', async () => {
            const updated = await notesAPI.updateNote(testNote.id, {
                note: 'Updated note content'
            });

            assert.strictEqual(updated.id, testNote.id);
            assert.strictEqual(updated.note, 'Updated note content');
            assert.strictEqual(updated.note_type, 'comment');
            assert.ok(updated.updated_at);
        });

        test('should update note type', async () => {
            const updated = await notesAPI.updateNote(testNote.id, {
                note_type: 'decision'
            });

            assert.strictEqual(updated.note_type, 'decision');
            assert.strictEqual(updated.note, 'Original note');
        });

        test('should validate updated note type', async () => {
            await assert.rejects(
                async () => await notesAPI.updateNote(testNote.id, {
                    note_type: 'invalid_type'
                }),
                ValidationError
            );
        });

        test('should not allow empty note content', async () => {
            await assert.rejects(
                async () => await notesAPI.updateNote(testNote.id, {
                    note: ''
                }),
                ValidationError
            );
        });

        test('should handle non-existent note', async () => {
            await assert.rejects(
                async () => await notesAPI.updateNote(99999, {
                    note: 'Updated'
                }),
                APIError
            );
        });

        test('should record update in timeline', async () => {
            await notesAPI.updateNote(testNote.id, {
                note: 'Updated note'
            }, { user: 'updater@example.com' });

            const task = await taskAPI.getTask(testTask.id);
            const updateNote = task.recent_notes.find(note => 
                note.note_type === 'state_change' && note.note.includes('Updated note')
            );
            
            assert.ok(updateNote);
            assert.strictEqual(updateNote.author, 'updater@example.com');
        });
    });

    describe('Note Deletion', () => {
        let testNote;
        let systemNote;

        beforeEach(async () => {
            testNote = await notesAPI.addNote(testTask.id, 'Delete me', 'comment');
            systemNote = await notesAPI.addNote(testTask.id, 'System note', 'system');
        });

        test('should delete a note', async () => {
            const result = await notesAPI.deleteNote(testNote.id);

            assert.strictEqual(result.success, true);
            assert.ok(result.deleted_note);
            assert.strictEqual(result.deleted_note.id, testNote.id);
            assert.ok(result.deleted_at);

            // Verify note is deleted
            const notes = await notesAPI.getNotes(testTask.id);
            assert.ok(!notes.notes.find(n => n.id === testNote.id));
        });

        test('should not delete system notes', async () => {
            await assert.rejects(
                async () => await notesAPI.deleteNote(systemNote.id),
                ValidationError
            );
        });

        test('should handle non-existent note', async () => {
            await assert.rejects(
                async () => await notesAPI.deleteNote(99999),
                APIError
            );
        });

        test('should record deletion in timeline', async () => {
            await notesAPI.deleteNote(testNote.id, { user: 'deleter@example.com' });

            const task = await taskAPI.getTask(testTask.id);
            const deleteNote = task.recent_notes.find(note => 
                note.note.includes('Deleted') && note.note.includes('comment')
            );
            
            assert.ok(deleteNote);
            assert.strictEqual(deleteNote.author, 'deleter@example.com');
        });
    });

    describe('Timeline', () => {
        beforeEach(async () => {
            // Create notes over different dates
            const now = new Date();
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const lastWeek = new Date(now);
            lastWeek.setDate(lastWeek.getDate() - 7);

            await notesAPI.bulkAddNotes([
                { task_id: testTask.id, note: 'Last week note', note_type: 'comment', created_at: lastWeek.toISOString() },
                { task_id: testTask.id, note: 'Yesterday note', note_type: 'state_change', created_at: yesterday.toISOString() },
                { task_id: testTask.id, note: 'Today note', note_type: 'comment', created_at: now.toISOString() }
            ]);
        });

        test('should get complete timeline', async () => {
            const timeline = await notesAPI.getTimeline(testTask.id);

            assert.ok(timeline.task);
            assert.strictEqual(timeline.task.id, testTask.id);
            assert.ok(timeline.timeline.events.length >= 3);
            assert.ok(timeline.timeline.events_by_date);
            assert.ok(timeline.timeline.total_events >= 3);
        });

        test('should filter timeline by date range', async () => {
            const now = new Date();
            const twoDaysAgo = new Date(now);
            twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

            const timeline = await notesAPI.getTimeline(testTask.id, {
                startDate: twoDaysAgo.toISOString()
            });

            // Should only include yesterday and today notes
            assert.ok(timeline.timeline.events.length >= 2);
            assert.ok(!timeline.timeline.events.find(e => e.note === 'Last week note'));
        });

        test('should filter timeline by note types', async () => {
            const timeline = await notesAPI.getTimeline(testTask.id, {
                types: ['comment']
            });

            assert.ok(timeline.timeline.events.every(e => e.note_type === 'comment'));
        });

        test('should group events by date', async () => {
            const timeline = await notesAPI.getTimeline(testTask.id);

            assert.ok(timeline.timeline.events_by_date);
            const dates = Object.keys(timeline.timeline.events_by_date);
            assert.ok(dates.length >= 2); // At least 2 different dates
        });
    });

    describe('Activity Summary', () => {
        beforeEach(async () => {
            // Create various activities
            await notesAPI.addNote(testTask.id, 'Comment 1', 'comment', { user: 'user1@example.com' });
            await notesAPI.addNote(testTask.id, 'State change 1', 'state_change', { user: 'system' });
            await notesAPI.addNote(testTask.id, 'Comment 2', 'comment', { user: 'user2@example.com' });
            await notesAPI.addNote(testTask.id, 'State change 2', 'state_change', { user: 'system' });
            await notesAPI.addNote(testTask.id, 'Comment 3', 'comment', { user: 'user1@example.com' });
        });

        test('should get activity summary', async () => {
            const summary = await notesAPI.getActivitySummary(testTask.id);

            assert.ok(summary.task);
            assert.strictEqual(summary.task.id, testTask.id);
            assert.ok(summary.summary);
            assert.strictEqual(summary.summary.period_days, 30);
            assert.ok(summary.summary.activity_by_type);
            assert.ok(summary.summary.activity_by_author);
            assert.ok(summary.summary.daily_activity);
            assert.ok(summary.summary.recent_events);
            assert.ok(summary.summary.total_events >= 5);
        });

        test('should count activities by type', async () => {
            const summary = await notesAPI.getActivitySummary(testTask.id);

            const commentActivity = summary.summary.activity_by_type.find(a => a.note_type === 'comment');
            const stateChangeActivity = summary.summary.activity_by_type.find(a => a.note_type === 'state_change');

            assert.ok(commentActivity);
            assert.strictEqual(commentActivity.count, 3);
            assert.ok(stateChangeActivity);
            assert.strictEqual(stateChangeActivity.count, 2);
        });

        test('should count activities by author', async () => {
            const summary = await notesAPI.getActivitySummary(testTask.id);

            const user1Activity = summary.summary.activity_by_author.find(a => a.author === 'user1@example.com');
            const systemActivity = summary.summary.activity_by_author.find(a => a.author === 'system');

            assert.ok(user1Activity);
            assert.strictEqual(user1Activity.count, 2);
            assert.ok(systemActivity);
            assert.strictEqual(systemActivity.count, 2);
        });

        test('should respect period parameter', async () => {
            const summary = await notesAPI.getActivitySummary(testTask.id, 7);

            assert.strictEqual(summary.summary.period_days, 7);
            assert.ok(summary.summary.start_date);
        });
    });

    describe('Bulk Operations', () => {
        test('should bulk add notes', async () => {
            const notes = [
                { task_id: testTask.id, note: 'Bulk note 1', note_type: 'comment' },
                { task_id: testTask.id, note: 'Bulk note 2', note_type: 'state_change' },
                { task_id: testTask.id, note: 'Bulk note 3', note_type: 'decision' }
            ];

            const result = await notesAPI.bulkAddNotes(notes);

            assert.strictEqual(result.total, 3);
            assert.strictEqual(result.created.length, 3);
            assert.strictEqual(result.failed.length, 0);

            // Verify notes were created
            const allNotes = await notesAPI.getNotes(testTask.id);
            assert.ok(allNotes.notes.length >= 3);
        });

        test('should handle failures in bulk operations', async () => {
            const notes = [
                { task_id: testTask.id, note: 'Valid note', note_type: 'comment' },
                { task_id: 99999, note: 'Invalid task', note_type: 'comment' },
                { task_id: testTask.id, note: '', note_type: 'comment' }, // Empty note
                { task_id: testTask.id, note: 'Another valid', note_type: 'comment' }
            ];

            const result = await notesAPI.bulkAddNotes(notes);

            assert.strictEqual(result.total, 4);
            assert.strictEqual(result.created.length, 2);
            assert.strictEqual(result.failed.length, 2);
            
            // Check failure reasons
            assert.ok(result.failed.find(f => f.error.includes('not found')));
            assert.ok(result.failed.find(f => f.error.includes('at least 1 characters')));
        });

        test('should preserve timestamps in bulk operations', async () => {
            const customDate = new Date('2023-01-01').toISOString();
            const notes = [
                { task_id: testTask.id, note: 'Historical note', note_type: 'comment', created_at: customDate }
            ];

            const result = await notesAPI.bulkAddNotes(notes);

            assert.strictEqual(result.created.length, 1);

            const allNotes = await notesAPI.getNotes(testTask.id);
            const historicalNote = allNotes.notes.find(n => n.note === 'Historical note');
            assert.ok(historicalNote);
            assert.strictEqual(historicalNote.created_at, customDate);
        });
    });

    describe('Edge Cases', () => {
        test('should handle invalid task ID formats', async () => {
            await assert.rejects(
                async () => await notesAPI.addNote('invalid-id', 'Note', 'comment'),
                ValidationError
            );

            await assert.rejects(
                async () => await notesAPI.getNotes('not-a-number'),
                ValidationError
            );
        });

        test('should handle long author names within limit', async () => {
            const longAuthor = 'a'.repeat(100); // Max length is 100
            const note = await notesAPI.addNote(testTask.id, 'Note', 'comment', { user: longAuthor });
            
            assert.strictEqual(note.author, longAuthor);
        });

        test('should reject author names exceeding limit', async () => {
            const tooLongAuthor = 'a'.repeat(101);
            await assert.rejects(
                async () => await notesAPI.addNote(testTask.id, 'Note', 'comment', { user: tooLongAuthor }),
                ValidationError
            );
        });

        test('should handle concurrent note additions', async () => {
            const promises = [];
            for (let i = 0; i < 10; i++) {
                promises.push(notesAPI.addNote(testTask.id, `Concurrent note ${i}`, 'comment'));
            }

            const results = await Promise.all(promises);
            assert.strictEqual(results.length, 10);

            const allNotes = await notesAPI.getNotes(testTask.id);
            assert.ok(allNotes.notes.length >= 10);
        });

        test('should handle timeline with only system notes', async () => {
            // Create new task (which adds a system note)
            const emptyTask = await taskAPI.createTask({
                name: 'Empty Task',
                description: 'Task with only system notes'
            });

            const timeline = await notesAPI.getTimeline(emptyTask.id);

            assert.strictEqual(timeline.timeline.events.length, 1);
            assert.strictEqual(timeline.timeline.total_events, 1);
            assert.strictEqual(timeline.timeline.events[0].note_type, 'system');
            assert.strictEqual(timeline.timeline.events[0].note, 'Task created');
        });
    });
});