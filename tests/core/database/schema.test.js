/**
 * Tests for TaskWerk v3 Database Schema
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { join } from 'path';
import { unlinkSync, existsSync } from 'fs';
import { DatabaseInitializer } from '../../../src/core/database/init.js';
import {
    ALL_TABLES,
    INDEXES,
    TRIGGERS,
    SCHEMA_VERSION,
    VALIDATION_QUERIES
} from '../../../src/core/database/schema.js';

describe('Database Schema', () => {
    let dbPath;
    let initializer;

    beforeEach(() => {
        // Use temporary database for each test
        dbPath = join('/tmp', `taskwerk-test-${Date.now()}.db`);
        initializer = new DatabaseInitializer(dbPath);
    });

    afterEach(() => {
        // Clean up test database
        if (initializer.db) {
            initializer.close();
        }
        if (existsSync(dbPath)) {
            unlinkSync(dbPath);
        }
    });

    describe('Schema Constants', () => {
        test('should have valid schema version', () => {
            assert.match(SCHEMA_VERSION, /^\d+\.\d+\.\d+$/);
            assert.strictEqual(SCHEMA_VERSION, '3.0.0');
        });

        test('should have all required tables defined', () => {
            assert.strictEqual(ALL_TABLES.length, 9);
            
            const tableNames = ALL_TABLES.map(sql => {
                const match = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/);
                return match ? match[1] : null;
            }).filter(Boolean);

            assert.ok(tableNames.includes('tasks'));
            assert.ok(tableNames.includes('task_dependencies'));
            assert.ok(tableNames.includes('task_notes'));
            assert.ok(tableNames.includes('task_files'));
            assert.ok(tableNames.includes('task_keywords'));
            assert.ok(tableNames.includes('task_git'));
            assert.ok(tableNames.includes('task_audit'));
            assert.ok(tableNames.includes('schema_meta'));
            assert.ok(tableNames.includes('project_config'));
        });

        test('should have performance indexes defined', () => {
            assert.ok(INDEXES.length > 10);
            
            const indexSQL = INDEXES.join(' ');
            assert.ok(indexSQL.includes('idx_tasks_status'));
            assert.ok(indexSQL.includes('idx_tasks_priority'));
            assert.ok(indexSQL.includes('idx_task_dependencies_task_id'));
            assert.ok(indexSQL.includes('idx_task_notes_task_id'));
        });

        test('should have triggers defined', () => {
            assert.ok(TRIGGERS.length > 0);
            
            const triggerSQL = TRIGGERS.join(' ');
            assert.ok(triggerSQL.includes('update_tasks_timestamp'));
        });
    });

    describe('Database Connection', () => {
        test('should create database connection', () => {
            const db = initializer.connect();
            assert.ok(db);
            assert.strictEqual(typeof db.prepare, 'function');
        });

        test('should enable foreign key constraints', () => {
            const db = initializer.connect();
            const result = db.prepare('PRAGMA foreign_keys').get();
            assert.strictEqual(result.foreign_keys, 1);
        });

        test('should enable WAL mode', () => {
            const db = initializer.connect();
            const result = db.prepare('PRAGMA journal_mode').get();
            assert.strictEqual(result.journal_mode, 'wal');
        });
    });

    describe('Table Creation', () => {
        test('should create all tables successfully', () => {
            initializer.connect();
            assert.doesNotThrow(() => initializer.createTables());
        });

        test('should create tables with correct structure', () => {
            initializer.connect();
            initializer.createTables();

            // Check tasks table structure
            const tasksInfo = initializer.db.prepare('PRAGMA table_info(tasks)').all();
            const columnNames = tasksInfo.map(col => col.name);
            
            assert.ok(columnNames.includes('id'));
            assert.ok(columnNames.includes('name'));
            assert.ok(columnNames.includes('description'));
            assert.ok(columnNames.includes('status'));
            assert.ok(columnNames.includes('priority'));
            assert.ok(columnNames.includes('assignee'));
            assert.ok(columnNames.includes('created_at'));
            assert.ok(columnNames.includes('updated_at'));
        });

        test('should enforce status constraints', () => {
            initializer.connect();
            initializer.createTables();

            // Valid status should work
            assert.doesNotThrow(() => {
                initializer.db.prepare('INSERT INTO tasks (name, status) VALUES (?, ?)').run('Test Task', 'todo');
            });

            // Invalid status should fail
            assert.throws(() => {
                initializer.db.prepare('INSERT INTO tasks (name, status) VALUES (?, ?)').run('Test Task', 'invalid_status');
            });
        });

        test('should enforce priority constraints', () => {
            initializer.connect();
            initializer.createTables();

            // Valid priority should work
            assert.doesNotThrow(() => {
                initializer.db.prepare('INSERT INTO tasks (name, priority) VALUES (?, ?)').run('Test Task', 'high');
            });

            // Invalid priority should fail
            assert.throws(() => {
                initializer.db.prepare('INSERT INTO tasks (name, priority) VALUES (?, ?)').run('Test Task', 'invalid_priority');
            });
        });
    });

    describe('Index Creation', () => {
        test('should create all indexes successfully', () => {
            initializer.connect();
            initializer.createTables();
            assert.doesNotThrow(() => initializer.createIndexes());
        });

        test('should create indexes for performance', () => {
            initializer.connect();
            initializer.createTables();
            initializer.createIndexes();

            // Check that indexes exist
            const indexes = initializer.db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND sql IS NOT NULL").all();
            const indexNames = indexes.map(idx => idx.name);

            assert.ok(indexNames.includes('idx_tasks_status'));
            assert.ok(indexNames.includes('idx_tasks_priority'));
            assert.ok(indexNames.includes('idx_task_dependencies_task_id'));
        });
    });

    describe('Default Data', () => {
        test('should insert default data successfully', () => {
            initializer.connect();
            initializer.createTables();
            assert.doesNotThrow(() => initializer.insertDefaultData());
        });

        test('should set schema version', () => {
            initializer.connect();
            initializer.createTables();
            initializer.insertDefaultData();

            const version = initializer.db.prepare("SELECT value FROM schema_meta WHERE key = 'version'").get();
            assert.strictEqual(version.value, SCHEMA_VERSION);
        });
    });

    describe('Data Types and Defaults', () => {
        test('should use correct default values', () => {
            initializer.connect();
            initializer.createTables();

            // Insert minimal task
            const result = initializer.db.prepare('INSERT INTO tasks (name) VALUES (?)').run('Test Task');
            const task = initializer.db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);

            assert.strictEqual(task.status, 'todo');
            assert.strictEqual(task.priority, 'medium');
            assert.strictEqual(task.progress, 0);
            assert.strictEqual(task.format, 'v3');
            assert.ok(task.created_at);
            assert.ok(task.updated_at);
        });
    });
});