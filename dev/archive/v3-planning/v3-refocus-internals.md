# Taskwerk v3 Internals: Data Structures and Storage

## Task Data Structure

### Core Task Fields

```typescript
interface Task {
  // Identity
  id: number;                    // Internal numeric ID (auto-increment)
  string_id: string;             // User-facing ID (TASK-001)
  
  // Core Fields
  name: string;                  // Task title/summary (required)
  description: string;           // Detailed description (markdown)
  notes: string;                 // Working notes, updated as work progresses (markdown)
  status: TaskStatus;            // Current state
  
  // Metadata
  created_at: ISO8601;           // When created
  updated_at: ISO8601;           // Last modification
  completed_at: ISO8601 | null;  // When completed
  
  // Assignment & Priority
  assignee: string | null;       // Who's responsible
  priority: Priority;            // high|medium|low
  
  // Time Tracking
  estimate: number | null;       // Hours estimated
  actual: number | null;         // Hours actually spent
  due_date: ISO8601 | null;      // When due
  
  // Progress & Work
  progress: number;              // 0-100 percentage
  
  // Relationships
  parent_id: number | null;      // Parent task ID
  
  // Git Integration
  branch: string | null;         // Associated git branch
  commits: string[];             // Related commit SHAs
  
  // Organization
  category: string | null;       // Project/module/area
  tags: string[];                // Flexible labeling
  
  // Workflow
  blocked_reason: string | null; // Why blocked (if status=blocked)
  
  // Flags
  is_milestone: boolean;         // Is this a milestone?
  is_template: boolean;          // Template for reuse?
}
```

### Enumerations

```typescript
enum TaskStatus {
  TODO = 'todo',           // Not started
  ACTIVE = 'active',       // Currently being worked on
  PAUSED = 'paused',       // Temporarily stopped
  BLOCKED = 'blocked',     // Cannot proceed
  COMPLETED = 'completed', // Finished successfully
  ARCHIVED = 'archived'    // Hidden from normal views
}

enum Priority {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}
```

### Example Task JSON

```json
{
  "id": 42,
  "string_id": "TASK-042",
  "name": "Fix login timeout bug",
  "description": "Users are being logged out after 5 minutes of inactivity.\n\n## Acceptance Criteria\n- Session timeout should be 30 minutes\n- Warning shown at 25 minutes\n- Remember me option extends to 7 days",
  "notes": "---\ncreated_at: 2024-01-15T10:00:00Z\nauthor: john\ntype: investigation\n---\nFound timeout config in auth.js:42\n\n---\ncreated_at: 2024-01-15T11:30:00Z\nauthor: john\ntype: finding\n---\nIssue is in session middleware, not auth module. The timeout is being set globally rather than per-session.\n\n---\ncreated_at: 2024-01-15T14:00:00Z\nauthor: john\ntype: progress\n---\nFixed timeout, working on warning dialog\n\n## TODO\n- [ ] Add warning dialog at 25min\n- [ ] Test remember me integration\n- [ ] Update documentation\n\n---\ncreated_at: 2024-01-15T15:45:00Z\nauthor: ai\ntype: suggestion\n---\nConsider using the existing NotificationService for the timeout warning. See notification-service.js:78 for similar implementation.",
  "status": "active",
  "created_at": "2024-01-15T09:30:00Z",
  "updated_at": "2024-01-15T14:22:17Z",
  "completed_at": null,
  "assignee": "john",
  "priority": "high",
  "estimate": 4,
  "actual": null,
  "due_date": "2024-01-16T17:00:00Z",
  "progress": 60,
  "parent_id": null,
  "branch": "fix/TASK-042-login-timeout",
  "commits": [
    "a1b2c3d4",
    "e5f6g7h8"
  ],
  "category": "authentication",
  "tags": ["bug", "security", "ux"],
  "blocked_reason": null,
  "is_milestone": false,
  "is_template": false
}
```

## Related Data Structures

### Task Notes (Dual Approach)

We use a dual approach for notes:

1. **`task.notes` field** - Mutable working notes that get updated frequently
2. **`task_notes` table** - Immutable history of significant events

```typescript
interface TaskNote {
  id: number;
  task_id: number;
  content: string;              // Markdown content
  created_at: ISO8601;
  created_by: string | null;    // User or 'ai'
  note_type: NoteType;          // comment|plan|update|block|complete
}

enum NoteType {
  COMMENT = 'comment',          // General note
  PLAN = 'plan',                // Implementation plan
  UPDATE = 'update',            // Status update
  BLOCK = 'block',              // Blocking reason
  COMPLETE = 'complete'         // Completion summary
}
```

#### When to use which:

- **Update `task.notes`**: For working notes, progress tracking, personal reminders
  ```bash
  twrk task update TASK-001 --note "Found the bug in auth.js:42"
  ```

- **Create `task_notes` entry**: For significant events, decisions, handoffs
  ```bash
  twrk task update TASK-001 --status blocked --reason "Waiting for API access"
  # Creates both: updates task.notes AND creates a task_note entry
  ```

### Notes Format: Markdown with YAML Frontmatter

The `task.notes` field uses markdown with YAML frontmatter for each note entry:

```markdown
---
created_at: 2024-01-15T10:00:00Z
author: john
type: investigation
---
Found timeout config in auth.js:42

---
created_at: 2024-01-15T11:30:00Z  
author: ai
type: suggestion
tags: [performance, optimization]
---
Consider caching session data to reduce database queries.
See similar pattern in user-service.js
```

#### Standard YAML Fields:

- `created_at` (required): ISO8601 timestamp
- `author` (required): Username or 'ai'
- `type` (optional): Note category
  - `investigation` - Exploring the problem
  - `finding` - Discovered information
  - `progress` - Work update
  - `blocker` - Issue encountered
  - `suggestion` - Recommendation
  - `decision` - Architectural/implementation choice
  - `todo` - Task to complete
- `tags` (optional): Array of tags
- `references` (optional): Related files, lines, tasks

#### Benefits:

1. **Structured yet readable** - Humans can read, machines can parse
2. **Queryable** - Can extract notes by type, author, date
3. **Extensible** - Add new fields without breaking
4. **Git-friendly** - Clear diffs when notes change
5. **AI-parseable** - LLMs understand YAML+Markdown naturally

#### Implementation:

```javascript
function appendNote(task, content, metadata = {}) {
  const note = {
    created_at: new Date().toISOString(),
    author: getCurrentUser() || 'unknown',
    type: 'progress',
    ...metadata
  };
  
  const yaml = generateYAMLFrontmatter(note);
  task.notes += `\n${yaml}\n${content}\n`;
}

function parseNotes(notesField) {
  // Split by YAML frontmatter blocks
  const blocks = notesField.split(/^---$/m);
  return blocks.map(parseNoteBlock).filter(Boolean);
}
```

### Task Dependencies

```typescript
interface TaskDependency {
  id: number;
  task_id: number;              // Dependent task
  depends_on_id: number;        // Prerequisite task
  dependency_type: 'blocks';    // Currently only one type
  created_at: ISO8601;
}
```

### Task History

```typescript
interface TaskHistory {
  id: number;
  task_id: number;
  field_name: string;           // What changed
  old_value: any;               // Previous value
  new_value: any;               // New value
  changed_at: ISO8601;
  changed_by: string | null;    // User or 'ai'
  change_type: ChangeType;
}

enum ChangeType {
  CREATE = 'create',
  UPDATE = 'update',
  STATUS_CHANGE = 'status_change',
  NOTE_ADDED = 'note_added'
}
```

## SQLite Schema

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

-- Task notes/comments
CREATE TABLE task_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  note_type TEXT DEFAULT 'comment',
  
  CHECK (note_type IN ('comment','plan','update','block','complete'))
);

-- Task history for audit trail
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

-- Tags (many-to-many)
CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE task_tags (
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, tag_id)
);

-- Git commits (many-to-many)
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
CREATE INDEX idx_dependencies_task ON task_dependencies(task_id);
CREATE INDEX idx_dependencies_depends ON task_dependencies(depends_on_id);
CREATE INDEX idx_notes_task ON task_notes(task_id);
CREATE INDEX idx_history_task ON task_history(task_id);

-- Triggers for auto-updating timestamps
CREATE TRIGGER update_task_timestamp 
AFTER UPDATE ON tasks
BEGIN
  UPDATE tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
```

## Command to Storage Mapping

### Create Operations

```bash
twrk task add "Fix login bug" --priority high --assignee john
```

Creates:
1. New row in `tasks` table
2. Auto-generates next `string_id` (TASK-XXX)
3. Sets `created_at` and `updated_at`
4. Records in `task_history` with `change_type='create'`

### Update Operations

```bash
twrk task update TASK-001 --status active --note "Starting work"
```

1. Updates `tasks` row (status change)
2. Appends to `task.notes` field with timestamp
3. Creates `task_notes` entry (because status changed)
4. Records old/new values in `task_history`
5. Triggers update `updated_at`

```bash
twrk task update TASK-001 --note "Found bug in auth module"
```

1. Appends to `task.notes` field only
2. Updates `updated_at`
3. No `task_notes` entry (just a working note)

### Query Operations

```bash
twrk task list --status active --assignee john
```

Translates to:
```sql
SELECT * FROM tasks 
WHERE status = 'active' 
  AND assignee = 'john'
  AND status != 'archived'
ORDER BY priority DESC, created_at ASC;
```

### Relationship Operations

```bash
twrk task add "Subtask" --parent TASK-001 --depends-on TASK-002
```

1. Creates task with `parent_id = 1`
2. Creates `task_dependencies` row linking to TASK-002

## State Transition Rules

### Valid Transitions

```
todo → active, blocked, completed, archived
active → paused, blocked, completed
paused → active, blocked, completed
blocked → todo, active, completed
completed → archived
archived → (none - terminal state)
```

### Transition Side Effects

1. **todo → active**
   - Sets first `started_at` if null
   - May pause other active tasks (configurable)

2. **any → completed**
   - Sets `completed_at`
   - Sets `progress = 100`
   - Checks dependencies and may unblock others

3. **any → blocked**
   - Requires `blocked_reason`
   - Notifies assignee (if configured)

4. **completed → archived**
   - Hides from normal queries
   - Preserves all data and history

## Query Optimizations

### Common Query Patterns

1. **Active tasks for user**
   ```sql
   SELECT * FROM tasks 
   WHERE assignee = ? AND status = 'active'
   ORDER BY priority DESC;
   ```

2. **Ready tasks (no blockers)**
   ```sql
   SELECT t.* FROM tasks t
   WHERE t.status = 'todo'
   AND NOT EXISTS (
     SELECT 1 FROM task_dependencies td
     JOIN tasks dep ON td.depends_on_id = dep.id
     WHERE td.task_id = t.id
     AND dep.status != 'completed'
   );
   ```

3. **Task with full context**
   ```sql
   -- Main task
   SELECT * FROM tasks WHERE string_id = ?;
   
   -- Notes
   SELECT * FROM task_notes WHERE task_id = ? ORDER BY created_at;
   
   -- Dependencies
   SELECT t.* FROM tasks t
   JOIN task_dependencies td ON t.id = td.depends_on_id
   WHERE td.task_id = ?;
   
   -- History
   SELECT * FROM task_history WHERE task_id = ? ORDER BY changed_at;
   ```

## Data Integrity Rules

1. **ID Generation**
   - `string_id` must be unique
   - Format: TASK-NNN (padded to 3 digits minimum)
   - Never reuse IDs, even after deletion

2. **Status Consistency**
   - Parent task cannot be completed if children are not
   - Circular dependencies are prevented
   - Blocked tasks must have reason

3. **Soft Deletes**
   - Tasks are archived, not deleted
   - Maintains referential integrity
   - Preserves audit trail

4. **Git Integration**
   - Branch names are suggestions, not enforced
   - Commits are associated post-facto
   - Multiple tasks can reference same branch

## Performance Considerations

1. **Indexes**
   - Status queries are most common
   - Assignee filtering is frequent
   - Time-based queries need date indexes

2. **Denormalization**
   - Tag names could be denormalized for performance
   - Dependency counts could be cached
   - Latest note could be stored on task

3. **Query Limits**
   - Default limit of 100 for list operations
   - Pagination for large result sets
   - Summary counts use separate queries

## Import/Export Formats

### Markdown Format

The markdown export format is designed to be human-readable and editable while preserving all task data:

```markdown
# TaskWerk Export
<!-- Generated: 2024-01-15T10:00:00Z -->
<!-- Version: 3.0 -->

## TASK-001: Implement user authentication [completed]

**Status:** completed  
**Priority:** high  
**Assignee:** john  
**Created:** 2024-01-10T09:00:00Z  
**Completed:** 2024-01-14T17:30:00Z  
**Category:** security  
**Tags:** #auth #security #sprint-23  
**Estimate:** 16h  
**Actual:** 18h  

### Description

Implement complete user authentication system including:
- Login/logout
- Password reset
- Remember me
- Session management

### Dependencies
- Depends on: None
- Blocks: TASK-002, TASK-003

### Notes

---
created_at: 2024-01-10T10:00:00Z
author: john
type: plan
---
Breaking this down into:
1. Database schema
2. API endpoints  
3. Frontend forms
4. Session middleware

---
created_at: 2024-01-12T14:00:00Z
author: john
type: progress
---
Schema complete, working on API endpoints

### Subtasks
- [x] TASK-004: Design auth schema
- [x] TASK-005: Create auth API
- [x] TASK-006: Build login UI
- [x] TASK-007: Add session management

---

## TASK-002: Add password reset flow [active]

**Status:** active  
**Priority:** high  
**Assignee:** jane  
**Created:** 2024-01-15T09:00:00Z  
**Category:** security  
**Tags:** #auth #ux  
**Depends on:** TASK-001  
**Branch:** feature/TASK-002-password-reset  

### Description

Add self-service password reset functionality.

### Notes

---
created_at: 2024-01-15T10:00:00Z
author: jane
type: investigation
---
Researching email service options for sending reset links

```

### JSON Format

```json
{
  "version": "3.0",
  "exported_at": "2024-01-15T10:00:00Z",
  "tasks": [
    {
      "string_id": "TASK-001",
      "name": "Implement user authentication",
      "description": "Implement complete user authentication system...",
      "notes": "---\ncreated_at: 2024-01-10T10:00:00Z\n...",
      "status": "completed",
      "priority": "high",
      "assignee": "john",
      "created_at": "2024-01-10T09:00:00Z",
      "updated_at": "2024-01-14T17:30:00Z",
      "completed_at": "2024-01-14T17:30:00Z",
      "category": "security",
      "tags": ["auth", "security", "sprint-23"],
      "estimate": 16,
      "actual": 18,
      "dependencies": [],
      "blocks": ["TASK-002", "TASK-003"],
      "subtasks": ["TASK-004", "TASK-005", "TASK-006", "TASK-007"],
      "commits": ["abc123", "def456"]
    }
  ],
  "metadata": {
    "total_tasks": 7,
    "task_id_counter": 7,
    "categories": ["security", "frontend", "backend"],
    "assignees": ["john", "jane"]
  }
}
```

### Import Behavior

#### Markdown Import
1. Parses markdown structure to extract tasks
2. Preserves task IDs if no conflicts
3. Generates new IDs if conflicts exist
4. Maintains relationships if all referenced tasks exist
5. Imports notes with YAML frontmatter intact

#### Merge Strategies
- **Default**: Skip existing tasks (by string_id)
- **--merge**: Update existing tasks with imported data
- **--replace**: Replace existing tasks entirely
- **--prefix**: Add prefix to imported task IDs (IMPORT-001)

#### Example Commands

```bash
# Export everything to markdown
twrk data export --output tasks.md

# Export completed tasks from sprint
twrk data export --status completed --tag sprint-23 --output sprint-23-done.md

# Export as JSON for backup
twrk data export --format json --output backup-2024-01-15.json

# Import markdown file
twrk data import old-tasks.md

# Import with merge
twrk data import updates.md --merge

# Import with prefix to avoid conflicts  
twrk data import client-tasks.md --prefix CLIENT
```

## Logging Architecture

### Design Principles

1. **Separate Concerns**: Application logs vs audit logs vs debug logs
2. **Structured Logging**: JSON format for machine parsing
3. **Performance**: Async, non-blocking, minimal overhead
4. **Privacy**: Never log sensitive data (API keys, passwords)
5. **Rotation**: Automatic cleanup of old logs

### Log Types and Locations

```
.taskwerk/
├── logs/
│   ├── taskwerk.log         # Application logs (info, warnings, errors)
│   ├── audit.log            # User actions audit trail
│   ├── ai.log               # AI interactions (prompts, responses)
│   └── debug.log            # Debug info (only if enabled)
```

### Log Levels

```javascript
const LogLevel = {
  ERROR: 0,   // System errors, exceptions
  WARN: 1,    // Warnings, deprecations
  INFO: 2,    // Normal operations
  DEBUG: 3,   // Detailed debugging
  TRACE: 4    // Very verbose tracing
};
```

### Log Entry Format

```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "INFO",
  "category": "task.update",
  "user": "john",
  "sessionId": "abc123",
  "message": "Task updated",
  "data": {
    "taskId": "TASK-042",
    "fields": ["status", "notes"],
    "oldStatus": "todo",
    "newStatus": "active"
  },
  "context": {
    "command": "task update",
    "args": ["TASK-042", "--status", "active"],
    "cwd": "/projects/myapp"
  },
  "duration": 45
}
```

### Logging Categories

```javascript
const LogCategory = {
  // Core operations
  'task.create': 'Task creation',
  'task.update': 'Task updates',
  'task.delete': 'Task deletion',
  'task.query': 'Task queries',
  
  // State changes
  'state.change': 'Task state transitions',
  'state.blocked': 'Task blocked events',
  
  // Dependencies
  'deps.add': 'Dependency added',
  'deps.remove': 'Dependency removed',
  'deps.circular': 'Circular dependency detected',
  
  // Git operations
  'git.branch': 'Branch operations',
  'git.commit': 'Commit operations',
  
  // AI operations
  'ai.request': 'AI prompt sent',
  'ai.response': 'AI response received',
  'ai.error': 'AI operation failed',
  'ai.tool': 'AI tool execution',
  
  // System
  'system.init': 'Taskwerk initialization',
  'system.error': 'System errors',
  'system.config': 'Configuration changes',
  
  // Performance
  'perf.slow': 'Slow operations',
  'perf.query': 'Database query timing'
};
```

### Implementation

```javascript
// src/utils/logger.js
class TaskwerkLogger {
  constructor(options = {}) {
    this.level = options.level || LogLevel.INFO;
    this.outputs = [];
    
    // File output
    if (options.file) {
      this.outputs.push(new FileOutput(options.file));
    }
    
    // Console output (development)
    if (options.console && process.env.NODE_ENV !== 'production') {
      this.outputs.push(new ConsoleOutput());
    }
    
    // Remote logging (future)
    if (options.remote) {
      this.outputs.push(new RemoteOutput(options.remote));
    }
  }
  
  log(level, category, message, data = {}) {
    if (level > this.level) return;
    
    const entry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      category,
      user: getCurrentUser(),
      sessionId: getSessionId(),
      message,
      data: this.sanitize(data),
      context: this.getContext()
    };
    
    // Async write to all outputs
    this.outputs.forEach(output => {
      setImmediate(() => output.write(entry));
    });
  }
  
  sanitize(data) {
    // Remove sensitive fields
    const sensitive = ['password', 'api_key', 'token', 'secret'];
    return sanitizeObject(data, sensitive);
  }
}

// Singleton instance
export const logger = new TaskwerkLogger({
  file: '.taskwerk/logs/taskwerk.log',
  console: true,
  level: config.logLevel || LogLevel.INFO
});

// Convenience methods
export const logInfo = (category, message, data) => 
  logger.log(LogLevel.INFO, category, message, data);

export const logError = (category, message, error) => 
  logger.log(LogLevel.ERROR, category, message, {
    error: error.message,
    stack: error.stack
  });

// Audit logger (always logs, separate file)
export const audit = new TaskwerkLogger({
  file: '.taskwerk/logs/audit.log',
  level: LogLevel.INFO
});

export const logAudit = (action, data) => 
  audit.log(LogLevel.INFO, 'audit.' + action, action, data);
```

### Usage Examples

```javascript
// In task operations
async function updateTask(taskId, updates) {
  const startTime = Date.now();
  
  try {
    logInfo('task.update', `Updating task ${taskId}`, {
      taskId,
      updates: Object.keys(updates)
    });
    
    const oldTask = await getTask(taskId);
    const newTask = await applyUpdates(taskId, updates);
    
    // Log state changes specially
    if (oldTask.status !== newTask.status) {
      logInfo('state.change', `Task ${taskId} state change`, {
        taskId,
        from: oldTask.status,
        to: newTask.status
      });
    }
    
    // Audit log for compliance
    logAudit('task.updated', {
      taskId,
      changes: diffTasks(oldTask, newTask)
    });
    
    // Performance logging
    const duration = Date.now() - startTime;
    if (duration > 100) {
      logWarn('perf.slow', `Slow task update: ${duration}ms`, {
        taskId,
        duration
      });
    }
    
    return newTask;
  } catch (error) {
    logError('task.update', `Failed to update task ${taskId}`, error);
    throw error;
  }
}

// In AI operations
async function handleAIRequest(prompt, mode) {
  const requestId = generateId();
  
  // Log the request (sanitized)
  logInfo('ai.request', 'AI request received', {
    requestId,
    mode,
    promptLength: prompt.length,
    promptPreview: prompt.substring(0, 100) + '...'
  });
  
  try {
    const response = await callAI(prompt);
    
    logInfo('ai.response', 'AI response received', {
      requestId,
      responseLength: response.length,
      tokensUsed: response.usage?.total_tokens
    });
    
    return response;
  } catch (error) {
    logError('ai.error', 'AI request failed', {
      requestId,
      error: error.message
    });
    throw error;
  }
}
```

### Log Rotation

```javascript
// Automatic log rotation
class LogRotator {
  constructor(logDir) {
    this.logDir = logDir;
    this.maxSize = 10 * 1024 * 1024; // 10MB
    this.maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    this.maxFiles = 5;
  }
  
  async rotate() {
    const files = await fs.readdir(this.logDir);
    
    for (const file of files) {
      const stats = await fs.stat(path.join(this.logDir, file));
      
      // Rotate by size
      if (stats.size > this.maxSize) {
        await this.rotateFile(file);
      }
      
      // Delete old files
      if (Date.now() - stats.mtime > this.maxAge) {
        await fs.unlink(path.join(this.logDir, file));
      }
    }
  }
  
  async rotateFile(filename) {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const rotatedName = `${filename}.${timestamp}`;
    await fs.rename(
      path.join(this.logDir, filename),
      path.join(this.logDir, rotatedName)
    );
  }
}
```

### Configuration

```json
// .taskwerk/config.json
{
  "logging": {
    "level": "INFO",
    "file": {
      "enabled": true,
      "path": ".taskwerk/logs",
      "maxSize": "10MB",
      "maxAge": "7d",
      "maxFiles": 5
    },
    "console": {
      "enabled": false,
      "colorize": true
    },
    "categories": {
      "task.*": "INFO",
      "ai.*": "DEBUG",
      "perf.*": "WARN"
    }
  }
}
```

### Privacy and Security

1. **Never log**:
   - Passwords, API keys, tokens
   - Personal information (emails, phones)
   - File contents (only metadata)
   - Full AI prompts (only previews)

2. **Always log**:
   - Task IDs and state changes
   - User actions (for audit)
   - Errors with stack traces
   - Performance metrics

3. **Sanitization**:
   ```javascript
   function sanitizeForLog(obj) {
     const sensitive = /password|token|key|secret|auth/i;
     return JSON.parse(JSON.stringify(obj, (key, value) => {
       if (sensitive.test(key)) {
         return '[REDACTED]';
       }
       return value;
     }));
   }
   ```

### Log Query Commands

#### `logs list` - View log entries
```bash
# View recent errors
twrk logs list --level error --since "1 hour"

# View task operations by user
twrk logs list --category "task.*" --user john --limit 50

# View all AI interactions today
twrk logs list --category "ai.*" --since "today"

# Filter by multiple criteria
twrk logs list --level warn,error --category "ai.*,task.*" --since "2024-01-15"
```

#### `logs show` - Real-time log viewing
```bash
# Tail logs in real-time (like tail -f)
twrk logs show --tail 50 --follow

# Show only AI operations
twrk logs show --category "ai.*" --tail 100

# Show with custom format
twrk logs show --format "{timestamp} [{level}] {message}"
```

#### `logs stats` - Log analytics
```bash
# Show log statistics
twrk logs stats
# Output:
# Total entries: 15,234
# Date range: 2024-01-01 to 2024-01-15
# Errors: 23
# Warnings: 145
# Info: 15,066

# Group by category
twrk logs stats --group-by category
# Output:
# task.create: 234
# task.update: 1,456
# ai.request: 89
# ai.response: 89

# AI usage statistics
twrk logs stats --category "ai.*" --group-by user
# Output:
# john: 45 requests (12,000 tokens)
# jane: 23 requests (5,400 tokens)
# ai: 21 requests (8,900 tokens)

# Performance analysis
twrk logs stats --category "perf.*" --show-slowest 10
```

#### `logs export` - Export for analysis
```bash
# Export all logs as JSON
twrk logs export --format json --output logs-2024-01.json

# Export AI interactions as CSV
twrk logs export --category "ai.*" --format csv --output ai-usage.csv

# Export with custom fields
twrk logs export --fields "timestamp,user,category,message,data.taskId" --output tasks.csv
```

#### `logs search` - Full-text search
```bash
# Search for specific error
twrk logs search "connection timeout"

# Search with context
twrk logs search "TASK-042" --context 5

# Regex search
twrk logs search --regex "error.*auth.*failed"
```

#### `logs clean` - Maintenance
```bash
# Clean logs older than 30 days
twrk logs clean --older-than "30 days"

# Archive old logs
twrk logs clean --archive --older-than "7 days" --output archive-2024-01.tar.gz

# Show what would be cleaned (dry run)
twrk logs clean --older-than "30 days" --dry-run
```

### Log Output Examples

#### AI Interaction Log
```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "INFO",
  "category": "ai.request",
  "user": "john",
  "message": "AI request received",
  "data": {
    "requestId": "req_abc123",
    "mode": "agent",
    "promptPreview": "Complete TASK-042 and update the documentation...",
    "model": "claude-3"
  }
}
{
  "timestamp": "2024-01-15T10:30:47.456Z",
  "level": "INFO", 
  "category": "ai.tool",
  "user": "john",
  "message": "AI tool execution",
  "data": {
    "requestId": "req_abc123",
    "tool": "task.update",
    "args": {
      "taskId": "TASK-042",
      "status": "completed"
    }
  }
}
{
  "timestamp": "2024-01-15T10:30:48.789Z",
  "level": "INFO",
  "category": "ai.response",
  "user": "john",
  "message": "AI response received",
  "data": {
    "requestId": "req_abc123",
    "tokensUsed": 453,
    "duration": 3333,
    "success": true
  }
}
```

#### Performance Log
```json
{
  "timestamp": "2024-01-15T10:31:00.123Z",
  "level": "WARN",
  "category": "perf.slow",
  "message": "Slow operation detected",
  "data": {
    "operation": "task.list",
    "duration": 523,
    "filters": {
      "status": "active",
      "assignee": "john"
    },
    "resultCount": 145
  }
}
```

## Future Schema Evolution

Reserved fields for future use:
- `team_id` - Multi-team support
- `project_id` - Project grouping
- `recurring_pattern` - Recurring tasks
- `time_entries` - Time tracking detail
- `external_id` - Integration with other systems