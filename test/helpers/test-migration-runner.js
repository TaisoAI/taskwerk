import { MigrationRunner } from '../../src/db/migrations.js';

const CHAT_MIGRATION_SQL = `
-- Add chat management fields to tasks table
ALTER TABLE tasks ADD COLUMN source TEXT DEFAULT 'cli' CHECK(source IN ('cli', 'ask', 'agent'));
ALTER TABLE tasks ADD COLUMN context_id TEXT;
ALTER TABLE tasks ADD COLUMN intent_group_id TEXT;
ALTER TABLE tasks ADD COLUMN correlation_id INTEGER;

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
CREATE INDEX IF NOT EXISTS idx_tasks_source ON tasks(source);
CREATE INDEX IF NOT EXISTS idx_tasks_context ON tasks(context_id);
CREATE INDEX IF NOT EXISTS idx_tasks_intent_group ON tasks(intent_group_id);

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
END;

-- Track task source in timeline for non-CLI tasks
CREATE TRIGGER IF NOT EXISTS track_task_source
AFTER INSERT ON tasks
FOR EACH ROW
WHEN NEW.source != 'cli'
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
END;
`;

/**
 * Test-specific migration runner that applies migrations directly
 */
export class TestMigrationRunner extends MigrationRunner {
  constructor(db) {
    super(db);
    // Store migrations in memory for tests
    this.testMigrations = {
      '001_add_chat_management.sql': CHAT_MIGRATION_SQL,
    };
  }

  getMigrationFiles() {
    return Object.keys(this.testMigrations).sort();
  }

  runMigration(filename) {
    const sql = this.testMigrations[filename];
    if (!sql) {
      throw new Error(`Migration not found: ${filename}`);
    }

    this.db.transaction(() => {
      this.db.exec(sql);
      this.db.prepare('INSERT INTO migrations (filename) VALUES (?)').run(filename);
    })();

    return true;
  }
}

/**
 * Directly apply the chat migration for testing
 */
export function applyChatMigration(db) {
  db.exec(CHAT_MIGRATION_SQL);
}
