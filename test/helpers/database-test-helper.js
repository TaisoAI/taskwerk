import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { TaskwerkDatabase } from '../../src/db/database.js';
import { applySchema } from '../../src/db/schema.js';
import { MigrationRunner } from '../../src/db/migrations.js';

export function createTestDatabase() {
  const tempDir = mkdtempSync(join(tmpdir(), 'taskwerk-test-'));
  const dbPath = join(tempDir, 'test.db');

  const database = new TaskwerkDatabase(dbPath);
  const db = database.connect();

  applySchema(db);

  const migrationRunner = new MigrationRunner(db);
  migrationRunner.runPendingMigrations();

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
