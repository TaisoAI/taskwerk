import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Embedded migrations - used when running from bundled dist
const EMBEDDED_MIGRATIONS = {
  '001_add_chat_management.sql': `-- Chat Management Migration
-- This migration adds chat context support to taskwerk

-- Create chat contexts table
CREATE TABLE IF NOT EXISTS chat_contexts (
  id TEXT PRIMARY KEY CHECK(id GLOB 'CHAT-[0-9]*'),
  name TEXT NOT NULL,
  project_id TEXT NOT NULL, -- 'GLOBAL' for global contexts
  type TEXT NOT NULL CHECK(type IN ('ask', 'agent')),
  first_prompt TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME, -- NULL means no expiry
  turn_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'abandoned'))
);

-- Create chat turns table
CREATE TABLE IF NOT EXISTS chat_turns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  context_id TEXT NOT NULL REFERENCES chat_contexts(id) ON DELETE CASCADE,
  turn_number INTEGER NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('system', 'user', 'assistant', 'tool')),
  content TEXT NOT NULL,
  created_task_ids TEXT, -- JSON array of task IDs created
  tool_calls TEXT, -- JSON array of tool calls made
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_contexts_project ON chat_contexts(project_id);
CREATE INDEX IF NOT EXISTS idx_contexts_name ON chat_contexts(name);
CREATE INDEX IF NOT EXISTS idx_contexts_status ON chat_contexts(status);
CREATE INDEX IF NOT EXISTS idx_contexts_type ON chat_contexts(type);
CREATE INDEX IF NOT EXISTS idx_contexts_expires ON chat_contexts(expires_at);

CREATE INDEX IF NOT EXISTS idx_turns_context ON chat_turns(context_id);
CREATE INDEX IF NOT EXISTS idx_turns_number ON chat_turns(context_id, turn_number);

-- Triggers
-- Update last_active and turn_count when a turn is added
CREATE TRIGGER IF NOT EXISTS update_context_on_turn
AFTER INSERT ON chat_turns
FOR EACH ROW
BEGIN
  UPDATE chat_contexts 
  SET last_active = CURRENT_TIMESTAMP,
      turn_count = turn_count + 1
  WHERE id = NEW.context_id;
END;`,

  '002_add_task_chat_columns.sql': `-- Add chat management columns to tasks table
-- This migration adds chat-related columns to the existing tasks table

-- Add source column (tracks how task was created: cli, ask, agent)
-- Note: SQLite doesn't support IF NOT EXISTS for columns
-- The migration runner should handle errors gracefully

-- Add indexes after columns are added
CREATE INDEX IF NOT EXISTS idx_tasks_source ON tasks(source);
CREATE INDEX IF NOT EXISTS idx_tasks_context ON tasks(context_id);
CREATE INDEX IF NOT EXISTS idx_tasks_intent_group ON tasks(intent_group_id);

-- Add trigger to track task source in timeline for non-CLI tasks
CREATE TRIGGER IF NOT EXISTS track_task_source
AFTER INSERT ON tasks
FOR EACH ROW
WHEN NEW.source != 'cli' AND NEW.source IS NOT NULL
BEGIN
  INSERT INTO task_timeline (task_id, action, user, note, changes)
  VALUES (
    NEW.id, 
    'created',
    NEW.source,
    'Task created via ' || NEW.source || CASE 
      WHEN NEW.context_id IS NOT NULL THEN ' in context ' || NEW.context_id 
      ELSE '' 
    END,
    json_object(
      'source', NEW.source,
      'context_id', NEW.context_id,
      'intent_group_id', NEW.intent_group_id
    )
  );
END;`,
};

export class MigrationRunner {
  constructor(db) {
    this.db = db;
    this.migrationsPath = join(__dirname, 'migrations');
  }

  createMigrationsTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL UNIQUE,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  getAppliedMigrations() {
    const rows = this.db.prepare('SELECT filename FROM migrations ORDER BY id').all();
    return new Set(rows.map(row => row.filename));
  }

  getMigrationFiles() {
    // Try filesystem first, fall back to embedded
    if (existsSync(this.migrationsPath)) {
      return readdirSync(this.migrationsPath)
        .filter(file => file.endsWith('.sql'))
        .sort();
    } else {
      // Use embedded migrations (for bundled dist)
      return Object.keys(EMBEDDED_MIGRATIONS).sort();
    }
  }

  runMigration(filename) {
    let sql;

    // Try to read from filesystem first, fall back to embedded
    if (existsSync(this.migrationsPath)) {
      const filepath = join(this.migrationsPath, filename);
      sql = readFileSync(filepath, 'utf8');
    } else {
      // Use embedded migration
      sql = EMBEDDED_MIGRATIONS[filename];
      if (!sql) {
        throw new Error(`Migration ${filename} not found in embedded migrations`);
      }
    }

    this.db.transaction(() => {
      // Handle special migrations that need column additions
      if (filename === '002_add_task_chat_columns.sql') {
        this.addTaskChatColumns();
      } else {
        this.db.exec(sql);
      }
      this.db.prepare('INSERT INTO migrations (filename) VALUES (?)').run(filename);
    })();

    return true;
  }

  addTaskChatColumns() {
    // Check which columns exist and add missing ones
    const tableInfo = this.db.prepare('PRAGMA table_info(tasks)').all();
    const existingColumns = new Set(tableInfo.map(col => col.name));

    // Add missing columns one by one
    const columnsToAdd = [
      { name: 'source', sql: "ALTER TABLE tasks ADD COLUMN source TEXT DEFAULT 'cli'" },
      { name: 'context_id', sql: 'ALTER TABLE tasks ADD COLUMN context_id TEXT' },
      { name: 'intent_group_id', sql: 'ALTER TABLE tasks ADD COLUMN intent_group_id TEXT' },
      { name: 'correlation_id', sql: 'ALTER TABLE tasks ADD COLUMN correlation_id INTEGER' },
    ];

    for (const column of columnsToAdd) {
      if (!existingColumns.has(column.name)) {
        try {
          this.db.exec(column.sql);
        } catch (error) {
          // Column might already exist from a previous failed run
          if (!error.message.includes('duplicate column name')) {
            throw error;
          }
        }
      }
    }

    // Run the rest of the migration (indexes and triggers)
    let sql;
    if (existsSync(this.migrationsPath)) {
      const filepath = join(this.migrationsPath, '002_add_task_chat_columns.sql');
      sql = readFileSync(filepath, 'utf8');
    } else {
      sql = EMBEDDED_MIGRATIONS['002_add_task_chat_columns.sql'];
    }
    this.db.exec(sql);
  }

  runPendingMigrations() {
    this.createMigrationsTable();

    const applied = this.getAppliedMigrations();
    const files = this.getMigrationFiles();
    const pending = files.filter(file => !applied.has(file));

    if (pending.length === 0) {
      return { count: 0, migrations: [] };
    }

    const results = [];
    for (const filename of pending) {
      try {
        this.runMigration(filename);
        results.push({ filename, status: 'success' });
      } catch (error) {
        results.push({ filename, status: 'error', error: error.message });
        throw error;
      }
    }

    return { count: results.length, migrations: results };
  }

  getMigrationStatus() {
    this.createMigrationsTable();

    const applied = this.getAppliedMigrations();
    const files = this.getMigrationFiles();

    return {
      applied: Array.from(applied),
      pending: files.filter(file => !applied.has(file)),
      total: files.length,
    };
  }
}
