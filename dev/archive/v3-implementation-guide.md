# Taskwerk Implementation Guide

**Version**: 0.3.x  
**Architecture**: v3 (Refocused)
**Language**: JavaScript (ES modules)

## Overview

This guide provides technical implementation details for Taskwerk v3. It consolidates the database schema, API design, data structures, and development guidelines.

**Note**: This implementation uses pure JavaScript with ES modules. No TypeScript compilation is needed, keeping the tooling simple and development fast.

## Architecture

### Three-Layer Design

```
┌─────────────────────────────────────┐
│         CLI Layer (src/cli/)        │
│  - Command parsing (yargs/commander)│
│  - Output formatting                │
│  - User interaction                 │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│        Core API Layer (src/core/)   │
│  - Business logic                   │
│  - Task operations                  │
│  - Git integration                  │
│  - Query engine                     │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│      Storage Layer (SQLite)         │
│  - Database operations              │
│  - Schema management                │
│  - Migrations                       │
└─────────────────────────────────────┘
```

###  AI Module

```
src/ai/
├── index.js          # Mode detection, entry point
├── ask.js            # Read-only queries
├── agent.js          # Task modifications
├── raw.js            # Text pipeline
├── config.js         # AI configuration
└── tools/
    ├── read-tools.js   # Query operations
    └── write-tools.js  # Mutation operations
```

## Database Schema

### Core Tables

```sql
-- Main tasks table
CREATE TABLE tasks (
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
CREATE TABLE task_dependencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  dependency_type TEXT DEFAULT 'blocks',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(task_id, depends_on_id)
);

-- Immutable task notes/events
CREATE TABLE task_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  note_type TEXT DEFAULT 'comment',
  
  CHECK (note_type IN ('comment','plan','update','block','complete'))
);

-- Task history audit trail
CREATE TABLE task_history (
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
CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE task_tags (
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, tag_id)
);

-- Git commits
CREATE TABLE task_commits (
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  commit_sha TEXT NOT NULL,
  committed_at TIMESTAMP,
  PRIMARY KEY (task_id, commit_sha)
);

-- Indexes for performance
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assignee ON tasks(assignee);
CREATE INDEX idx_tasks_parent ON tasks(parent_id);
CREATE INDEX idx_tasks_created ON tasks(created_at);
CREATE INDEX idx_tasks_updated ON tasks(updated_at);
CREATE INDEX idx_tasks_string_id ON tasks(string_id);

-- Update timestamp trigger
CREATE TRIGGER update_task_timestamp 
AFTER UPDATE ON tasks
BEGIN
  UPDATE tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
```

## Data Structures

### Task Object

```javascript
interface Task {
  // Identity
  id: number;                    // Internal ID
  string_id: string;             // User-facing (TASK-001)
  
  // Core Fields  
  name: string;                  // Required
  description: string;           // Markdown
  notes: string;                 // Mutable, YAML frontmatter
  status: TaskStatus;
  
  // Metadata
  created_at: string;            // ISO8601
  updated_at: string;            // ISO8601
  completed_at: string | null;   // ISO8601
  
  // Assignment
  assignee: string | null;
  priority: 'high' | 'medium' | 'low';
  
  // Time
  estimate: number | null;       // Hours
  actual: number | null;         // Hours
  due_date: string | null;       // ISO8601
  progress: number;              // 0-100
  
  // Relationships
  parent_id: number | null;
  
  // Git
  branch: string | null;
  commits: string[];
  
  // Organization
  category: string | null;
  tags: string[];
  
  // State
  blocked_reason: string | null;
  
  // Flags
  is_milestone: boolean;
  is_template: boolean;
}
```

### Task States

```javascript
enum TaskStatus {
  TODO = 'todo',           // Not started
  ACTIVE = 'active',       // Being worked on
  PAUSED = 'paused',       // Temporarily stopped
  BLOCKED = 'blocked',     // Cannot proceed
  COMPLETED = 'completed', // Finished
  ARCHIVED = 'archived'    // Hidden
}
```

### State Transitions

```
todo → active, blocked, completed, archived
active → paused, blocked, completed
paused → active, blocked, completed
blocked → todo, active, completed
completed → archived
archived → (terminal state)
```

## Notes Implementation

### Dual Approach

1. **`task.notes` field** - Mutable working notes
2. **`task_notes` table** - Immutable audit entries

### Notes Format

```markdown
---
created_at: 2024-01-15T10:00:00Z
author: john
type: investigation
tags: [backend, performance]
---
Found the bottleneck in database query

---
created_at: 2024-01-15T11:30:00Z
author: ai
type: suggestion
---
Consider adding an index on user_id column
```

### Standard YAML Fields

- `created_at` (required): ISO8601 timestamp
- `author` (required): Username or 'ai'
- `type` (optional): investigation, finding, progress, blocker, suggestion, decision
- `tags` (optional): Additional categorization
- `references` (optional): Related files, tasks

## API Design

### Core API Methods

```javascript
class TaskwerkAPI {
  // Task CRUD
  async createTask(data) // returns Task object
  async getTask(id) // returns Task object
  async updateTask(id, updates) // returns updated Task
  async deleteTask(id, force = false) // returns void
  async listTasks(filters) // returns TaskList
  
  // Relationships
  async addDependency(taskId, dependsOnId) // returns void
  async removeDependency(taskId, dependsOnId) // returns void
  async getTaskTree(id) // returns TaskTree
  
  // Notes
  async appendNote(taskId, note) // returns void
  async addTaskNote(taskId, note) // returns void
  
  // Queries
  async queryTasks(query) // returns Task array
  async searchTasks(text) // returns Task array
  async getStats() // returns WorkspaceStats
  
  // Import/Export
  async exportTasks(format, filters) // format: 'markdown' | 'json'
  async importTasks(data, format, options) // returns ImportResult
}
```

### Input Types

```typescript
interface CreateTaskInput {
  name: string;
  description?: string;
  priority?: 'high' | 'medium' | 'low';
  assignee?: string;
  parent_id?: string;
  depends_on?: string[];
  tags?: string[];
  estimate?: number;
  due_date?: string;
}

interface UpdateTaskInput {
  name?: string;
  description?: string;
  status?: TaskStatus;
  priority?: 'high' | 'medium' | 'low';
  assignee?: string;
  note?: string;          // Appends to notes
  estimate?: number;
  actual?: number;
  progress?: number;
  due_date?: string;
  blocked_reason?: string;
  add_tags?: string[];
  remove_tags?: string[];
}

interface TaskFilters {
  status?: TaskStatus[];
  assignee?: string;
  priority?: string[];
  parent_id?: string;
  has_dependencies?: boolean;
  tags?: string[];
  created_after?: string;
  created_before?: string;
  updated_after?: string;
  updated_before?: string;
  search?: string;
  limit?: number;
  offset?: number;
  sort?: SortOption[];
}
```

## CLI Implementation

### Command Structure

```javascript
// src/cli/commands/task.js
module.exports = {
  command: 'task <action>',
  describe: 'Task management commands',
  builder: (yargs) => {
    return yargs
      .command(require('./task/add'))
      .command(require('./task/list'))
      .command(require('./task/show'))
      .command(require('./task/update'))
      .command(require('./task/delete'))
  }
}

// src/cli/commands/task/add.js
module.exports = {
  command: 'add <name>',
  describe: 'Create a new task',
  builder: {
    description: { alias: 'd', describe: 'Task description' },
    priority: { alias: 'p', choices: ['high', 'medium', 'low'] },
    assignee: { alias: 'a', describe: 'Assign to user' },
    // ... other options
  },
  handler: async (argv) => {
    const api = require('../../../core/api');
    const task = await api.createTask(argv);
    console.log(`Created ${task.string_id}`);
  }
}
```

### Output Formatting

```javascript
// src/cli/formatters/task.js
function formatTask(task, format = 'text') {
  switch (format) {
    case 'json':
      return JSON.stringify(task, null, 2);
    
    case 'markdown':
      return `## ${task.string_id}: ${task.name} [${task.status}]

**Status:** ${task.status}  
**Priority:** ${task.priority}  
**Assignee:** ${task.assignee || 'Unassigned'}  

### Description
${task.description || 'No description'}

### Notes
${task.notes || 'No notes'}`;
    
    case 'text':
    default:
      return `${task.string_id}: ${task.name}
Status: ${task.status}
Priority: ${task.priority}
Assignee: ${task.assignee || 'Unassigned'}`;
  }
}
```

## ID Generation

```javascript
// src/core/utils/id-generator.js
class TaskIdGenerator {
  async getNextId() {
    const result = await db.get(
      'SELECT MAX(CAST(SUBSTR(string_id, 6) AS INTEGER)) as max_id FROM tasks'
    );
    const nextNum = (result.max_id || 0) + 1;
    return `TASK-${String(nextNum).padStart(3, '0')}`;
  }
}
```

## Note Management

```javascript
// src/core/services/note-service.js
class NoteService {
  appendToNotes(currentNotes, content, metadata = {}) {
    const note = {
      created_at: new Date().toISOString(),
      author: metadata.author || getCurrentUser(),
      type: metadata.type || 'progress',
      ...metadata
    };
    
    const yaml = this.generateYAMLFrontmatter(note);
    return currentNotes + '\n' + yaml + '\n' + content + '\n';
  }
  
  generateYAMLFrontmatter(data) {
    const lines = ['---'];
    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value)) {
        lines.push(`${key}: [${value.join(', ')}]`);
      } else {
        lines.push(`${key}: ${value}`);
      }
    }
    lines.push('---');
    return lines.join('\n');
  }
  
  parseNotes(notesField) {
    const blocks = notesField.split(/^---$/m);
    return blocks
      .map(block => this.parseNoteBlock(block))
      .filter(Boolean);
  }
}
```

## Git Integration

```javascript
// src/core/services/git-service.js
class GitService {
  async createTaskBranch(taskId, options = {}) {
    const prefix = options.prefix || 'feature/';
    const branchName = `${prefix}${taskId}`;
    
    await this.exec(`git checkout -b ${branchName}`);
    
    // Update task with branch name
    await api.updateTask(taskId, { branch: branchName });
    
    return branchName;
  }
  
  async commitWithTask(taskId, message) {
    const task = await api.getTask(taskId);
    
    const fullMessage = message || this.generateCommitMessage(task);
    const finalMessage = `${fullMessage}\n\nTask: ${task.string_id}`;
    
    await this.exec(`git commit -m "${finalMessage}"`);
    
    // Record commit
    const sha = await this.getLastCommitSha();
    await this.recordTaskCommit(taskId, sha);
  }
}
```

## Query Engine

```javascript
// src/core/services/query-service.js
class QueryService {
  buildWhereClause(filters) {
    const conditions = [];
    const params = [];
    
    if (filters.status?.length) {
      conditions.push(`status IN (${filters.status.map(() => '?').join(',')})`);
      params.push(...filters.status);
    }
    
    if (filters.assignee) {
      conditions.push('assignee = ?');
      params.push(filters.assignee);
    }
    
    if (filters.priority?.length) {
      conditions.push(`priority IN (${filters.priority.map(() => '?').join(',')})`);
      params.push(...filters.priority);
    }
    
    if (filters.search) {
      conditions.push('(name LIKE ? OR description LIKE ? OR notes LIKE ?)');
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    // Always exclude archived unless explicitly requested
    if (!filters.include_archived) {
      conditions.push("status != 'archived'");
    }
    
    return {
      where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
      params
    };
  }
}
```

## Import/Export

### Markdown Format

```javascript
// src/core/services/export-service.js
class ExportService {
  async exportMarkdown(tasks) {
    const header = `# TaskWerk Export
<!-- Generated: ${new Date().toISOString()} -->
<!-- Version: 0.3.x -->

`;
    
    const taskBlocks = tasks.map(task => this.formatTaskMarkdown(task));
    return header + taskBlocks.join('\n---\n\n');
  }
  
  formatTaskMarkdown(task) {
    return `## ${task.string_id}: ${task.name} [${task.status}]

**Status:** ${task.status}  
**Priority:** ${task.priority}  
**Assignee:** ${task.assignee || 'Unassigned'}  
**Created:** ${task.created_at}  
${task.completed_at ? `**Completed:** ${task.completed_at}  ` : ''}
${task.category ? `**Category:** ${task.category}  ` : ''}
${task.tags.length ? `**Tags:** ${task.tags.map(t => `#${t}`).join(' ')}  ` : ''}

### Description

${task.description || 'No description provided.'}

### Notes

${task.notes || 'No notes yet.'}

${this.formatDependencies(task)}
${this.formatSubtasks(task)}`;
  }
}
```

### Import Parser

```javascript
// src/core/services/import-service.js
class ImportService {
  async parseMarkdown(content) {
    const tasks = [];
    const sections = content.split(/^## /m).filter(Boolean);
    
    for (const section of sections) {
      const task = this.parseTaskSection(section);
      if (task) tasks.push(task);
    }
    
    return tasks;
  }
  
  parseTaskSection(section) {
    const lines = section.split('\n');
    const header = lines[0];
    
    // Parse header: "TASK-001: Task name [status]"
    const match = header.match(/^(TASK-\d+):\s*(.+?)\s*\[(\w+)\]$/);
    if (!match) return null;
    
    const [, string_id, name, status] = match;
    const task = { string_id, name, status };
    
    // Parse metadata fields
    for (const line of lines) {
      if (line.startsWith('**Status:**')) {
        task.status = line.replace('**Status:**', '').trim();
      }
      // ... parse other fields
    }
    
    return task;
  }
}
```

## Configuration

### File Structure

```
.taskwerk/
├── taskwerk.db         # SQLite database
├── config.json         # Core configuration
├── ai-config.json      # AI settings (optional)
├── logs/               # Log files
│   ├── taskwerk.log
│   ├── audit.log
│   └── ai.log
└── backups/            # Auto-backups (optional)
```

### Configuration Schema

```javascript
// .taskwerk/config.json
{
  "core": {
    "defaultPriority": "medium",
    "defaultStatus": "todo",
    "branchPrefix": "feature/",
    "dateFormat": "YYYY-MM-DD",
    "editor": "vim"
  },
  "ui": {
    "color": true,
    "pageSize": 20,
    "confirmDestructive": true
  },
  "git": {
    "autoCommit": false,
    "commitTemplate": "{task.string_id}: {task.name}\\n\\n{task.notes}",
    "pushAfterCommit": false
  },
  "logging": {
    "level": "info",
    "maxFileSize": "10MB",
    "maxFiles": 5,
    "categories": {
      "task.*": "info",
      "ai.*": "debug"
    }
  }
}
```

## Error Handling

```javascript
// src/core/errors.js
class TaskwerkError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

class TaskNotFoundError extends TaskwerkError {
  constructor(taskId) {
    super(`Task not found: ${taskId}`, 'TASK_NOT_FOUND', { taskId });
  }
}

class InvalidStateTransition extends TaskwerkError {
  constructor(taskId, from, to) {
    super(
      `Invalid state transition from ${from} to ${to}`,
      'INVALID_TRANSITION',
      { taskId, from, to }
    );
  }
}

// Usage
try {
  await api.updateTask('TASK-999', { status: 'active' });
} catch (error) {
  if (error.code === 'TASK_NOT_FOUND') {
    console.error('Task does not exist');
  }
}
```

## Testing

### Unit Tests

```javascript
// tests/core/api.test.js
describe('TaskwerkAPI', () => {
  let api;
  let db;
  
  beforeEach(async () => {
    db = await createTestDatabase();
    api = new TaskwerkAPI(db);
  });
  
  describe('createTask', () => {
    it('should create task with required fields', async () => {
      const task = await api.createTask({ name: 'Test task' });
      
      expect(task).toMatchObject({
        name: 'Test task',
        status: 'todo',
        priority: 'medium',
        string_id: expect.stringMatching(/^TASK-\d{3,}$/)
      });
    });
    
    it('should handle parent tasks', async () => {
      const parent = await api.createTask({ name: 'Parent' });
      const child = await api.createTask({
        name: 'Child',
        parent_id: parent.string_id
      });
      
      expect(child.parent_id).toBe(parent.id);
    });
  });
});
```

### Integration Tests

```javascript
// tests/integration/workflows.test.js
describe('Common Workflows', () => {
  it('should handle complete task lifecycle', async () => {
    // Create
    const { stdout: createOut } = await exec('twrk task add "Test task"');
    const taskId = createOut.match(/Created (TASK-\d+)/)[1];
    
    // Update
    await exec(`twrk task update ${taskId} --status active`);
    
    // Complete
    await exec(`twrk task update ${taskId} --status completed`);
    
    // Verify
    const { stdout: showOut } = await exec(`twrk task show ${taskId} --format json`);
    const task = JSON.parse(showOut);
    expect(task.status).toBe('completed');
  });
});
```

## Performance Optimization

### Database Indexes

Already included in schema (see indexes above).

### Query Optimization

```javascript
// Batch operations
async function updateMultipleTasks(updates) {
  const stmt = db.prepare(`
    UPDATE tasks 
    SET status = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE string_id = ?
  `);
  
  const updateMany = db.transaction((updates) => {
    for (const { taskId, status } of updates) {
      stmt.run(status, taskId);
    }
  });
  
  updateMany(updates);
}
```

### Caching

```javascript
class TaskCache {
  constructor(ttl = 300000) { // 5 minutes
    this.cache = new Map();
    this.ttl = ttl;
  }
  
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }
  
  set(key, value) {
    this.cache.set(key, {
      value,
      expires: Date.now() + this.ttl
    });
  }
}
```

## Security Considerations

1. **SQL Injection**: Use parameterized queries
2. **Path Traversal**: Validate file paths for import/export
3. **Command Injection**: Sanitize git commands
4. **API Keys**: Store in separate config, never in logs
5. **Audit Trail**: Log all mutations with user info

## Development Setup

```bash
# Clone repository
git clone https://github.com/taskwerk/taskwerk.git
cd taskwerk

# Install dependencies
npm install

# Run tests
npm test

# Run in development
npm run dev

# Build for production
npm run build
```

## Deployment

```bash
# Build package
npm run package

# Publish to npm
npm publish

# Users install globally
npm install -g taskwerk
```

## Migration from v2

```javascript
// src/migrations/v2-to-v3.js
async function migrateFromV2(v2FilePath) {
  const v2Content = await fs.readFile(v2FilePath, 'utf-8');
  const v2Tasks = parseV2Format(v2Content);
  
  for (const v2Task of v2Tasks) {
    const v3Task = {
      string_id: v2Task.id,
      name: v2Task.title,
      description: v2Task.description,
      status: mapV2Status(v2Task.status),
      // ... map other fields
    };
    
    await api.createTask(v3Task);
  }
}
```

## Future Considerations

1. **Plugin System**: Allow custom commands
2. **Remote Sync**: Optional cloud backup
3. **Team Features**: Multi-user support
4. **Web UI**: Optional web interface
5. **Mobile Apps**: iOS/Android clients

## Debugging

```bash
# Enable debug logging
TASKWERK_LOG_LEVEL=debug twrk task list

# Inspect database
sqlite3 .taskwerk/taskwerk.db

# View logs
twrk logs show --category "task.*" --tail 100
```