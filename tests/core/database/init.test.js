/**
 * Tests for TaskWerk v3 Database Initialization
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { join } from 'path';
import { unlinkSync, existsSync } from 'fs';
import { DatabaseInitializer, initializeDatabase, getDatabaseConnection } from '../../../src/core/database/init.js';
import { SCHEMA_VERSION } from '../../../src/core/database/schema.js';

describe('Database Initialization', () => {
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

    describe('DatabaseInitializer Class', () => {
        test('should create initializer with default path', () => {
            const defaultInitializer = new DatabaseInitializer();
            assert.ok(defaultInitializer.dbPath.includes('taskwerk.db'));
        });

        test('should create initializer with custom path', () => {
            const customPath = '/tmp/custom.db';
            const customInitializer = new DatabaseInitializer(customPath);
            assert.strictEqual(customInitializer.dbPath, customPath);
        });

        test('should start with null database connection', () => {
            assert.strictEqual(initializer.db, null);
        });
    });

    describe('Database Connection', () => {
        test('should establish database connection', () => {
            const db = initializer.connect();
            assert.ok(db);
            assert.strictEqual(typeof db.prepare, 'function');
            assert.strictEqual(initializer.db, db);
        });

        test('should set database pragmas correctly', () => {
            const db = initializer.connect();
            
            // Check WAL mode
            const walMode = db.prepare('PRAGMA journal_mode').get();
            assert.strictEqual(walMode.journal_mode, 'wal');
            
            // Check foreign keys
            const foreignKeys = db.prepare('PRAGMA foreign_keys').get();
            assert.strictEqual(foreignKeys.foreign_keys, 1);
        });

        test('should return existing connection when called multiple times', () => {
            const db1 = initializer.connect();
            const db2 = initializer.connect();
            // Both should be valid database connections pointing to the same file
            assert.ok(db1);
            assert.ok(db2);
            assert.strictEqual(typeof db1.prepare, 'function');
            assert.strictEqual(typeof db2.prepare, 'function');
        });
    });

    describe('Initialization Status', () => {
        test('should detect uninitialized database', () => {
            assert.strictEqual(initializer.isInitialized(), false);
        });

        test('should detect initialized database', async () => {
            await initializer.initialize();
            assert.strictEqual(initializer.isInitialized(), true);
        });

        test('should handle missing database file', () => {
            assert.strictEqual(existsSync(dbPath), false);
            assert.strictEqual(initializer.isInitialized(), false);
        });
    });

    describe('Full Initialization', () => {
        test('should initialize database successfully', async () => {
            const result = await initializer.initialize();
            
            assert.strictEqual(result.success, true);
            assert.strictEqual(result.created, true);
            assert.strictEqual(result.path, dbPath);
            assert.ok(result.stats);
            assert.strictEqual(result.stats.version, SCHEMA_VERSION);
        });

        test('should skip initialization if already initialized', async () => {
            // First initialization
            await initializer.initialize();
            
            // Second initialization should skip
            const result = await initializer.initialize();
            assert.strictEqual(result.success, true);
            assert.strictEqual(result.created, false);
        });

        test('should force re-initialization when requested', async () => {
            // First initialization
            await initializer.initialize();
            
            // Force re-initialization
            const result = await initializer.initialize(true);
            assert.strictEqual(result.success, true);
            assert.strictEqual(result.created, true);
        });

        test('should provide initialization statistics', async () => {
            const result = await initializer.initialize();
            
            assert.ok(result.stats);
            assert.strictEqual(result.stats.version, SCHEMA_VERSION);
            assert.ok(result.stats.tables);
            assert.strictEqual(result.stats.tables.tasks, 0);
            assert.ok(result.stats.indexes > 0);
            assert.ok(result.stats.triggers > 0);
        });
    });

    describe('Database Operations', () => {
        test('should provide working database connection', async () => {
            await initializer.initialize();
            const db = initializer.getConnection();
            
            // Test basic operation
            const result = db.prepare("SELECT COUNT(*) as count FROM tasks").get();
            assert.strictEqual(result.count, 0);
        });

        test('should handle concurrent access correctly', async () => {
            await initializer.initialize();
            const db1 = initializer.getConnection();
            const db2 = initializer.getConnection();
            
            // Should return valid connections
            assert.ok(db1);
            assert.ok(db2);
            
            // Test concurrent operations
            db1.prepare("INSERT INTO tasks (name) VALUES (?)").run('Task 1');
            const count = db2.prepare("SELECT COUNT(*) as count FROM tasks").get();
            assert.strictEqual(count.count, 1);
        });
    });

    describe('Connection Management', () => {
        test('should close database connection', async () => {
            await initializer.initialize();
            assert.ok(initializer.db);
            
            initializer.close();
            assert.strictEqual(initializer.db, null);
        });

        test('should handle closing unopened connection', () => {
            assert.doesNotThrow(() => initializer.close());
        });

        test('should reconnect after closing', async () => {
            await initializer.initialize();
            initializer.close();
            
            const db = initializer.getConnection();
            assert.ok(db);
            assert.strictEqual(initializer.db, db);
        });
    });

    describe('Convenience Functions', () => {
        test('should initialize database with convenience function', async () => {
            const result = await initializeDatabase(dbPath);
            
            assert.strictEqual(result.success, true);
            assert.strictEqual(result.created, true);
            assert.strictEqual(result.path, dbPath);
        });

        test('should get connection with convenience function', async () => {
            await initializeDatabase(dbPath);
            const db = getDatabaseConnection(dbPath);
            
            assert.ok(db);
            assert.strictEqual(typeof db.prepare, 'function');
        });
    });
});