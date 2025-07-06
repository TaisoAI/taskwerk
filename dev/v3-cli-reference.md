# Taskwerk CLI Reference

**Version**: 0.3.x  
**Shell Alias**: `twrk` (short form)

## Command Structure

Taskwerk uses subcommands for organization:

```
taskwerk <category> <action> [options]
twrk <category> <action> [options]        # Short form
```

## Task Commands

### `task add` - Create a new task

```bash
twrk task add <name> [options]

Options:
  --description, -d   Detailed description
  --priority, -p      Priority: high, medium (default), low  
  --assignee, -a      Assign to user
  --parent            Parent task ID
  --depends-on        Comma-separated dependency IDs
  --tags, -t          Comma-separated tags
  --estimate, -e      Time estimate (e.g., "4h", "2d")
  --due               Due date (ISO format or relative)

Examples:
  twrk task add "Fix login bug"
  twrk task add "Add OAuth" --priority high --assignee john
  twrk task add "Write tests" --parent TASK-001 --estimate 4h
  twrk task add "Deploy" --depends-on TASK-001,TASK-002
  twrk task add "Security audit" --due "2024-01-20"
  twrk task add "Refactor auth" --tags "backend,security"
```

### `task list` - List tasks

```bash
twrk task list [options]

Options:
  --status, -s        Filter by status (can be multiple)
  --assignee, -a      Filter by assignee  
  --priority, -p      Filter by priority
  --parent            Filter by parent task
  --tags, -t          Filter by tags
  --since             Created since date
  --before            Created before date
  --ready             Tasks with no blockers
  --format, -f        Output format: table (default), json, id, markdown
  --limit, -l         Maximum results (default: 100)
  --sort              Sort by: created, updated, priority, due

Examples:
  twrk task list
  twrk task list --status active
  twrk task list --status active,blocked --assignee me
  twrk task list --priority high --ready
  twrk task list --parent TASK-001
  twrk task list --since "1 week ago"
  twrk task list --format id | xargs -I {} twrk task show {}
  twrk task list --sort priority --limit 10
```

### `task show` - Display task details

```bash
twrk task show <task-id> [options]

Options:
  --deps              Show dependency tree
  --history           Show change history
  --notes             Show only notes
  --format, -f        Output format: text (default), json, markdown

Examples:
  twrk task show TASK-001
  twrk task show TASK-001 --deps
  twrk task show TASK-001 --history
  twrk task show TASK-001 --format json
  twrk task show TASK-001 --notes
```

### `task update` - Modify a task

```bash
twrk task update <task-id> [options]

Options:
  --status, -s        Change status
  --priority, -p      Change priority
  --assignee, -a      Change assignee
  --note, -n          Add a note (appends)
  --description, -d   Update description (replaces)
  --estimate, -e      Update time estimate
  --actual            Set actual time spent
  --progress          Set progress (0-100)
  --due               Update due date
  --add-tag           Add tags
  --remove-tag        Remove tags
  --blocked-reason    Reason for blocking (with --status blocked)

Examples:
  twrk task update TASK-001 --status active
  twrk task update TASK-001 --status blocked --blocked-reason "Waiting for API access"
  twrk task update TASK-001 --note "Found the bug in auth.js:42"
  twrk task update TASK-001 --assignee alice --priority high
  twrk task update TASK-001 --progress 75 --actual 3h
  twrk task update TASK-001 --add-tag "urgent" --remove-tag "backlog"
  twrk task update TASK-001 --status completed --note "Fixed and tested"
```

### `task delete` - Delete a task

```bash
twrk task delete <task-id> [options]

Options:
  --force, -f         Skip confirmation prompt

Examples:
  twrk task delete TASK-001
  twrk task delete TASK-001 --force

Note: Prefer using 'task update --status archived' for soft deletion
```

## Data Commands

### `data export` - Export tasks

```bash
twrk data export [options]

Options:
  --format, -f        Format: markdown (default), json
  --output, -o        Output file (default: stdout)
  --status, -s        Filter by status
  --assignee, -a      Filter by assignee
  --tags, -t          Filter by tags
  --since             Tasks modified since
  --include-archived  Include archived tasks

Examples:
  twrk data export --output tasks.md
  twrk data export --format json --output backup.json
  twrk data export --status completed --since "1 month ago"
  twrk data export --assignee john --format markdown > john-tasks.md
  twrk data export --include-archived --output full-backup.json
```

### `data import` - Import tasks

```bash
twrk data import <file> [options]

Options:
  --format, -f        Format: markdown (default), json
  --merge             Update existing tasks
  --prefix            Add prefix to imported task IDs
  --dry-run           Preview without importing
  --map-assignees     Map assignee names (old:new,old2:new2)

Examples:
  twrk data import tasks.md
  twrk data import backup.json --format json
  twrk data import old-tasks.md --prefix "OLD"
  twrk data import updates.md --merge
  twrk data import team-tasks.json --map-assignees "bob:robert,jane:janet"
  twrk data import tasks.md --dry-run
```

## Git Commands

### `git branch` - Create branch for task

```bash
twrk git branch <task-id> [options]

Options:
  --checkout, -c      Switch to new branch
  --prefix            Branch prefix (default: feature/)
  --base              Base branch (default: current)

Examples:
  twrk git branch TASK-001
  twrk git branch TASK-001 --checkout
  twrk git branch TASK-001 --prefix bugfix/
  twrk git branch TASK-001 --base main --checkout
```

### `git commit` - Commit with task context

```bash
twrk git commit <task-id> [options]

Options:
  --message, -m       Override generated message
  --push              Push after commit
  --close             Mark task completed after commit

Examples:
  twrk git commit TASK-001
  twrk git commit TASK-001 --message "Custom message"
  twrk git commit TASK-001 --push
  twrk git commit TASK-001 --close --push
```

### `git sync` - Sync task branches

```bash
twrk git sync [options]

Options:
  --prune             Remove merged task branches
  --update            Update task statuses from git

Examples:
  twrk git sync
  twrk git sync --prune
  twrk git sync --update
```

## AI Commands

### `ai ask` - Query tasks (read-only)

```bash
twrk ai ask <question>

Examples:
  twrk ai ask "what tasks are blocked?"
  twrk ai ask "show me high priority tasks for john"
  twrk ai ask "what did I complete this week?"
  twrk ai ask "which tasks depend on TASK-001?"
  twrk ai ask "summarize sprint progress"
```

### `ai agent` - AI task management

```bash
twrk ai agent <instruction>

Examples:
  twrk ai agent "create subtasks for TASK-001"
  twrk ai agent "complete TASK-002 with summary"
  twrk ai agent "break down 'Add payment system' into tasks"
  twrk ai agent "update all my active tasks with progress notes"
  twrk ai agent "organize backlog by priority"
```

### `ai raw` - Pipeline mode

```bash
twrk ai raw [instruction] < input > output

Examples:
  twrk ai raw "format as markdown" < tasks.json > tasks.md
  twrk ai raw "extract action items" < meeting-notes.txt
  echo "user story" | twrk ai raw "convert to tasks"
  cat requirements.md | twrk ai raw "identify tasks" > new-tasks.md
```

### `ai config` - Manage AI settings

```bash
twrk ai config <action> [options]

Actions:
  add <provider>      Add AI provider
  remove <provider>   Remove AI provider
  set-default <name>  Set default provider
  list                List configured providers

Examples:
  twrk ai config add openai --api-key sk-...
  twrk ai config add anthropic --api-key sk-...
  twrk ai config set-default claude
  twrk ai config list
  twrk ai config remove openai
```

## Natural Language Interface

```bash
twrk "<natural language query or command>"

The system auto-detects intent:
- Questions → ask mode
- Actions → agent mode  
- Prefixed with "format:", "parse:" → raw mode

Examples:
  twrk "what am I working on?"              # ask mode
  twrk "show me blocked tasks"              # ask mode
  twrk "create task for fixing login"       # agent mode
  twrk "complete TASK-001"                  # agent mode
  twrk "format: convert to CSV" < data.txt  # raw mode
```

## System Commands

### `init` - Initialize Taskwerk

```bash
twrk init [options]

Options:
  --rules             Create taskwerk_rules.md template
  --import            Import from existing task file
  --force             Overwrite existing setup

Examples:
  twrk init
  twrk init --rules
  twrk init --import old-tasks.md
  twrk init --force
```

### `status` - Workspace overview

```bash
twrk status [options]

Options:
  --verbose, -v       Show detailed statistics
  --format, -f        Output format: text (default), json

Examples:
  twrk status
  twrk status --verbose
  twrk status --format json
```

### `config` - Manage configuration

```bash
twrk config [key] [value]

Examples:
  twrk config                           # Show all settings
  twrk config user.name                 # Get setting
  twrk config user.name "John Doe"      # Set setting
  twrk config core.editor "vim"
  twrk config log.level "debug"
```

## Log Commands

### `logs list` - View log entries

```bash
twrk logs list [options]

Options:
  --level, -l         Filter by level: error, warn, info, debug
  --category, -c      Filter by category (supports wildcards)
  --since, -s         Logs since date/time
  --user, -u          Filter by user
  --limit             Maximum entries (default: 100)

Examples:
  twrk logs list --level error
  twrk logs list --since "1 hour ago"
  twrk logs list --category "task.*" --user john
  twrk logs list --level error,warn --limit 50
```

### `logs show` - Real-time log viewing

```bash
twrk logs show [options]

Options:
  --tail, -t          Number of lines to show initially
  --follow, -f        Follow log in real-time
  --category, -c      Filter by category
  --format            Custom format string

Examples:
  twrk logs show --tail 50
  twrk logs show --follow
  twrk logs show --category "ai.*" --follow
  twrk logs show --format "{timestamp} [{level}] {message}"
```

### `logs stats` - Log analytics

```bash
twrk logs stats [options]

Options:
  --group-by          Group by: category, user, level, hour
  --since             Stats since date
  --category          Filter by category

Examples:
  twrk logs stats
  twrk logs stats --group-by category
  twrk logs stats --group-by user --since "1 week ago"
  twrk logs stats --category "ai.*"
```

## Global Options

Available for all commands:

```bash
--help, -h          Show help
--version           Show version
--quiet, -q         Suppress output
--verbose           Extra output
--no-color          Disable colored output
--config            Use alternate config file
--dir               Use alternate taskwerk directory

Examples:
  twrk --version
  twrk task list --quiet
  twrk task add "Test" --verbose
  twrk --dir /path/to/project task list
```

## Environment Variables

```bash
TASKWERK_DIR        Override .taskwerk directory location
TASKWERK_CONFIG     Override config file location
TASKWERK_LOG_LEVEL  Set log level
TASKWERK_NO_COLOR   Disable colors
TASKWERK_AI_MODEL   Override default AI model

Examples:
  TASKWERK_DIR=~/.taskwerk-global twrk init
  TASKWERK_LOG_LEVEL=debug twrk task list
  TASKWERK_AI_MODEL=gpt-4 twrk ai ask "summarize tasks"
```

## Exit Codes

- `0` - Success
- `1` - General error
- `2` - Command syntax error
- `3` - Task not found
- `4` - Permission denied
- `5` - Network error (AI commands)

## Tips and Tricks

### Batch Operations
```bash
# Archive all completed tasks older than 30 days
twrk task list --status completed --before "30 days ago" --format id | \
  xargs -I {} twrk task update {} --status archived

# Assign all unassigned high-priority tasks to yourself
twrk task list --priority high --assignee "" --format id | \
  xargs -I {} twrk task update {} --assignee me
```

### Git Integration
```bash
# Create branches for all active tasks
twrk task list --status active --format id | \
  xargs -I {} twrk git branch {} --prefix feature/

# See what tasks touched a file
git log --grep="TASK-" -- path/to/file
```

### AI Workflows
```bash
# Daily standup
twrk ai ask "what did I complete yesterday and what am I working on today?"

# Sprint planning  
twrk ai agent "analyze backlog and suggest tasks for next sprint"

# Code review prep
twrk ai ask "what files were changed for TASK-001?"
```

### Aliases
```bash
# Add to ~/.bashrc or ~/.zshrc
alias ta='twrk task add'
alias tl='twrk task list'
alias ts='twrk task show'
alias tu='twrk task update'
alias twa='twrk task list --status active'
alias twb='twrk task list --status blocked'
```

## Common Workflows

### Starting Work
```bash
twrk task add "New feature"               # Create task
twrk task update TASK-001 --status active # Start work
twrk git branch TASK-001 --checkout       # Create branch
```

### Tracking Progress
```bash
twrk task update TASK-001 --note "Found approach"
twrk task update TASK-001 --progress 50
twrk task update TASK-001 --actual 2h
```

### Completing Work
```bash
twrk task update TASK-001 --status completed
twrk git commit TASK-001
git push
```

### Getting Help
```bash
twrk --help                    # General help
twrk task --help               # Task command help
twrk task add --help           # Specific command help
twrk examples                  # Show examples
```