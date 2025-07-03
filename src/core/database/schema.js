/**
 * TaskWerk v3 SQLite Database Schema
 * 
 * Defines the complete database schema for TaskWerk v3 with tables for tasks,
 * dependencies, notes, files, keywords, and metadata tracking.
 */

export const SCHEMA_VERSION = '3.0.0';

/**
 * Main tasks table - core task information
 */
export const TASKS_TABLE = `
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'blocked', 'completed', 'archived', 'error')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
    category TEXT,
    assignee TEXT,
    estimated TEXT,
    progress INTEGER DEFAULT 0,
    error_msg TEXT,
    validation_state TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    format TEXT NOT NULL DEFAULT 'v3'
);`;

/**
 * Task dependencies - many-to-many relationships
 */
export const TASK_DEPENDENCIES_TABLE = `
CREATE TABLE IF NOT EXISTS task_dependencies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    depends_on_id INTEGER NOT NULL,
    dependency_type TEXT DEFAULT 'blocks' CHECK (dependency_type IN ('blocks', 'requires')),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (depends_on_id) REFERENCES tasks(id) ON DELETE CASCADE,
    UNIQUE(task_id, depends_on_id)
);`;

/**
 * Task notes and timeline - timestamped entries
 */
export const TASK_NOTES_TABLE = `
CREATE TABLE IF NOT EXISTS task_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    note TEXT NOT NULL,
    note_type TEXT DEFAULT 'comment' CHECK (note_type IN ('comment', 'state_change', 'decision', 'reminder', 'system')),
    author TEXT,
    agent_id TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);`;

/**
 * Task file associations - tracks files modified for tasks
 */
export const TASK_FILES_TABLE = `
CREATE TABLE IF NOT EXISTS task_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    file_action TEXT DEFAULT 'modified' CHECK (file_action IN ('created', 'modified', 'deleted', 'renamed')),
    lines_added INTEGER DEFAULT 0,
    lines_removed INTEGER DEFAULT 0,
    description TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);`;

/**
 * Task keywords/tags - flexible tagging system
 */
export const TASK_KEYWORDS_TABLE = `
CREATE TABLE IF NOT EXISTS task_keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    keyword TEXT NOT NULL,
    keyword_type TEXT DEFAULT 'tag' CHECK (keyword_type IN ('tag', 'category', 'component', 'technology')),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    UNIQUE(task_id, keyword)
);`;

/**
 * Git integration - track commits and branches
 */
export const TASK_GIT_TABLE = `
CREATE TABLE IF NOT EXISTS task_git (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    commit_hash TEXT,
    branch_name TEXT,
    operation TEXT CHECK (operation IN ('branch_created', 'commit_created', 'merge_completed')),
    message TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);`;

/**
 * Task audit log - complete history of changes
 */
export const TASK_AUDIT_TABLE = `
CREATE TABLE IF NOT EXISTS task_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    operation TEXT NOT NULL,
    old_values TEXT, -- JSON
    new_values TEXT, -- JSON
    user_id TEXT,
    agent_id TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);`;

/**
 * Schema metadata - version tracking and migrations
 */
export const SCHEMA_META_TABLE = `
CREATE TABLE IF NOT EXISTS schema_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);`;

/**
 * Project configuration - settings and rules
 */
export const PROJECT_CONFIG_TABLE = `
CREATE TABLE IF NOT EXISTS project_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    config_type TEXT DEFAULT 'setting' CHECK (config_type IN ('setting', 'rule', 'template')),
    description TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);`;

/**
 * Performance indexes for common queries
 */
export const INDEXES = [
    'CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);',
    'CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);',
    'CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee);',
    'CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);',
    'CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);',
    'CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks(updated_at);',
    'CREATE INDEX IF NOT EXISTS idx_task_dependencies_task_id ON task_dependencies(task_id);',
    'CREATE INDEX IF NOT EXISTS idx_task_dependencies_depends_on ON task_dependencies(depends_on_id);',
    'CREATE INDEX IF NOT EXISTS idx_task_notes_task_id ON task_notes(task_id);',
    'CREATE INDEX IF NOT EXISTS idx_task_notes_created_at ON task_notes(created_at);',
    'CREATE INDEX IF NOT EXISTS idx_task_files_task_id ON task_files(task_id);',
    'CREATE INDEX IF NOT EXISTS idx_task_files_path ON task_files(file_path);',
    'CREATE INDEX IF NOT EXISTS idx_task_keywords_task_id ON task_keywords(task_id);',
    'CREATE INDEX IF NOT EXISTS idx_task_keywords_keyword ON task_keywords(keyword);',
    'CREATE INDEX IF NOT EXISTS idx_task_git_task_id ON task_git(task_id);',
    'CREATE INDEX IF NOT EXISTS idx_task_git_commit_hash ON task_git(commit_hash);',
    'CREATE INDEX IF NOT EXISTS idx_task_audit_task_id ON task_audit(task_id);',
    'CREATE INDEX IF NOT EXISTS idx_task_audit_created_at ON task_audit(created_at);'
];

/**
 * Triggers for automatic timestamp updates
 */
export const TRIGGERS = [
    `CREATE TRIGGER IF NOT EXISTS update_tasks_timestamp 
     AFTER UPDATE ON tasks 
     BEGIN 
         UPDATE tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
     END;`,
     
    `CREATE TRIGGER IF NOT EXISTS update_task_notes_timestamp 
     AFTER UPDATE ON task_notes 
     BEGIN 
         UPDATE task_notes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
     END;`,
    
    `CREATE TRIGGER IF NOT EXISTS update_project_config_timestamp 
     AFTER UPDATE ON project_config 
     BEGIN 
         UPDATE project_config SET updated_at = CURRENT_TIMESTAMP WHERE key = NEW.key;
     END;`,
     
    `CREATE TRIGGER IF NOT EXISTS update_schema_meta_timestamp 
     AFTER UPDATE ON schema_meta 
     BEGIN 
         UPDATE schema_meta SET updated_at = CURRENT_TIMESTAMP WHERE key = NEW.key;
     END;`
];

/**
 * Complete table creation array in dependency order
 */
export const ALL_TABLES = [
    SCHEMA_META_TABLE,
    PROJECT_CONFIG_TABLE,
    TASKS_TABLE,
    TASK_DEPENDENCIES_TABLE,
    TASK_NOTES_TABLE,
    TASK_FILES_TABLE,
    TASK_KEYWORDS_TABLE,
    TASK_GIT_TABLE,
    TASK_AUDIT_TABLE
];

/**
 * Default data to insert after schema creation
 */
export const DEFAULT_DATA = [
    {
        table: 'schema_meta',
        data: [
            { key: 'version', value: SCHEMA_VERSION },
            { key: 'created_at', value: new Date().toISOString() },
            { key: 'last_migration', value: SCHEMA_VERSION }
        ]
    },
    {
        table: 'project_config',
        data: [
            { key: 'default_priority', value: 'medium', config_type: 'setting', description: 'Default priority for new tasks' },
            { key: 'auto_create_branch', value: 'true', config_type: 'setting', description: 'Automatically create Git branches for tasks' },
            { key: 'validate_dependencies', value: 'true', config_type: 'setting', description: 'Validate dependencies before starting tasks' },
            { key: 'timeline_tracking', value: 'true', config_type: 'setting', description: 'Enable detailed timeline tracking' },
            { key: 'require_estimates', value: 'false', config_type: 'rule', description: 'Require time estimates for new tasks' },
            { key: 'auto_complete_subtasks', value: 'true', config_type: 'rule', description: 'Auto-complete parent when all subtasks done' }
        ]
    }
];

/**
 * Schema validation queries
 */
export const VALIDATION_QUERIES = [
    "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='tasks';",
    "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='task_dependencies';",
    "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='task_notes';",
    "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='task_files';",
    "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='task_keywords';",
    "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='task_git';",
    "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='task_audit';",
    "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='schema_meta';",
    "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='project_config';"
];