export const SCHEMA_VERSION = 2;

export const SCHEMA_SQL = `
-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Main tasks table with enhanced v0.6.x schema
CREATE TABLE IF NOT EXISTS tasks (
  -- Primary key with custom format TASK-XXX
  id TEXT PRIMARY KEY CHECK(id GLOB 'TASK-[0-9]*' OR id GLOB '*-[0-9]*' OR id GLOB 'TASK-[0-9]*.[0-9]*'),
  
  -- Core fields (keeping 'name' for backward compatibility, but also adding 'description')
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in-progress', 'in_progress', 'blocked', 'done', 'completed', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  
  -- User and assignment
  assignee TEXT,
  created_by TEXT DEFAULT 'system',
  updated_by TEXT DEFAULT 'system',
  
  -- Time tracking
  estimate INTEGER, -- Keep as INTEGER for compatibility
  actual INTEGER,
  estimated TEXT, -- New flexible format
  actual_time TEXT,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  
  -- Relationships
  parent_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  
  -- Git integration
  branch_name TEXT,
  
  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME,
  completed_at DATETIME,
  due_date DATETIME,
  
  -- Content and metadata
  content TEXT, -- Markdown content
  category TEXT,
  metadata TEXT DEFAULT '{}', -- JSON
  context TEXT DEFAULT '{}', -- JSON
  
  -- Computed columns
  is_subtask INTEGER GENERATED ALWAYS AS (parent_id IS NOT NULL) STORED,
  is_blocked INTEGER GENERATED ALWAYS AS (status = 'blocked') STORED
);

-- Task dependencies with enhanced tracking
CREATE TABLE IF NOT EXISTS task_dependencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(task_id, depends_on_id),
  CHECK(task_id != depends_on_id)
);

-- Task tags with timestamps
CREATE TABLE IF NOT EXISTS task_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(task_id, tag)
);

-- Enhanced task notes with user tracking
CREATE TABLE IF NOT EXISTS task_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  content TEXT, -- For longer notes
  user TEXT DEFAULT 'system',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Task timeline (replacing history) for comprehensive audit trail
CREATE TABLE IF NOT EXISTS task_timeline (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  action TEXT NOT NULL, -- created, updated, started, paused, blocked, completed, etc
  user TEXT NOT NULL DEFAULT 'system',
  note TEXT,
  changes TEXT, -- JSON of what changed
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Keep task_history for backward compatibility
CREATE TABLE IF NOT EXISTS task_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  changed_by TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);
CREATE INDEX IF NOT EXISTS idx_task_tags_tag ON task_tags(tag);
CREATE INDEX IF NOT EXISTS idx_task_deps_task ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_deps_depends ON task_dependencies(depends_on_id);
CREATE INDEX IF NOT EXISTS idx_timeline_task ON task_timeline(task_id);
CREATE INDEX IF NOT EXISTS idx_timeline_action ON task_timeline(action);
CREATE INDEX IF NOT EXISTS idx_notes_task ON task_notes(task_id);

-- Triggers for updated_at
CREATE TRIGGER IF NOT EXISTS update_task_timestamp 
AFTER UPDATE ON tasks
FOR EACH ROW
BEGIN
  UPDATE tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_task_notes_timestamp 
AFTER UPDATE ON task_notes
FOR EACH ROW
BEGIN
  UPDATE task_notes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
`;

export function getSchemaVersion(db) {
  try {
    const row = db.prepare('SELECT MAX(version) as version FROM schema_version').get();
    return row?.version || 0;
  } catch (error) {
    return 0;
  }
}

export function applySchema(db) {
  const currentVersion = getSchemaVersion(db);

  if (currentVersion >= SCHEMA_VERSION) {
    return false;
  }

  db.exec(SCHEMA_SQL);

  db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(SCHEMA_VERSION);

  return true;
}
