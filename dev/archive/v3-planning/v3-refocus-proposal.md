# Taskwerk v3 Refocus Proposal

## Executive Summary

Taskwerk v3 has suffered from scope creep. This proposal refocuses on the core value: a simple, reliable task CLI that helps humans and AI agents track work, with optional AI assistance to streamline workflows.

## Core Principles

1. **Task tracking is the product** - Everything else supports this
2. **AI assists, doesn't complicate** - AI should make things easier, not add complexity
3. **Rules guide, don't enforce** - SOPs and checklists, not rigid automation
4. **Clarity over features** - Do fewer things extremely well

## Scope Definition

### What Taskwerk IS

1. **A task tracking CLI** that maintains a clear record of work items
2. **A collaboration tool** for humans and AI agents to share task context
3. **A workflow guide** that suggests best practices without enforcing them
4. **A git-aware tool** that understands the development context

### What Taskwerk IS NOT

1. **Not a project management suite** - No Gantt charts, resource allocation, etc.
2. **Not a CI/CD system** - We don't enforce build processes
3. **Not an AI orchestration platform** - AI assists, but doesn't drive
4. **Not a code quality enforcer** - We suggest, not mandate

## Terminology Standardization

### Task States (Immutable List)

```
todo       → Task exists but work hasn't started
active     → Currently being worked on (replaces in_progress)
paused     → Temporarily stopped but will resume
blocked    → Cannot proceed due to external dependency
completed  → Work is finished successfully
archived   → Removed from active view (completed or cancelled)
```

### Command Structure

All commands follow a consistent subcommand pattern:

```
# Task operations (core functionality)
taskwerk task add "Fix login bug"
taskwerk task list [--status active] [--assignee ai]
taskwerk task show TASK-001 [--deps]
taskwerk task update TASK-001 --status active
taskwerk task update TASK-001 --note "Found the issue"
taskwerk task delete TASK-001 [--force]

# Data operations
taskwerk data export [--format markdown] [--output tasks.md]
taskwerk data export --format json --status completed --since "1 week"
taskwerk data import tasks.md [--format markdown]
taskwerk data import backup.json --merge

# Git operations  
taskwerk git branch TASK-001
taskwerk git commit TASK-001 [--message "..."]
taskwerk git sync

# AI assistant
taskwerk ai ask "what tasks are blocked?"        # Read-only queries
taskwerk ai agent "create tasks for auth system"  # Can modify tasks
taskwerk ai raw < input.txt > output.txt          # Pipeline mode

# Natural language shortcut (auto-detects mode)
taskwerk "what tasks are blocked?"                # Detects as 'ask'
taskwerk "complete TASK-001 and commit"           # Detects as 'agent'

# System operations
taskwerk init                                     # setups taskwerk dir structure, but only if it doesn't exist
taskwerk init --rules                             # Create default taskwerk_rules.md
taskwerk status
taskwerk config [--key value]

# Log operations
taskwerk logs list [--level error] [--since "1 hour"]
taskwerk logs show [--category "ai.*"] [--tail 50]
taskwerk logs stats [--group-by category]
taskwerk logs export --format json --output logs.json
```

### State Changes to Tasks are made via Update

State transitions are all done through `task update`:

```
taskwerk task update TASK-001 --status active     # Start work
taskwerk task update TASK-001 --status paused     # Pause
taskwerk task update TASK-001 --status blocked --reason "Waiting for API"
taskwerk task update TASK-001 --status completed  # Complete
taskwerk task update TASK-001 --status archived   # Archive
```

### Shell Alias
The npm package installs `twrk` as a short alias:

```bash
twrk task add "Fix login bug"
twrk task list
twrk task update TASK-001 --status active

# Natural language shortcuts
twrk "what's my highest priority task?"
twrk "create task for fixing login bug"
```

## Architecture Simplification

### Three Layers Only

```
1. CLI Layer (src/cli/)
   - Parse commands
   - Format output
   - Handle user interaction

2. Core Layer (src/core/)
   - Task CRUD operations
   - State management
   - Query engine
   - Git integration

3. Storage Layer (SQLite)
   - Single source of truth
   - Simple schema
   - Easy to backup/query externally
```

### Optional AI Layer

```
AI Assistant (src/ai/)
- Completely separate module with no core dependencies
- Has its own configuration (ai-config.json)
- Three modes:
  - ask: Read-only queries (safe mode)
  - agent: Full task management (action mode)
  - raw: Text pipeline utility (scripting mode)
- Natural language shortcut: twrk "prompt" auto-detects mode
- AI config managed separately: twrk ai config
```

## Feature Scope

### v3.0 Core (Must Have)

1. **Basic Task Management**
   - Create, read, update, delete tasks
   - State transitions
   - Task IDs (TASK-001 format)

2. **Task Relationships**
   - Parent/subtask (via parent_id)
   - Dependencies (depends_on)
   - Tags for grouping

3. **Git Awareness**
   - Associate tasks with branches
   - Include task context in commits
   - Track task-to-commit relationships

4. **Import/Export**
   - Markdown import/export
   - JSON for integrations
   - Maintain human readability

### v3.1 Enhancements (Nice to Have)

1. **AI Assistant with Three Modes**
   ```bash
   # Explicit mode selection
   twrk ai ask "what tasks are blocked?"           # Safe, read-only
   twrk ai agent "complete TASK-001 and commit"    # Can modify tasks
   twrk ai raw "format this as JSON" < data.txt    # Pipeline utility
   
   # Natural language shortcuts
   twrk "what's blocked?"                          # Auto-detects as 'ask'
   twrk "create auth tasks"                        # Auto-detects as 'agent'
   
   # AI configuration (separate from core config)
   twrk ai config add openai --api-key sk-...
   twrk ai config set-default claude
   ```

2. **Workflow Guides** (taskwerk_rules.md)
   - Checklists, not enforcement
   - Customizable per project
   - AI agents can read and follow

3. **Better Queries**
   - Full text search
   - Complex filters
   - Custom views

### Explicitly OUT of Scope

1. **Workflow Automation** - No automatic state transitions
2. **Quality Gates** - No enforced testing/linting
3. **Project Planning** - No PRD parsing or task generation
4. **Time Tracking** - No built-in timers
5. **Team Features** - Single user for now

### AI Architecture Details

The AI module is completely separate:

```
.taskwerk/
├── taskwerk.db          # Core task data
├── config.json          # Core configuration
├── ai-config.json       # AI configuration (separate)
└── taskwerk_rules.md    # Project guidelines (optional)

src/ai/
├── index.js             # Entry point, mode detection
├── ask.js               # Read-only query handler
├── agent.js             # Action mode handler
├── raw.js               # Pipeline mode handler
├── config.js            # AI configuration manager
└── tools/               # Taskwerk command bindings
    ├── read-tools.js    # For ask mode (list, show, status)
    └── write-tools.js   # For agent mode (add, update, etc)
```

Mode auto-detection for natural language:
- Queries starting with "what", "show", "list", "how many" → `ask` mode
- Actions like "create", "complete", "update", "fix" → `agent` mode
- Prefixed with "translate:", "format:", "parse:" → `raw` mode
- Ambiguous prompts default to `agent` with confirmation required

## Rules as Guidelines

Instead of complex enforcement, `taskwerk_rules.md` becomes a simple checklist:

```markdown 
# Taskwerk Project Guidelines

## Before Starting a Task
- [ ] Is the task clearly defined with acceptance criteria?
- [ ] Are dependencies identified and available?
- [ ] Do you have everything needed (access, tools, context)?
- [ ] Create a feature branch from the task ID
- [ ] Document your implementation plan in the task

## During Development
- [ ] Keep the task updated with progress notes
- [ ] Block the task immediately if stuck (with reason)
- [ ] Ask for help early rather than spinning wheels
- [ ] Commit frequently with clear messages
- [ ] Include task ID in commit messages

## Before Completing a Task  
- [ ] All tests pass with no failures
- [ ] No linting errors or warnings
- [ ] If warnings exist, pragma them with explanation
- [ ] Code is documented (functions, complex logic)
- [ ] All new methods have docstrings (or langauge equivalent, describing the purpose, params & outputs, sideffects, dependancies)
- [ ] Manual testing completed
- [ ] Related documentation updated
- [ ] Build succeeds in all configurations

## Git Workflow
- [ ] Branch name matches task (feature/TASK-XXX) where appropriate
- [ ] Commits are atomic and well-described
- [ ] Commit messages follow conventional format
- [ ] No commented-out code without explanation
- [ ] No debug console.logs in production code  
- [ ] Sensitive data is never committed

## Code Quality Standards
- [ ] No TODO comments without task references
- [ ] Error cases are handled appropriately
- [ ] Code follows project style guide
- [ ] Complex logic has explanatory comments
- [ ] Public APIs have JSDoc/docstrings
- [ ] Performance implications considered

## For AI Agents
When taking on tasks:
1. Read the entire task and related context
2. Write out your implementation plan first
3. Follow existing code patterns and style
4. Test your changes thoroughly
5. Document what you changed and why
6. Update task with completion summary
```

## Why This Is a Full Rewrite

After our analysis, v3 is essentially a complete rewrite because:

1. **Command Structure**: Moving from 31 flat commands to organized subcommands
2. **State Management**: New state names (active vs in_progress)  
3. **Data Model**: Added notes field, YAML frontmatter, better schema
4. **AI Architecture**: Completely separate module with three distinct modes
5. **Safety First**: No ambiguous commands, destructive ops require confirmation

The good news:
- Cleaner, more maintainable codebase
- Better test coverage opportunity  
- Consistent patterns throughout
- Room for future growth

## Migration Path

### From v2 to v3
1. Export v2 tasks as markdown
2. Import into v3 database
3. IDs are preserved where possible

### From current v3 to refocused v3
1. Keep the database schema
2. Simplify the CLI commands
3. Move complex features to plugins/extensions
4. Archive unused code rather than delete

## Success Metrics

1. **Simplicity**: Can a new user be productive in 5 minutes?
2. **Reliability**: Does it work the same way every time?
3. **Integration**: Does it fit naturally into existing workflows?
4. **AI-Friendly**: Can AI agents use it without special configuration?

## Command Safety Analysis

### Dangerous Adjacencies to Avoid

Looking at our current command set for potential typo disasters:

1. **`delete` vs `update`** - These are sufficiently different
2. **`archive` vs `active`** - Dangerous! "archive" permanently hides, "active" is a status
3. **`list` vs anything** - Safe, read-only command
4. **`show` vs anything** - Safe, read-only command

### Proposed Safety Improvements

1. **Remove `delete` from common usage**
   - Use `archive` for normal workflow (soft delete)
   - Require `task remove --force` for actual deletion
   - Or even `task purge` to make it very intentional

2. **Status values vs commands**
   - Status: `todo`, `active`, `paused`, `blocked`, `completed`, `archived`
   - No commands that match status names to avoid confusion
   - Always use `--status` flag for clarity

3. **Destructive operations require confirmation**
   ```bash
   twrk task remove TASK-001 --force
   > ⚠️  This will permanently delete TASK-001. Continue? [y/N]
   ```

### Safe Command Structure

```bash
# Safe read operations (no confirmation needed)
twrk task list
twrk task show TASK-001
twrk status
twrk ai ask "..."

# State changes (reversible, no confirmation needed)
twrk task update TASK-001 --status active
twrk task update TASK-001 --status paused

# Semi-destructive (confirmation recommended)
twrk task update TASK-001 --status archived
twrk git commit TASK-001

# Destructive (always require confirmation)
twrk task remove TASK-001 --force
twrk ai agent "delete all completed tasks"  # Requires confirmation
```

## Example Workflows

### Workflow 1: Daily Development Flow
```bash
# Morning standup prep
twrk status                                      # Overview of workspace
twrk task list --status active                   # What I'm working on
twrk task list --status blocked                  # What's blocking me
twrk "what did I complete yesterday?"            # Natural language query

# Start new work
twrk task add "Fix login timeout bug"           # → TASK-042
twrk task show TASK-042                         # Review details
twrk task update TASK-042 --status active       # Start work
twrk git branch TASK-042                        # Create feature branch

# Discovery and clarification
twrk task update TASK-042 --note "Happens after 5min idle"
twrk task update TASK-042 --estimate 4h         # Update time estimate
twrk "where is the session timeout configured?"  # Ask AI for help

# Hit a blocker
twrk task update TASK-042 --status blocked \
  --reason "Need access to auth service logs"
twrk task add "Request auth service access" \
  --status active --priority high               # → TASK-043

# Complete blocker
twrk task update TASK-043 --status completed
twrk task update TASK-042 --status active       # Resume original work

# Finish work
twrk task update TASK-042 --status completed
twrk git commit TASK-042 --message "Fix 5min timeout issue"
```

### Workflow 2: Task Breakdown and Dependencies
```bash
# Create parent task
twrk task add "Implement user notifications"     # → TASK-044

# Break it down
twrk task add "Design notification schema" \
  --parent TASK-044                              # → TASK-045
twrk task add "Create notification API" \
  --parent TASK-044 --depends-on TASK-045       # → TASK-046
twrk task add "Add email provider" \
  --parent TASK-044 --depends-on TASK-046       # → TASK-047
twrk task add "Add UI components" \
  --parent TASK-044 --depends-on TASK-046       # → TASK-048

# View the structure
twrk task show TASK-044 --deps                  # See full tree
twrk task list --parent TASK-044                # Just subtasks
twrk task list --ready                          # What can I start?

# Work through them
twrk task update TASK-045 --status active
# ... do work ...
twrk task update TASK-045 --status completed    # Unblocks TASK-046

twrk task list --ready                          # Now shows TASK-046
```

### Workflow 3: Bug Triage and Fixing
```bash
# Urgent bug reported
twrk task add "URGENT: Payment failing for EU users" \
  --priority high --assignee me                  # → TASK-050

# Investigate
twrk task update TASK-050 --status active
twrk task update TASK-050 --note "Started investigation"
twrk ai ask "show recent changes to payment code"

# Create related investigation tasks
twrk task add "Check EU payment gateway logs" \
  --parent TASK-050 --status active             # → TASK-051
twrk task add "Test with EU test cards" \
  --parent TASK-050                              # → TASK-052

# Found the issue
twrk task update TASK-051 --status completed \
  --note "Found: VAT calculation error"
twrk task update TASK-050 --note "Root cause: VAT calc"

# Fix it
twrk git branch TASK-050 --checkout
# ... fix code ...
twrk task update TASK-052 --status active       # Test the fix
twrk task update TASK-052 --status completed
twrk task update TASK-050 --status completed

# Emergency deploy
twrk git commit TASK-050 --message "Fix EU VAT calculation"
git push origin hotfix/TASK-050
```

### Workflow 4: Weekly Planning
```bash
# Review last week
twrk task list --status completed --since "1 week ago"
twrk status                                      # Overall stats

# Plan next week
twrk task add "Sprint 23 Planning" --status active  # → TASK-060

# Add sprint tasks
twrk task add "Refactor auth module" \
  --priority medium --estimate 8h               # → TASK-061
twrk task add "Add password reset flow" \
  --priority high --estimate 12h \
  --depends-on TASK-061                         # → TASK-062
twrk task add "Update documentation" \
  --priority low --estimate 4h                  # → TASK-063

# View sprint workload
twrk task list --created-after today \
  --status todo --sort priority
twrk "what's my total estimate for these tasks?"

# Assign and organize
twrk task update TASK-061 --assignee john
twrk task update TASK-062 --assignee me
twrk task update TASK-063 --assignee intern

# Archive old completed tasks
twrk task list --status completed \
  --before "1 month ago" --format id | \
  xargs -I {} twrk task update {} --status archived
```

### Workflow 5: AI-Assisted Development
```bash
# Natural language task creation
twrk "create tasks for adding OAuth login"
# AI creates: TASK-070 (parent), TASK-071-074 (subtasks)

# Get AI help with current task
twrk task update TASK-071 --status active
twrk ai ask "how do I implement OAuth with our stack?"
twrk ai ask "show examples of OAuth in our codebase"

# AI helps with implementation
twrk ai agent "implement the OAuth callback handler for TASK-071"
# AI writes code, following project patterns

# Review what AI did
twrk "what files did you modify for TASK-071?"
twrk task show TASK-071 --history              # See all updates

# Complete with AI assistance
twrk ai agent "write tests for TASK-071"
twrk ai agent "update docs and complete TASK-071"
```

### AI Agent Flow
```bash
# Human assigns work
twrk task add "Implement user profile API" --assignee ai

# Using explicit mode
twrk ai agent "work on TASK-043"

# Or using natural language shortcut
twrk "implement TASK-043"

# AI agent:
# 1. Reads task and taskwerk_rules.md
# 2. Creates implementation plan
# 3. Writes code following guidelines  
# 4. Tests the implementation
# 5. Completes task with summary

# Human can also use ask mode for queries
twrk ai ask "what's the status of TASK-043?"
twrk "show me the implementation plan"  # Auto-detects as 'ask'
```

## Workflow Analysis

### What These Workflows Revealed

1. **Command Structure Works Well**
   - `task add/update/show/list` covers all needs
   - Natural language shortcuts reduce typing
   - No command ambiguity in practice

2. **Missing Features Identified**
   - `--since` and `--before` filters for time-based queries
   - `--format id` for piping to other commands
   - `--checkout` flag for git branch creation
   - `--history` flag for task show

3. **Safety Observations**
   - No dangerous commands were needed in normal flow
   - `archive` only used for bulk cleanup (good!)
   - All destructive ops are explicit and pipeable

4. **Natural Language is Key**
   - Reduces cognitive load for complex queries
   - Makes AI assistance feel natural
   - Provides discovery mechanism

### Proposed Command Adjustments

Based on the workflows, we should:

1. **Add time filters to list**
   ```bash
   twrk task list --since "1 week ago"
   twrk task list --before "2024-01-01"
   twrk task list --created-after today
   ```

2. **Add output format control**
   ```bash
   twrk task list --format id          # Just IDs for piping
   twrk task list --format json        # For scripting
   twrk task list --format table       # Default
   ```

3. **Make `remove` even safer**
   ```bash
   # Instead of delete/remove, use "purge" for clarity
   twrk task purge TASK-001 --force
   # This is unmistakably destructive
   ```

### Collaborative Flow
```bash
# Human creates high-level task
twrk task add "Add user authentication"                    # TASK-044

# Human breaks it down
twrk task add "Design auth schema" --parent TASK-044       # TASK-045
twrk task add "Implement login endpoint" --parent TASK-044  # TASK-046
twrk task add "Add session management" --parent TASK-044    # TASK-047

# Mixed execution
twrk task update TASK-045 --status active     # Human designs schema
twrk task update TASK-045 --status completed

twrk ai agent "implement TASK-046"            # AI implements login
# Or: twrk "implement the login endpoint"     # Natural language

twrk task update TASK-047 --status active     # Human does session management
```

## Next Steps

1. **Agree on terminology** - Lock down states and verbs
2. **Simplify CLI** - Reduce to ~15 core commands  
3. **Document workflows** - 5-6 common patterns
4. **Test coverage** - Focus on core commands first
5. **AI integration** - Simple tool-calling interface

## Questions to Resolve

1. Should `twrk ai` be a separate npm package or built-in module?
2. How much git integration is "just enough"?
3. Should rules.md be version controlled or local?
4. What's the minimum viable AI integration?
5. Should natural language shortcuts force mode or auto-detect?

---

The goal: Make Taskwerk so simple and reliable that it becomes invisible - users focus on their work, not on the tool.