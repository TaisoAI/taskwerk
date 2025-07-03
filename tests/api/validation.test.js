/**
 * Tests for TaskWerk v3 Validation Framework
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
    TaskSchema,
    TaskDependencySchema,
    TaskNoteSchema,
    TaskFileSchema,
    TaskKeywordSchema,
    ListTasksQuerySchema,
    SearchQuerySchema,
    validateTaskId,
    validateNoCycles,
    validateDate,
    validateFilePath,
    sanitizeSearchQuery,
    validateBulk,
    TASK_STATUSES,
    TASK_PRIORITIES
} from '../../src/api/validation.js';

describe('Validation Framework', () => {
    describe('Schema Constants', () => {
        test('should have valid task statuses', () => {
            assert.ok(Array.isArray(TASK_STATUSES));
            assert.ok(TASK_STATUSES.includes('todo'));
            assert.ok(TASK_STATUSES.includes('in_progress'));
            assert.ok(TASK_STATUSES.includes('completed'));
            assert.ok(TASK_STATUSES.includes('blocked'));
            assert.ok(TASK_STATUSES.includes('archived'));
            assert.ok(TASK_STATUSES.includes('error'));
        });

        test('should have valid task priorities', () => {
            assert.ok(Array.isArray(TASK_PRIORITIES));
            assert.ok(TASK_PRIORITIES.includes('high'));
            assert.ok(TASK_PRIORITIES.includes('medium'));
            assert.ok(TASK_PRIORITIES.includes('low'));
        });
    });

    describe('Task Schema', () => {
        test('should require name field', () => {
            assert.ok(Array.isArray(TaskSchema.required));
            assert.ok(TaskSchema.required.includes('name'));
        });

        test('should have proper field definitions', () => {
            assert.ok(TaskSchema.properties.name);
            assert.strictEqual(TaskSchema.properties.name.type, 'string');
            assert.strictEqual(TaskSchema.properties.name.minLength, 1);
            assert.strictEqual(TaskSchema.properties.name.maxLength, 200);

            assert.ok(TaskSchema.properties.status);
            assert.deepStrictEqual(TaskSchema.properties.status.enum, TASK_STATUSES);

            assert.ok(TaskSchema.properties.priority);
            assert.deepStrictEqual(TaskSchema.properties.priority.enum, TASK_PRIORITIES);

            assert.ok(TaskSchema.properties.progress);
            assert.strictEqual(TaskSchema.properties.progress.min, 0);
            assert.strictEqual(TaskSchema.properties.progress.max, 100);
        });
    });

    describe('Task Dependency Schema', () => {
        test('should require task IDs', () => {
            assert.ok(TaskDependencySchema.required.includes('task_id'));
            assert.ok(TaskDependencySchema.required.includes('depends_on_id'));
        });

        test('should validate dependency type', () => {
            const depType = TaskDependencySchema.properties.dependency_type;
            assert.ok(depType.enum.includes('blocks'));
            assert.ok(depType.enum.includes('requires'));
        });
    });

    describe('Task Note Schema', () => {
        test('should require task_id and note', () => {
            assert.ok(TaskNoteSchema.required.includes('task_id'));
            assert.ok(TaskNoteSchema.required.includes('note'));
        });

        test('should validate note types', () => {
            const noteType = TaskNoteSchema.properties.note_type;
            assert.ok(noteType.enum.includes('comment'));
            assert.ok(noteType.enum.includes('state_change'));
            assert.ok(noteType.enum.includes('decision'));
            assert.ok(noteType.enum.includes('reminder'));
            assert.ok(noteType.enum.includes('system'));
        });
    });

    describe('Task File Schema', () => {
        test('should require task_id and file_path', () => {
            assert.ok(TaskFileSchema.required.includes('task_id'));
            assert.ok(TaskFileSchema.required.includes('file_path'));
        });

        test('should validate file actions', () => {
            const fileAction = TaskFileSchema.properties.file_action;
            assert.ok(fileAction.enum.includes('created'));
            assert.ok(fileAction.enum.includes('modified'));
            assert.ok(fileAction.enum.includes('deleted'));
            assert.ok(fileAction.enum.includes('renamed'));
        });
    });

    describe('Task Keyword Schema', () => {
        test('should require task_id and keyword', () => {
            assert.ok(TaskKeywordSchema.required.includes('task_id'));
            assert.ok(TaskKeywordSchema.required.includes('keyword'));
        });

        test('should validate keyword format', () => {
            const keywordProp = TaskKeywordSchema.properties.keyword;
            assert.strictEqual(typeof keywordProp.validate, 'function');
            
            // Test valid keywords
            assert.strictEqual(keywordProp.validate('valid-keyword'), null);
            assert.strictEqual(keywordProp.validate('valid_keyword'), null);
            assert.strictEqual(keywordProp.validate('validKeyword123'), null);
            
            // Test invalid keywords
            assert.ok(keywordProp.validate('invalid keyword'));
            assert.ok(keywordProp.validate('invalid@keyword'));
            assert.ok(keywordProp.validate('invalid.keyword'));
        });

        test('should validate keyword types', () => {
            const keywordType = TaskKeywordSchema.properties.keyword_type;
            assert.ok(keywordType.enum.includes('tag'));
            assert.ok(keywordType.enum.includes('category'));
            assert.ok(keywordType.enum.includes('component'));
            assert.ok(keywordType.enum.includes('technology'));
        });
    });

    describe('Query Schemas', () => {
        test('should validate list tasks query parameters', () => {
            assert.ok(ListTasksQuerySchema.properties.status);
            assert.ok(ListTasksQuerySchema.properties.priority);
            assert.ok(ListTasksQuerySchema.properties.limit);
            
            const limit = ListTasksQuerySchema.properties.limit;
            assert.strictEqual(limit.min, 1);
            assert.strictEqual(limit.max, 1000);
            
            const sortBy = ListTasksQuerySchema.properties.sortBy;
            assert.ok(sortBy.enum.includes('id'));
            assert.ok(sortBy.enum.includes('name'));
            assert.ok(sortBy.enum.includes('status'));
            assert.ok(sortBy.enum.includes('priority'));
        });

        test('should validate search query parameters', () => {
            assert.ok(SearchQuerySchema.required.includes('query'));
            
            const query = SearchQuerySchema.properties.query;
            assert.strictEqual(query.minLength, 1);
            assert.strictEqual(query.maxLength, 200);
        });
    });

    describe('Validation Functions', () => {
        test('should validate task ID format', () => {
            // Valid task IDs
            assert.strictEqual(validateTaskId('TASK-001'), true);
            assert.strictEqual(validateTaskId('TASK-123'), true);
            assert.strictEqual(validateTaskId('TASK-999999'), true);
            assert.strictEqual(validateTaskId(123), true); // Numeric IDs are valid
            assert.strictEqual(validateTaskId('123'), true); // String numeric IDs are valid
            
            // Invalid task IDs
            assert.strictEqual(validateTaskId('task-001'), false);
            assert.strictEqual(validateTaskId('TASK-01'), false);
            assert.strictEqual(validateTaskId('TASK001'), false);
            assert.strictEqual(validateTaskId('TASK-'), false);
            assert.strictEqual(validateTaskId('invalid'), false);
            assert.strictEqual(validateTaskId(null), false);
            assert.strictEqual(validateTaskId(undefined), false);
            assert.strictEqual(validateTaskId(''), false);
        });

        test('should validate no cycles in dependencies', () => {
            // Self-dependency should fail
            assert.throws(() => validateNoCycles(1, 1));
            
            // Simple cycle should fail
            const existingDeps = [
                { task_id: 2, depends_on_id: 1 }
            ];
            assert.throws(() => validateNoCycles(1, 2, existingDeps));
            
            // Valid dependency should pass
            assert.doesNotThrow(() => validateNoCycles(1, 3, existingDeps));
            assert.doesNotThrow(() => validateNoCycles(4, 1, existingDeps));
        });

        test('should validate date strings', () => {
            // Valid dates
            assert.doesNotThrow(() => validateDate('2023-12-25'));
            assert.doesNotThrow(() => validateDate('2023-12-25T10:30:00Z'));
            assert.doesNotThrow(() => validateDate(new Date().toISOString()));
            
            // Invalid dates
            assert.throws(() => validateDate('invalid-date'));
            assert.throws(() => validateDate('2023-13-01'));
            assert.throws(() => validateDate(123));
            assert.throws(() => validateDate(null));
        });

        test('should validate file paths', () => {
            // Valid file paths
            assert.doesNotThrow(() => validateFilePath('src/file.js'));
            assert.doesNotThrow(() => validateFilePath('/absolute/path/file.txt'));
            assert.doesNotThrow(() => validateFilePath('relative/path/file.md'));
            
            // Invalid file paths
            assert.throws(() => validateFilePath('../outside/project'));
            assert.throws(() => validateFilePath('path//with/double/slash'));
            assert.throws(() => validateFilePath(123));
            assert.throws(() => validateFilePath(null));
        });

        test('should sanitize search queries', () => {
            assert.strictEqual(sanitizeSearchQuery('  hello world  '), 'hello world');
            assert.strictEqual(sanitizeSearchQuery('query<script>'), 'queryscript');
            assert.strictEqual(sanitizeSearchQuery('query"with"quotes'), 'querywithquotes');
            assert.strictEqual(sanitizeSearchQuery('query&with&entities'), 'querywithentities');
            
            // Long query should be truncated
            const longQuery = 'a'.repeat(300);
            const sanitized = sanitizeSearchQuery(longQuery);
            assert.strictEqual(sanitized.length, 200);
            
            // Should throw for non-string
            assert.throws(() => sanitizeSearchQuery(123));
        });
    });

    describe('Bulk Validation', () => {
        test('should validate array of valid items', async () => {
            const items = [
                { name: 'Task 1', status: 'todo' },
                { name: 'Task 2', status: 'in_progress' },
                { name: 'Task 3', status: 'completed' }
            ];
            
            const result = await validateBulk(items, TaskSchema);
            assert.strictEqual(result, true);
        });

        test('should collect errors from invalid items', async () => {
            const items = [
                { name: 'Valid Task', status: 'todo' },
                { status: 'todo' }, // Missing name
                { name: 'Task', status: 'invalid_status' } // Invalid status
            ];
            
            try {
                await validateBulk(items, TaskSchema);
                assert.fail('Should have thrown bulk validation error');
            } catch (error) {
                assert.strictEqual(error.name, 'BulkValidationError');
                assert.ok(Array.isArray(error.errors));
                assert.strictEqual(error.errors.length, 2);
                
                assert.strictEqual(error.errors[0].index, 1);
                assert.strictEqual(error.errors[1].index, 2);
            }
        });

        test('should throw error for non-array input', async () => {
            await assert.rejects(async () => await validateBulk('not an array', TaskSchema));
            await assert.rejects(async () => await validateBulk(123, TaskSchema));
            await assert.rejects(async () => await validateBulk(null, TaskSchema));
        });
    });

    describe('Schema Integration', () => {
        test('should work with realistic task data', () => {
            const validTask = {
                name: 'Implement user authentication',
                description: 'Add login/logout functionality with JWT tokens',
                status: 'in_progress',
                priority: 'high',
                category: 'feature',
                assignee: 'john.doe@example.com',
                estimated: '2 days',
                progress: 75
            };
            
            // This would be used with BaseAPI.validate()
            // Just testing the schema structure
            assert.ok(TaskSchema.required.includes('name'));
            assert.ok(TaskSchema.properties.name.type === 'string');
            assert.ok(TaskSchema.properties.status.enum.includes(validTask.status));
            assert.ok(TaskSchema.properties.priority.enum.includes(validTask.priority));
        });

        test('should work with realistic dependency data', () => {
            const validDependency = {
                task_id: 123,
                depends_on_id: 456,
                dependency_type: 'blocks'
            };
            
            assert.ok(TaskDependencySchema.required.includes('task_id'));
            assert.ok(TaskDependencySchema.required.includes('depends_on_id'));
            assert.ok(TaskDependencySchema.properties.dependency_type.enum.includes('blocks'));
        });
    });
});