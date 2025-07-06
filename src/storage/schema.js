/**
 * Database Schema
 * 
 * @description SQLite schema definition for Taskwerk v3
 * @module taskwerk/storage/schema
 */

export const SCHEMA_VERSION = 1;

export const SCHEMA = `
-- Main tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  string_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  notes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'todo',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  assignee TEXT,
  priority TEXT DEFAULT 'medium',
  estimate REAL,
  actual REAL,
  due_date TIMESTAMP,
  progress INTEGER DEFAULT 0,
  parent_id INTEGER REFERENCES tasks(id),
  branch TEXT,
  category TEXT,
  blocked_reason TEXT,
  is_milestone BOOLEAN DEFAULT FALSE,
  is_template BOOLEAN DEFAULT FALSE,
  
  CHECK (status IN ('todo','active','paused','blocked','completed','archived')),
  CHECK (priority IN ('high','medium','low')),
  CHECK (progress >= 0 AND progress <= 100)
);

-- Task dependencies
CREATE TABLE IF NOT EXISTS task_dependencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  dependency_type TEXT DEFAULT 'blocks',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(task_id, depends_on_id)
);

-- Immutable task notes/events
CREATE TABLE IF NOT EXISTS task_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  note_type TEXT DEFAULT 'comment',
  
  CHECK (note_type IN ('comment','plan','update','block','complete'))
);

-- Task history audit trail
CREATE TABLE IF NOT EXISTS task_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  changed_by TEXT,
  change_type TEXT NOT NULL
);

-- Tags
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS task_tags (
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, tag_id)
);

-- Git commits
CREATE TABLE IF NOT EXISTS task_commits (
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  commit_sha TEXT NOT NULL,
  committed_at TIMESTAMP,
  PRIMARY KEY (task_id, commit_sha)
);

-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

export const INDEXES = `
-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_updated ON tasks(updated_at);
CREATE INDEX IF NOT EXISTS idx_tasks_string_id ON tasks(string_id);
CREATE INDEX IF NOT EXISTS idx_task_notes_task_id ON task_notes(task_id);
CREATE INDEX IF NOT EXISTS idx_task_history_task_id ON task_history(task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_task ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_depends ON task_dependencies(depends_on_id);
`;

export const TRIGGERS = `
-- Update timestamp trigger
CREATE TRIGGER IF NOT EXISTS update_task_timestamp 
AFTER UPDATE ON tasks
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
`;

/**
 * Initialize database schema
 * @param {Database} db - Better-sqlite3 database instance
 */
export function initializeSchema(db) {
  // Create tables
  db.exec(SCHEMA);
  
  // Create indexes
  db.exec(INDEXES);
  
  // Create triggers
  db.exec(TRIGGERS);
  
  // Insert schema version if not exists
  const stmt = db.prepare('INSERT OR IGNORE INTO schema_version (version) VALUES (?)');
  stmt.run(SCHEMA_VERSION);
}

/**
 * Get current schema version
 * @param {Database} db - Database instance
 * @returns {number} Current schema version
 */
export function getSchemaVersion(db) {
  try {
    const row = db.prepare('SELECT MAX(version) as version FROM schema_version').get();
    return row ? row.version : 0;
  } catch (err) {
    return 0;
  }
}