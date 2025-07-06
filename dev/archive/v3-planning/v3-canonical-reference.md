# Taskwerk v3 Canonical Reference

This document serves as the single source of truth for v3 terminology, architecture, and implementation details. It resolves conflicts between various v3 documents and establishes the authoritative definitions.

## Status: Official v3 Reference
**Last Updated**: 2025-07-05
**Supersedes**: Conflicting definitions in other v3 documents

## Core Terminology

### Task States (Authoritative)

The following six states are the ONLY valid task states in v3:

```
todo       → Task exists but work hasn't started
active     → Currently being worked on (NOT "in_progress")
paused     → Temporarily stopped but will resume
blocked    → Cannot proceed due to external dependency
completed  → Work is finished successfully
archived   → Removed from active view (completed or cancelled)
```

**Note**: `in_progress` is deprecated. Use `active` in all contexts.

### Command Structure (Authoritative)

V3 uses a **subcommand structure** to avoid namespace pollution:

```bash
# Task operations
taskwerk task add "Fix login bug"
taskwerk task list [--status active]
taskwerk task show TASK-001
taskwerk task update TASK-001 --status active
taskwerk task delete TASK-001 [--force]

# Data operations
taskwerk data export [--format markdown]
taskwerk data import tasks.md

# Git operations
taskwerk git branch TASK-001
taskwerk git commit TASK-001

# AI operations
taskwerk ai ask "what tasks are blocked?"
taskwerk ai agent "complete TASK-001"
taskwerk ai raw < input.txt

# System operations
taskwerk init
taskwerk status
taskwerk config

# Log operations
taskwerk logs list
taskwerk logs show
taskwerk logs stats
```

**Shell Alias**: `twrk` is the official short alias.

### Database Schema (Authoritative)

```sql
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  string_id TEXT UNIQUE NOT NULL,        -- Format: TASK-XXX
  name TEXT NOT NULL,
  description TEXT,
  notes TEXT DEFAULT '',                 -- Mutable working notes
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
```

### Notes Implementation (Authoritative)

V3 uses a **dual approach** for notes:

1. **`task.notes` field** - Mutable working notes in the tasks table
   - Updated frequently during work
   - Uses markdown with YAML frontmatter format
   - Contains the current working state

2. **`task_notes` table** - Immutable audit trail
   - Created for significant events only
   - Preserves history of important decisions/changes
   - Never updated, only inserted

Example of notes field format:
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
---
Consider caching session data
```

### Delete vs Archive vs Remove (Authoritative)

- **`task update --status archived`** - Soft delete (preferred)
- **`task delete`** - Permanently removes task (requires --force)
- **`task remove`** - Alias for delete (NOT IMPLEMENTED - avoid confusion)
- **`task purge`** - NOT IMPLEMENTED (considered but rejected)

## Architecture (Authoritative)

### Three-Layer Architecture

```
1. CLI Layer (src/cli/)
   - Parse commands using subcommand structure
   - Format output
   - Handle user interaction

2. Core Layer (src/core/)
   - Task CRUD operations
   - State management
   - Query engine
   - Git integration

3. Storage Layer (SQLite)
   - Single source of truth
   - Schema as defined above
   - Easy to backup/query externally
```

### AI Module (Optional)

```
src/ai/
├── index.js             # Entry point, mode detection
├── ask.js               # Read-only query handler
├── agent.js             # Action mode handler
├── raw.js               # Pipeline mode handler
├── config.js            # AI configuration manager
└── tools/               # Taskwerk command bindings
```

## State Transitions (Authoritative)

Valid state transitions:

```
todo → active, blocked, completed, archived
active → paused, blocked, completed
paused → active, blocked, completed
blocked → todo, active, completed
completed → archived
archived → (none - terminal state)
```

## Import/Export Formats (Authoritative)

### Markdown Format

```markdown
# TaskWerk Export
<!-- Generated: 2024-01-15T10:00:00Z -->
<!-- Version: 3.0 -->

## TASK-001: Task name [status]

**Status:** active  
**Priority:** high  
**Assignee:** john  
[... other fields ...]

### Description
[description content]

### Notes
[notes with YAML frontmatter]
```

### JSON Format

As specified in v3-refocus-internals.md (authoritative for JSON structure).

## Logging Architecture (Authoritative)

Log files location:
```
.taskwerk/
├── logs/
│   ├── taskwerk.log    # Application logs
│   ├── audit.log       # User actions audit
│   ├── ai.log          # AI interactions
│   └── debug.log       # Debug info (if enabled)
```

## Configuration Files

```
.taskwerk/
├── taskwerk.db          # SQLite database
├── config.json          # Core configuration
├── ai-config.json       # AI configuration (separate)
└── taskwerk_rules.md    # Project guidelines (optional)
```

## Conflict Resolutions

### From v3-architecture.md
- ❌ Uses "in_progress" → ✅ Use "active"
- ❌ Flat command structure → ✅ Use subcommands
- ❌ Complex enforcement → ✅ Guidelines in taskwerk_rules.md
- ✅ SQLite as source of truth (keep)
- ✅ API-driven architecture (keep)

### From v3-common-workflows-and-concepts.md
- Review and update to match this canonical reference
- Preserve valuable workflow examples
- Update command syntax to subcommand structure

### From v3-refocus-proposal.md
- ✅ This is the primary source for refocused design
- ✅ All definitions here are authoritative

### From v3-refocus-internals.md
- ✅ This is the primary source for technical details
- ✅ Schema and data structures are authoritative

### From v3-refocus-mcp.md
- ✅ MCP integration details are authoritative
- ✅ No conflicts with core design

## Implementation Priority

1. **Core Task Management** (v3.0)
   - Basic CRUD with new schema
   - State transitions
   - Subcommand CLI structure

2. **Import/Export** (v3.0)
   - Markdown and JSON formats
   - Migration from v2

3. **Git Integration** (v3.0)
   - Basic branch/commit operations

4. **AI Module** (v3.1)
   - Three modes: ask, agent, raw
   - Natural language shortcuts

5. **MCP Integration** (v3.2)
   - After core is stable
   - No breaking changes

## Summary

This canonical reference establishes:
- `active` not `in_progress` for task state
- Subcommand structure not flat commands
- Dual notes approach (field + table)
- `delete` requires --force, prefer `archive`
- Three-layer architecture
- Guidelines over enforcement

All v3 documents should be updated to match these definitions.