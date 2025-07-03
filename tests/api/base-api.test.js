/**
 * Tests for TaskWerk v3 Base API Layer
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { join } from 'path';
import { unlinkSync, existsSync } from 'fs';
import { BaseAPI, APIError, ValidationError } from '../../src/api/base-api.js';

describe('Base API Layer', () => {
    let api;
    let dbPath;

    beforeEach(() => {
        // Use temporary database for each test
        dbPath = join('/tmp', `taskwerk-api-test-${Date.now()}.db`);
        api = new BaseAPI(dbPath);
    });

    afterEach(() => {
        // Clean up test database
        if (api) {
            api.close();
        }
        if (existsSync(dbPath)) {
            unlinkSync(dbPath);
        }
    });

    describe('Constructor and Initialization', () => {
        test('should create API instance with default path', () => {
            const defaultApi = new BaseAPI();
            assert.ok(defaultApi.dbInitializer);
            assert.strictEqual(defaultApi.isInitialized, false);
            assert.strictEqual(defaultApi.db, null);
        });

        test('should create API instance with custom path', () => {
            assert.ok(api.dbInitializer);
            assert.strictEqual(api.dbInitializer.dbPath, dbPath);
            assert.strictEqual(api.isInitialized, false);
        });

        test('should initialize successfully', async () => {
            const result = await api.initialize();
            
            assert.strictEqual(result.success, true);
            assert.strictEqual(result.created, true);
            assert.strictEqual(api.isInitialized, true);
            assert.ok(api.db);
        });

        test('should skip initialization if already initialized', async () => {
            await api.initialize();
            
            const result = await api.initialize();
            assert.strictEqual(result.success, true);
            assert.strictEqual(result.created, false);
        });

        test('should force re-initialization when requested', async () => {
            await api.initialize();
            
            const result = await api.initialize(true);
            assert.strictEqual(result.success, true);
            assert.strictEqual(result.created, true);
        });
    });

    describe('Database Operations', () => {
        test('should get database connection', async () => {
            const db = await api.getDatabase();
            
            assert.ok(db);
            assert.strictEqual(typeof db.prepare, 'function');
            assert.strictEqual(api.isInitialized, true);
        });

        test('should auto-initialize when getting database', async () => {
            assert.strictEqual(api.isInitialized, false);
            
            const db = await api.getDatabase();
            
            assert.ok(db);
            assert.strictEqual(api.isInitialized, true);
        });
    });

    describe('Transaction Management', () => {
        test('should execute successful transaction', async () => {
            await api.initialize();
            
            const result = await api.transaction((db) => {
                const insertResult = db.prepare("INSERT INTO tasks (name) VALUES (?)").run('Test Task');
                const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(insertResult.lastInsertRowid);
                return task;
            });
            
            assert.ok(result);
            assert.strictEqual(result.name, 'Test Task');
        });

        test('should rollback failed transaction', async () => {
            await api.initialize();
            
            try {
                await api.transaction((db) => {
                    db.prepare("INSERT INTO tasks (name) VALUES (?)").run('Test Task');
                    throw new Error('Simulated error');
                });
                assert.fail('Transaction should have failed');
            } catch (error) {
                assert.ok(error instanceof APIError);
                assert.strictEqual(error.code, 'TRANSACTION_ERROR');
            }
            
            // Verify rollback - no tasks should exist
            const db = await api.getDatabase();
            const count = db.prepare("SELECT COUNT(*) as count FROM tasks").get();
            assert.strictEqual(count.count, 0);
        });

        test('should handle nested operations in transaction', async () => {
            await api.initialize();
            
            const result = await api.transaction((db) => {
                const task1 = db.prepare("INSERT INTO tasks (name) VALUES (?)").run('Task 1');
                const task2 = db.prepare("INSERT INTO tasks (name) VALUES (?)").run('Task 2');
                
                db.prepare("INSERT INTO task_dependencies (task_id, depends_on_id) VALUES (?, ?)")
                  .run(task1.lastInsertRowid, task2.lastInsertRowid);
                
                return { task1: task1.lastInsertRowid, task2: task2.lastInsertRowid };
            });
            
            assert.ok(result.task1);
            assert.ok(result.task2);
            
            // Verify data persisted
            const db = await api.getDatabase();
            const count = db.prepare("SELECT COUNT(*) as count FROM tasks").get();
            assert.strictEqual(count.count, 2);
        });
    });

    describe('Validation Framework', () => {
        test('should validate required fields', () => {
            const schema = {
                required: ['name', 'status'],
                properties: {}
            };
            
            const validData = { name: 'Test', status: 'todo' };
            assert.doesNotThrow(() => api.validate(validData, schema));
            
            const invalidData = { name: 'Test' };
            assert.throws(() => api.validate(invalidData, schema), ValidationError);
        });

        test('should validate field types', () => {
            const schema = {
                properties: {
                    name: { type: 'string' },
                    count: { type: 'number' }
                }
            };
            
            const validData = { name: 'Test', count: 42 };
            assert.doesNotThrow(() => api.validate(validData, schema));
            
            const invalidData = { name: 'Test', count: 'not a number' };
            assert.throws(() => api.validate(invalidData, schema), ValidationError);
        });

        test('should validate enum values', () => {
            const schema = {
                properties: {
                    status: { 
                        type: 'string',
                        enum: ['todo', 'in_progress', 'completed']
                    }
                }
            };
            
            const validData = { status: 'todo' };
            assert.doesNotThrow(() => api.validate(validData, schema));
            
            const invalidData = { status: 'invalid_status' };
            assert.throws(() => api.validate(invalidData, schema), ValidationError);
        });

        test('should validate string length', () => {
            const schema = {
                properties: {
                    name: { 
                        type: 'string',
                        minLength: 3,
                        maxLength: 10
                    }
                }
            };
            
            const validData = { name: 'Valid' };
            assert.doesNotThrow(() => api.validate(validData, schema));
            
            const tooShort = { name: 'Hi' };
            assert.throws(() => api.validate(tooShort, schema), ValidationError);
            
            const tooLong = { name: 'This is way too long' };
            assert.throws(() => api.validate(tooLong, schema), ValidationError);
        });

        test('should validate number ranges', () => {
            const schema = {
                properties: {
                    progress: { 
                        type: 'number',
                        min: 0,
                        max: 100
                    }
                }
            };
            
            const validData = { progress: 50 };
            assert.doesNotThrow(() => api.validate(validData, schema));
            
            const tooLow = { progress: -1 };
            assert.throws(() => api.validate(tooLow, schema), ValidationError);
            
            const tooHigh = { progress: 101 };
            assert.throws(() => api.validate(tooHigh, schema), ValidationError);
        });

        test('should validate with custom function', () => {
            const schema = {
                properties: {
                    email: { 
                        type: 'string',
                        validate: (value) => {
                            if (!value.includes('@')) {
                                return 'Must be a valid email address';
                            }
                            return null;
                        }
                    }
                }
            };
            
            const validData = { email: 'test@example.com' };
            assert.doesNotThrow(() => api.validate(validData, schema));
            
            const invalidData = { email: 'not-an-email' };
            assert.throws(() => api.validate(invalidData, schema), ValidationError);
        });

        test('should collect multiple validation errors', () => {
            const schema = {
                required: ['name'],
                properties: {
                    name: { type: 'string', minLength: 3 },
                    status: { enum: ['todo', 'done'] }
                }
            };
            
            const invalidData = { name: 'Hi', status: 'invalid' };
            
            try {
                api.validate(invalidData, schema);
                assert.fail('Should have thrown validation error');
            } catch (error) {
                assert.ok(error instanceof ValidationError);
                assert.ok(error.errors.length >= 2);
            }
        });
    });

    describe('Data Sanitization', () => {
        test('should remove undefined fields', () => {
            const data = {
                name: 'Test',
                description: undefined,
                status: 'todo'
            };
            
            const sanitized = api.sanitize(data);
            assert.strictEqual(sanitized.name, 'Test');
            assert.strictEqual(sanitized.status, 'todo');
            assert.strictEqual(sanitized.description, undefined);
            assert.ok(!sanitized.hasOwnProperty('description'));
        });

        test('should trim string values', () => {
            const data = {
                name: '  Test Task  ',
                description: '  A description with spaces  '
            };
            
            const sanitized = api.sanitize(data);
            assert.strictEqual(sanitized.name, 'Test Task');
            assert.strictEqual(sanitized.description, 'A description with spaces');
        });

        test('should preserve non-string values', () => {
            const data = {
                name: 'Test',
                count: 42,
                active: true,
                tags: ['tag1', 'tag2']
            };
            
            const sanitized = api.sanitize(data);
            assert.strictEqual(sanitized.count, 42);
            assert.strictEqual(sanitized.active, true);
            assert.deepStrictEqual(sanitized.tags, ['tag1', 'tag2']);
        });
    });

    describe('Utility Methods', () => {
        test('should generate ISO timestamp', () => {
            const timestamp = api.now();
            assert.strictEqual(typeof timestamp, 'string');
            assert.ok(timestamp.includes('T'));
            assert.ok(timestamp.includes('Z'));
            
            // Should be valid date
            const date = new Date(timestamp);
            assert.ok(!isNaN(date.getTime()));
        });

        test('should close database connection', async () => {
            await api.initialize();
            assert.strictEqual(api.isInitialized, true);
            assert.ok(api.db);
            
            api.close();
            assert.strictEqual(api.isInitialized, false);
            assert.strictEqual(api.db, null);
        });
    });

    describe('Health Check', () => {
        test('should return healthy status', async () => {
            const health = await api.healthCheck();
            
            assert.strictEqual(health.status, 'healthy');
            assert.strictEqual(health.database, 'connected');
            assert.strictEqual(typeof health.taskCount, 'number');
            assert.ok(health.timestamp);
        });

        test('should handle database errors in health check', async () => {
            // Close database to simulate error
            api.close();
            
            // Mock a broken database path
            api.dbInitializer.dbPath = '/invalid/path/database.db';
            
            const health = await api.healthCheck();
            
            assert.strictEqual(health.status, 'unhealthy');
            assert.strictEqual(health.database, 'error');
            assert.ok(health.error);
        });
    });

    describe('Error Handling', () => {
        test('should create APIError with code and details', () => {
            const error = new APIError('Test error', 'TEST_CODE', { detail: 'test' });
            
            assert.strictEqual(error.name, 'APIError');
            assert.strictEqual(error.message, 'Test error');
            assert.strictEqual(error.code, 'TEST_CODE');
            assert.deepStrictEqual(error.details, { detail: 'test' });
            assert.ok(error.timestamp);
        });

        test('should create ValidationError with errors array', () => {
            const errors = ['Error 1', 'Error 2'];
            const error = new ValidationError('Validation failed', errors);
            
            assert.strictEqual(error.name, 'ValidationError');
            assert.strictEqual(error.code, 'VALIDATION_ERROR');
            assert.deepStrictEqual(error.errors, errors);
            assert.ok(error.timestamp);
        });
    });
});