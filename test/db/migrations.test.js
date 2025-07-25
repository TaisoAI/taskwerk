import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { MigrationRunner } from '../../src/db/migrations.js';
import { createTestDatabase } from '../helpers/database-test-helper.js';

// Test-specific MigrationRunner that ignores embedded migrations
class TestMigrationRunner extends MigrationRunner {
  getMigrationFiles() {
    // Override to use only filesystem-based migrations for tests
    if (!existsSync(this.migrationsPath)) {
      return [];
    }
    return readdirSync(this.migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort();
  }

  runMigration(filename) {
    // Override to use only filesystem-based migrations for tests
    const filepath = join(this.migrationsPath, filename);
    const sql = readFileSync(filepath, 'utf8');

    this.db.transaction(() => {
      this.db.exec(sql);
      this.db.prepare('INSERT INTO migrations (filename) VALUES (?)').run(filename);
    })();

    return true;
  }
}

describe('MigrationRunner', () => {
  let testDb;
  let runner;
  let migrationsDir;

  beforeEach(() => {
    testDb = createTestDatabase();
    runner = new TestMigrationRunner(testDb.db);
    migrationsDir = runner.migrationsPath;

    try {
      mkdirSync(migrationsDir, { recursive: true });
    } catch (e) {
      // Ignore if directory already exists
    }
  });

  afterEach(() => {
    testDb?.cleanup();
    try {
      rmSync(migrationsDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('createMigrationsTable', () => {
    it('should create migrations table', () => {
      runner.createMigrationsTable();

      const tables = testDb.db
        .prepare(
          `
        SELECT name FROM sqlite_master 
        WHERE type = 'table' AND name = 'migrations'
      `
        )
        .all();

      expect(tables).toHaveLength(1);
    });

    it('should handle table already existing', () => {
      runner.createMigrationsTable();
      expect(() => runner.createMigrationsTable()).not.toThrow();
    });
  });

  describe('getAppliedMigrations', () => {
    it('should return empty set for no migrations', () => {
      runner.createMigrationsTable();
      const applied = runner.getAppliedMigrations();
      expect(applied.size).toBe(0);
    });

    it('should return applied migrations', () => {
      runner.createMigrationsTable();
      testDb.db.prepare('INSERT INTO migrations (filename) VALUES (?)').run('001_test.sql');
      testDb.db.prepare('INSERT INTO migrations (filename) VALUES (?)').run('002_test.sql');

      const applied = runner.getAppliedMigrations();
      expect(applied.size).toBe(2);
      expect(applied.has('001_test.sql')).toBe(true);
      expect(applied.has('002_test.sql')).toBe(true);
    });
  });

  describe('getMigrationFiles', () => {
    it('should return empty array if migrations directory does not exist', () => {
      rmSync(migrationsDir, { recursive: true, force: true });
      const files = runner.getMigrationFiles();
      expect(files).toEqual([]);
    });

    it('should return sorted migration files', () => {
      writeFileSync(join(migrationsDir, '003_third.sql'), '-- test');
      writeFileSync(join(migrationsDir, '001_first.sql'), '-- test');
      writeFileSync(join(migrationsDir, '002_second.sql'), '-- test');
      writeFileSync(join(migrationsDir, 'not_a_migration.txt'), '-- test');

      const files = runner.getMigrationFiles();
      expect(files).toEqual(['001_first.sql', '002_second.sql', '003_third.sql']);
    });
  });

  describe('runMigration', () => {
    it('should run migration successfully', () => {
      runner.createMigrationsTable();

      const migrationSql = `
        CREATE TABLE test_migration (
          id INTEGER PRIMARY KEY,
          name TEXT
        );
      `;

      writeFileSync(join(migrationsDir, '001_test.sql'), migrationSql);

      const result = runner.runMigration('001_test.sql');
      expect(result).toBe(true);

      const tables = testDb.db
        .prepare(
          `
        SELECT name FROM sqlite_master 
        WHERE type = 'table' AND name = 'test_migration'
      `
        )
        .all();
      expect(tables).toHaveLength(1);

      const applied = runner.getAppliedMigrations();
      expect(applied.has('001_test.sql')).toBe(true);
    });

    it('should handle migration errors', () => {
      runner.createMigrationsTable();

      const badSql = 'CREATE TABLE INVALID SQL';
      writeFileSync(join(migrationsDir, '001_bad.sql'), badSql);

      expect(() => runner.runMigration('001_bad.sql')).toThrow();

      const applied = runner.getAppliedMigrations();
      expect(applied.has('001_bad.sql')).toBe(false);
    });
  });

  describe('runPendingMigrations', () => {
    it('should run all pending migrations', () => {
      writeFileSync(
        join(migrationsDir, '001_first.sql'),
        'CREATE TABLE test1 (id INTEGER PRIMARY KEY);'
      );
      writeFileSync(
        join(migrationsDir, '002_second.sql'),
        'CREATE TABLE test2 (id INTEGER PRIMARY KEY);'
      );

      const result = runner.runPendingMigrations();

      expect(result.count).toBe(2);
      expect(result.migrations).toHaveLength(2);
      expect(result.migrations[0].status).toBe('success');
      expect(result.migrations[1].status).toBe('success');

      const tables = testDb.db
        .prepare(
          `
        SELECT name FROM sqlite_master 
        WHERE type = 'table' AND name LIKE 'test%'
        ORDER BY name
      `
        )
        .all();
      expect(tables).toHaveLength(2);
      expect(tables[0].name).toBe('test1');
      expect(tables[1].name).toBe('test2');
    });

    it('should skip already applied migrations', () => {
      writeFileSync(
        join(migrationsDir, '001_first.sql'),
        'CREATE TABLE test1 (id INTEGER PRIMARY KEY);'
      );

      runner.runPendingMigrations();

      writeFileSync(
        join(migrationsDir, '002_second.sql'),
        'CREATE TABLE test2 (id INTEGER PRIMARY KEY);'
      );

      const result = runner.runPendingMigrations();

      expect(result.count).toBe(1);
      expect(result.migrations[0].filename).toBe('002_second.sql');
    });

    it('should stop on error', () => {
      writeFileSync(
        join(migrationsDir, '001_good.sql'),
        'CREATE TABLE test1 (id INTEGER PRIMARY KEY);'
      );
      writeFileSync(join(migrationsDir, '002_bad.sql'), 'INVALID SQL');
      writeFileSync(
        join(migrationsDir, '003_good.sql'),
        'CREATE TABLE test3 (id INTEGER PRIMARY KEY);'
      );

      expect(() => runner.runPendingMigrations()).toThrow();

      const tables = testDb.db
        .prepare(
          `
        SELECT name FROM sqlite_master 
        WHERE type = 'table' AND name LIKE 'test%'
      `
        )
        .all();
      expect(tables).toHaveLength(1);
      expect(tables[0].name).toBe('test1');
    });
  });

  describe('getMigrationStatus', () => {
    it('should return migration status', () => {
      writeFileSync(join(migrationsDir, '001_first.sql'), '-- test');
      writeFileSync(join(migrationsDir, '002_second.sql'), '-- test');
      writeFileSync(join(migrationsDir, '003_third.sql'), '-- test');

      runner.createMigrationsTable();
      testDb.db.prepare('INSERT INTO migrations (filename) VALUES (?)').run('001_first.sql');

      const status = runner.getMigrationStatus();

      expect(status.total).toBe(3);
      expect(status.applied).toEqual(['001_first.sql']);
      expect(status.pending).toEqual(['002_second.sql', '003_third.sql']);
    });
  });
});
