import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import Database from 'better-sqlite3';
import { applySchema } from '../../src/db/schema.js';

// Test-specific database class that doesn't run migrations
class TestDatabase {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.isGlobal = false;
    this.db = null;
  }

  connect() {
    if (this.db) {
      return this.db;
    }

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    // Apply schema but skip migrations for tests
    applySchema(this.db);
    return this.db;
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  getDB() {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db;
  }

  prepare(sql) {
    return this.db.prepare(sql);
  }

  exec(sql) {
    return this.db.exec(sql);
  }

  isConnected() {
    return this.db !== null && this.db.open;
  }

  executeTransaction(fn) {
    if (!this.db) {
      throw new Error('Database not connected');
    }
    const transaction = this.db.transaction(fn);
    return transaction();
  }
}

export function createTestDatabase() {
  const tempDir = mkdtempSync(join(tmpdir(), 'taskwerk-test-'));
  const dbPath = join(tempDir, 'test.db');

  const database = new TestDatabase(dbPath);
  const db = database.connect();

  // Note: We don't run migrations in tests because applySchema()
  // already creates all necessary tables. The migration system
  // is tested separately in migration-specific tests.

  return {
    database,
    db,
    dbPath,
    tempDir,
    cleanup: () => {
      database.close();
      rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

let taskCounter = 0;

export function createTestTask(db, taskData = {}) {
  const defaults = {
    id: `TASK-TEST-${Date.now()}-${++taskCounter}`,
    name: 'Test Task',
    description: 'Test description',
    status: 'todo',
    priority: 'medium',
    assignee: null,
    estimate: null,
    actual: null,
    progress: 0,
    parent_id: null,
    branch_name: null,
    due_date: null,
  };

  const task = { ...defaults, ...taskData };

  const stmt = db.prepare(`
    INSERT INTO tasks (
      id, name, description, status, priority, 
      assignee, estimate, actual, progress, parent_id, 
      branch_name, due_date
    ) VALUES (
      @id, @name, @description, @status, @priority,
      @assignee, @estimate, @actual, @progress, @parent_id,
      @branch_name, @due_date
    )
  `);

  stmt.run(task);
  return task;
}

export function getTaskById(db, id) {
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
}

export function getAllTasks(db) {
  return db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all();
}

export function addTaskTag(db, taskId, tag) {
  db.prepare('INSERT INTO task_tags (task_id, tag) VALUES (?, ?)').run(taskId, tag);
}

export function addTaskNote(db, taskId, note) {
  db.prepare('INSERT INTO task_notes (task_id, note) VALUES (?, ?)').run(taskId, note);
}

export function addTaskDependency(db, taskId, dependsOnId) {
  db.prepare('INSERT INTO task_dependencies (task_id, depends_on_id) VALUES (?, ?)').run(
    taskId,
    dependsOnId
  );
}
