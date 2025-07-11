# Taskwerk v0.6.x CLI Command Reference

**Version**: 0.6.x series  
**Command**: `taskwerk` (alias: `twrk`)  
**Last Updated**: 2025-01-11

## Overview

Taskwerk is a git-aware task management CLI designed for developers and AI agents working together. This document is the canonical reference for all v0.6.x CLI commands.

## Core Principles

1. **All commands route through internal API** - never touch DB directly
2. **Pipe/alias support** - `twrk` alias, stdin/stdout friendly
3. **No unapproved new commands** - this spec is the contract
4. **Git-aware** - integrates naturally with git workflows
5. **AI-ready** - built for human-AI collaboration

## Command Structure

```bash
taskwerk <command> [subcommand] [options]
twrk <command> [subcommand] [options]      # Short alias
```

---

## Meta/Utility Commands

### `about`
Print Taskwerk ASCII art, version, repository info, and basic help.

```bash
twrk about

Example output:
  ╔════════════════════════════════════════╗
  ║           TASKWERK v0.6.0              ║
  ║   Git-aware task management for devs   ║
  ╚════════════════════════════════════════╝
  
  Version: 0.6.0
  Repo: https://github.com/deftio/taskwerk
  License: MIT
  Run 'twrk help' for commands
```

### `help`
Show general help or detailed help for a specific command.

```bash
twrk help [command]

Examples:
  twrk help                    # General help
  twrk help task               # Task command help
  twrk help task add           # Specific subcommand help
```

---

## Project Initialization & Configuration

### `init`
Initialize Taskwerk in the current directory or specified location.

```bash
twrk init [options]

Options:
  --dir <path>        Directory for task data (default: .taskwerk)
  --force             Overwrite existing installation
  --migrate           Migrate existing task files

Examples:
  twrk init                              # Initialize in .taskwerk
  twrk init --dir ~/tasks                # Custom directory
  twrk init --force                      # Reinitialize
  twrk init --migrate                    # Import existing tasks
```

Creates:
- `<dir>/taskwerk.db` - SQLite database
- `<dir>/.twconfig` - Configuration file
- `<dir>/taskwerk-rules.md` - Workflow rules

### `status`
Show quick project/session summary.

```bash
twrk status [options]

Options:
  --detailed          Show more information
  --json              Output as JSON

Example output:
  Project: my-app
  Tasks: 42 total (5 active, 2 blocked, 35 completed)
  Current session: 2h 15m
  Active branch: feature/TASK-023-auth-refactor
```

### `config`
Show or modify CLI configuration.

```bash
twrk config [options]

Options:
  --set <key=value>   Set configuration value
  --get <key>         Get configuration value
  --list              List all settings
  --edit              Open config in editor

Examples:
  twrk config --list
  twrk config --get user.name
  twrk config --set user.name "John Doe"
  twrk config --set editor vim
```

---

## Task Management Commands

### `task add`
Add a new task with auto-generated ID.

```bash
twrk task add <title> [options]

Options:
  --description, -d   Task description
  --priority, -p      Priority: critical, high, medium (default), low
  --assignee, -a      Assign to user
  --parent            Parent task ID
  --depends-on        Dependencies (comma-separated IDs)
  --tags, -t          Tags (comma-separated)
  --estimate, -e      Time estimate (e.g., "4h", "2d")
  --due               Due date (YYYY-MM-DD or relative)
  --milestone         Milestone/sprint

Examples:
  twrk task add "Fix login bug"
  twrk task add "Add OAuth" -p high -a john -e 2d
  twrk task add "Write tests" --parent TASK-001
  twrk task add "Deploy" --depends-on TASK-001,TASK-002
```

### `task update`
Update fields on a task by ID.

```bash
twrk task update <id> [options]

Options:
  All options from 'task add' plus:
  --status, -s        Update status (see status transitions)
  --progress          Set progress percentage (0-100)
  --actual            Record actual time spent
  --add-tag           Add tags (can use multiple times)
  --remove-tag        Remove tags
  --add-depends       Add dependencies
  --remove-depends    Remove dependencies

Examples:
  twrk task update TASK-001 -s active
  twrk task update TASK-001 --progress 75 --actual 3h
  twrk task update TASK-001 --add-tag urgent --remove-tag backlog
```

### `task show`
Show detailed information about a task.

```bash
twrk task show <id> [options]

Options:
  --fields <list>     Show only specified fields
  --format, -f        Output format: text (default), json, markdown
  --notes             Include all notes
  --history           Include change history

Examples:
  twrk task show TASK-001
  twrk task show TASK-001 --fields title,status,priority
  twrk task show TASK-001 -f json
  twrk task show TASK-001 --notes --history
```

### `task list`
List tasks with flexible filtering and output options.

```bash
twrk task list [options]

Options:
  # Filtering
  --status, -s        Filter by status (can specify multiple)
  --assignee, -a      Filter by assignee ("me" for current user)
  --tag, -t           Filter by tags
  --priority, -p      Filter by priority
  --parent            Filter by parent task
  --milestone         Filter by milestone
  --blocked           Show only blocked tasks
  --ready             Show only ready tasks (no blockers)
  
  # Date filters
  --created-after     Created after date
  --created-before    Created before date
  --due-before        Due before date
  --due-after         Due after date
  
  # Output control
  --format, -f        Output format: table (default), json, csv, ids
  --fields            Custom field list
  --compact           Minimal output (ID and title only)
  --verbose           Detailed output
  --oneliner          One line per task
  --limit, -l         Maximum results (default: 50)
  --offset            Skip first N results
  
  # Sorting
  --sort              Sort by: created (default), updated, priority, due
  --reverse           Reverse sort order

Examples:
  twrk task list
  twrk task list -s todo,active -a me
  twrk task list --tag bug --priority high,critical
  twrk task list --ready --sort priority
  twrk task list --format ids | xargs -I {} twrk task show {}
  twrk task list --oneliner --fields id,title,assignee
```

### `task search`
Search for tasks matching text, keywords, tags, or field values.

```bash
twrk task search <query> [options]

Options:
  All filtering options from 'task list' plus:
  --fields <list>     Search only in specified fields
  --regex             Use regular expression
  --case-sensitive    Case-sensitive search

Examples:
  twrk task search "login bug"
  twrk task search "oauth" --status todo --priority high
  twrk task search "TODO|FIXME" --regex
  twrk task search "security" --fields title,description,notes
```

### `task delete`
Permanently remove a task from the database.

```bash
twrk task delete <id> [options]

Options:
  --force             Skip confirmation prompt

Examples:
  twrk task delete TASK-001
  twrk task delete TASK-001 --force

Note: Consider using 'task archive' for soft deletion
```

### `task archive`
Archive (soft-delete) a task, removing it from active lists.

```bash
twrk task archive <id> [options]

Options:
  --reason            Archive reason/note

Examples:
  twrk task archive TASK-001
  twrk task archive TASK-001 --reason "Obsolete after refactor"
```

### `task status`
Change task status (shorthand for update --status).

```bash
twrk task status <id> <new-status>

Valid statuses:
  todo        → active, cancelled
  active      → blocked, paused, completed, cancelled
  blocked     → active, cancelled
  paused      → active, cancelled
  completed   → (terminal state)
  cancelled   → (terminal state)
  archived    → (terminal state)

Examples:
  twrk task status TASK-001 active
  twrk task status TASK-001 completed
```

---

## Notes, Dependencies, and Relationships

### `task note`
Add a note to a task.

```bash
twrk task note <id> [options]

Options:
  --text, -t          Note text (required)
  --author            Note author (default: current user)
  --type              Note type: comment (default), status, technical

Examples:
  twrk task note TASK-001 -t "Found issue in auth.js line 42"
  twrk task note TASK-001 -t "Blocked on API keys" --type status
  cat findings.md | twrk task note TASK-001 -t -
```

### `task depends`
Manage task dependencies.

```bash
twrk task depends <id> <subcommand>

Subcommands:
  add <dep-id>        Add a dependency
  remove <dep-id>     Remove a dependency
  list                List all dependencies
  
Examples:
  twrk task depends TASK-003 add TASK-001
  twrk task depends TASK-003 add TASK-002
  twrk task depends TASK-003 list
  twrk task depends TASK-003 remove TASK-001
```

### `task subtasks`
Manage subtasks (parent-child relationships).

```bash
twrk task subtasks <id> [subcommand]

Subcommands:
  add <title>         Create a new subtask
  list                List all subtasks
  
Examples:
  twrk task subtasks TASK-001 add "Write unit tests"
  twrk task subtasks TASK-001 add "Write integration tests"
  twrk task subtasks TASK-001 list
```

### `task block`
Mark a task as blocked.

```bash
twrk task block <id> [options]

Options:
  --reason            Blocking reason (required)

Examples:
  twrk task block TASK-001 --reason "Waiting for design approval"
  twrk task block TASK-002 --reason "API keys not available"
```

### `task unblock`
Remove blocked status from a task.

```bash
twrk task unblock <id> [options]

Options:
  --note              Resolution note

Examples:
  twrk task unblock TASK-001
  twrk task unblock TASK-001 --note "Design approved by Jane"
```

### `task split`
Split a task into subtasks (advanced operation).

```bash
twrk task split <id> [options]

Options:
  --subtask           Subtask definition (can use multiple times)
  --archive-parent    Archive parent after split

Examples:
  twrk task split TASK-001 \
    --subtask "Backend: Implement API endpoints" \
    --subtask "Frontend: Create UI components" \
    --subtask "Tests: Write test suite" \
    --archive-parent
```

---

## Visualization and Analytics

### `task tree`
Show task dependency tree.

```bash
twrk task tree [id] [options]

Options:
  --depth             Maximum tree depth
  --format            Output format: text (default), dot

Examples:
  twrk task tree                      # Full project tree
  twrk task tree TASK-001             # Tree rooted at TASK-001
  twrk task tree --depth 2
  twrk task tree --format dot | dot -Tpng -o deps.png
```

### `task log`
Show task or project event log/history.

```bash
twrk task log [id] [options]

Options:
  --limit             Number of entries (default: 20)
  --since             Show entries since date
  --type              Filter by event type

Examples:
  twrk task log                       # Project-wide log
  twrk task log TASK-001              # Task-specific log
  twrk task log --since "1 week ago"
  twrk task log --type status_change
```

### `task stats`
Show project statistics and analytics.

```bash
twrk task stats [options]

Options:
  --burndown          Show burndown chart
  --velocity          Show velocity metrics
  --by-assignee       Group by assignee
  --by-priority       Group by priority
  --by-tag            Group by tag
  --period            Time period (week, month, sprint)

Examples:
  twrk task stats
  twrk task stats --burndown --period sprint
  twrk task stats --by-assignee
  twrk task stats --velocity --period month
```

---

## Import/Export/Backup

### `import`
Import tasks from file.

```bash
twrk import <file> [options]

Options:
  --format            File format: auto (default), markdown, json, csv
  --dry-run           Preview import without making changes
  --merge             Merge with existing tasks (default: append)

Examples:
  twrk import tasks.md
  twrk import old-tasks.json --dry-run
  twrk import project-export.json --merge
```

### `export`
Export tasks to file.

```bash
twrk export <file> [options]

Options:
  --format            Format: markdown (default), json, csv, yaml
  --filter            Filter expression (same as list command)
  --include-archived  Include archived tasks
  --include-history   Include task history

Examples:
  twrk export tasks.md
  twrk export active-tasks.json --filter "status:active"
  twrk export all-tasks.json --include-archived --include-history
  twrk export report.csv --format csv --filter "assignee:me"
```

### `lint`
Validate task file before import.

```bash
twrk lint <file> [options]

Options:
  --format            Expected format: auto (default), markdown, json

Examples:
  twrk lint tasks.md
  twrk lint import-data.json --format json
```

---

## Workflow Rules Management

### `rules`
Manage workflow rules in taskwerk-rules.md.

```bash
twrk rules <subcommand> [options]

Subcommands:
  show                Display all rules
  add                 Add a new rule
  edit <id>           Edit existing rule
  remove <id>         Remove a rule
  validate            Check rules syntax and consistency
  test <id>           Test a rule against current data

Options:
  --rule              Rule definition (for add command)
  --dry-run           Preview changes without saving

Examples:
  twrk rules show
  twrk rules add --rule "No task can close without passing tests"
  twrk rules add --rule "Critical bugs must be assigned within 1 hour"
  twrk rules edit 3
  twrk rules remove 2
  twrk rules validate
  twrk rules test 1 --dry-run
```

---

## AI/Agent Integration (v0.6 - Read/Suggest Only)

### `ask`
Query AI for advice, summaries, or insights (read-only).

```bash
twrk ask <question> [options]

Options:
  --context           Include context: all, recent, task:<id>
  --model             AI model to use (default: configured model)
  --format            Response format: text (default), json

Examples:
  twrk ask "What tasks are blocked and why?"
  twrk ask "Summarize progress this week"
  twrk ask "What should I work on next?" --context recent
  twrk ask "Explain TASK-001" --context task:TASK-001
```

### `suggest`
Get AI suggestions for task management (read-only).

```bash
twrk suggest <type> [options]

Types:
  next                Suggest next task to work on
  split <id>          Suggest how to split a task
  dependencies <id>   Suggest task dependencies
  estimate <id>       Suggest time estimate
  solution <id>       Suggest approaches to complete task

Examples:
  twrk suggest next
  twrk suggest split TASK-001
  twrk suggest dependencies TASK-005
  twrk suggest estimate TASK-003
  twrk suggest solution TASK-002
```

### `aiconfig`
Configure AI/LLM settings.

```bash
twrk aiconfig [options]

Options:
  --set <key=value>   Set AI configuration
  --get <key>         Get AI configuration
  --list              List all AI settings
  --test              Test AI connection

Examples:
  twrk aiconfig --list
  twrk aiconfig --set provider openai
  twrk aiconfig --set openai.api_key "sk-..."
  twrk aiconfig --test
```

---

## Git Integration

### `git branch`
Create a git branch for a task.

```bash
twrk git branch <task-id> [options]

Options:
  --checkout, -c      Switch to the new branch
  --prefix            Branch prefix (default: "feature/")
  --from              Base branch (default: current)

Examples:
  twrk git branch TASK-001
  twrk git branch TASK-001 -c
  twrk git branch TASK-002 --prefix bugfix/ --from main -c
```

### `git commit`
Create a git commit linked to a task.

```bash
twrk git commit <task-id> [options]

Options:
  --message, -m       Additional commit message
  --all, -a           Stage all changes
  --push              Push after commit
  --close             Mark task as completed

Examples:
  twrk git commit TASK-001
  twrk git commit TASK-001 -m "Additional context" --push
  twrk git commit TASK-001 -a --close
```

---

## Database Maintenance

### `db`
Database administration and maintenance.

```bash
twrk db <subcommand> [options]

Subcommands:
  diagnose            Check database health
  migrate             Run database migrations
  vacuum              Optimize database
  backup <file>       Create database backup
  restore <file>      Restore from backup

Examples:
  twrk db diagnose
  twrk db vacuum
  twrk db backup taskwerk-backup-20240201.db
  twrk db restore taskwerk-backup-20240201.db
```

---

## Global Options

These options work with most commands:

```bash
--quiet, -q         Minimal output
--verbose, -v       Detailed output
--json              JSON output (where applicable)
--no-color          Disable colored output
--config <file>     Use alternate config file
--cwd <dir>         Run as if in specified directory
```

---

## Environment Variables

```bash
TASKWERK_HOME       Override default .taskwerk directory
TASKWERK_CONFIG     Override default config file location
TASKWERK_USER       Override current user name
TASKWERK_NO_COLOR   Disable colored output
TASKWERK_DEBUG      Enable debug logging
```

---

## Exit Codes

- `0` - Success
- `1` - General error
- `2` - Command syntax error
- `3` - Task not found
- `4` - Permission denied
- `5` - Database error
- `6` - Git operation failed
- `7` - AI service error

---

## Examples of Common Workflows

### Starting a new feature
```bash
twrk task add "Implement user authentication" -p high -e 3d
# Returns: Created TASK-001

twrk git branch TASK-001 -c
# Switches to feature/TASK-001

twrk task status TASK-001 active
```

### Daily standup
```bash
twrk task list -a me -s active,blocked
twrk task stats --by-assignee --period day
```

### Completing a task
```bash
twrk task update TASK-001 --progress 100
twrk git commit TASK-001 -m "Tests passing" --push
twrk task status TASK-001 completed
```

### Finding what to work on
```bash
twrk task list --ready --sort priority
twrk suggest next
```

---

## Version History

- **v0.6.0** - Initial release with core task management
- Future versions will add:
  - Advanced AI integration (write operations)
  - Team collaboration features
  - Remote sync capabilities
  - Plugin system

---

This document represents the complete CLI specification for Taskwerk v0.6.x. Any commands not listed here are not supported and should not be implemented.