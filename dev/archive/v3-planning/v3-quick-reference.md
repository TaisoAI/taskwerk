# Taskwerk v3 Quick Reference

## Task States
```
todo      → Not started
active    → Working on it (NOT "in_progress")
paused    → Temporarily stopped
blocked   → Can't proceed
completed → Done
archived  → Hidden
```

## Command Structure
```bash
# Tasks
twrk task add "Fix bug"
twrk task list --status active
twrk task show TASK-001
twrk task update TASK-001 --status active
twrk task delete TASK-001 --force

# Data
twrk data export --format markdown
twrk data import old-tasks.md

# Git
twrk git branch TASK-001
twrk git commit TASK-001

# AI
twrk ai ask "what's blocked?"
twrk ai agent "complete TASK-001"
twrk "natural language query"

# Logs
twrk logs list --level error
twrk logs show --tail 50
```

## Database Fields
- `id` - Internal numeric ID
- `string_id` - User-facing (TASK-001)
- `name` - Task title
- `description` - Details
- `notes` - Working notes (mutable)
- `status` - Current state
- `priority` - high/medium/low
- `assignee` - Who's working on it

## Notes Format
```markdown
---
created_at: 2024-01-15T10:00:00Z
author: john
type: progress
---
Found the bug in auth.js
```

## State Transitions
- todo → active, blocked, completed, archived
- active → paused, blocked, completed
- paused → active, blocked, completed
- blocked → todo, active, completed
- completed → archived
- archived → (terminal)

## Remember
- Use `active` not `in_progress`
- Use subcommands (`task add` not `add`)
- Prefer `archive` over `delete`
- Notes field is mutable, notes table is immutable
- Natural language auto-detects AI mode

## Files
- `.taskwerk/taskwerk.db` - Database
- `.taskwerk/config.json` - Core config
- `.taskwerk/ai-config.json` - AI config
- `.taskwerk/logs/` - Log files
- `taskwerk_rules.md` - Project guidelines