# Taskwerk Architecture v2.0 - Comprehensive Task Management


Taskwerk is a markdown-based command-line task management tool designed for developers who want to track work in plain text files alongside their code. It emphasizes simplicity, human readability, and integration with development workflows.  It allows a person to use a cli to add / update tasks, but keeps the core tasks themselves in markdown files so that a user could edit them manually if desired.  Taskwerk is meant to work with AI coding bots but to cut down on context requirements allws them to use a cli api (and later mcp api) to access/udpate/manage tasks.  

It is intended that taskwerk can work along side git, so when a user is usint taskwerk they can generate commit messages from completed tasks using taskwerk to summarize completed tasks in a git friendly form.  

Taskwerk does not require AI to run but has AI features and LLM intergation to help users manage tasks, ask questions, break down workflows and manage commits.

### Current v1.x Architecture

The current taskwerk v1.x uses a simple two-file system:
- `tasks/tasks.md` - Active tasks organized by priority and category
- `tasks/tasks_completed.md` - Chronological list of completed tasks as they are done
- `tasks/taskwerk-rules.md` - Optional workflow rules file that defines project-specific guidelines for task completion, such as required test coverage, code quality gates, documentation requirements, and file organization standards. This allows teams to customize taskwerk's behavior and validation rules.

**Configuration Management:**
- `.taskrc.json` - Project-level configuration stored in the root directory containing settings for default priorities, categories, git integration preferences, and LLM provider configurations
- `~/.taskwerk/keys.json` - User-level API keys for LLM providers (OpenAI, Anthropic, etc.) stored securely in the user's home directory
- `.task-session.json` - Temporary session state tracking current task, branch, agent, and modified files during active work sessions  ## note in our archicture review we should discuss whether this should be kept here or udpates made to the task's definition in tasks.md

Tasks are managed through a CLI with commands like `add`, `start`, `complete`, `list`, and `search`. The system supports basic metadata (priority, category, ID) and integrates with git for branch creation and commit message generation.

Key design principles:
- **Human-editable**: All files are readable markdown that can be edited manually
- **Git-friendly**: Plain text files work well with version control
- **Simple workflow**: Unified commands that work the same for everyone
- **Optional AI**: LLM integration enhances but doesn't replace core functionality

## Current Task Archicture and Format

In the current v1.x system, tasks use a simple markdown format with minimal metadata:

### Active Task Format (tasks.md)

```markdown
# Project Tasks

*Last updated: 06/29/2025*
*Current session: CLI*
*Next ID: TASK-075*

## HIGH Priority

- [ ] **TASK-033** the npm run build needs to build all of taskwerk in to a single minified js
- [>] **TASK-045** taskwerk commit should have companion commands to stage files

### Bug Fixes

- [ ] **TASK-052** Enhance workflow rules validation to check for test files

## MEDIUM Priority

- [ ] **TASK-011** Write comprehensive documentation for all features
```

**Task States:**
- `[ ]` - Todo (not started)
- `[>]` - In progress (actively being worked on)
- `[!]` - Blocked (cannot proceed due to dependency)
- `[x]` - Completed (finished, will be moved to completed file)

### Completed Task Format (tasks_completed.md)

```markdown
# Completed Tasks

- [x] **TASK-074** Design comprehensive task management architecture *[2025-06-29T21:35:52.404Z]*
  Created comprehensive architectural plan for TaskWerk v2.0 addressing core issues: rich task schema with subfields, git integration with commit tracking, subtasks and dependencies, enhanced state management, and intelligent commit message generation.
  Files: dev/taskwerk-architecture-v2.md

- [x] **TASK-073** Fix failing tests and build system *[2025-06-29T21:20:00.598Z]*
  Fixed critical build failures by resolving failing tests. Key fixes included task parser bug, commit message format updates, and version bump logic improvements.
  Files: tests/utils/config.test.js, tests/core/task-manager.test.js
```

**Limitations of Current Format:**
- Minimal metadata (only ID, description, priority, category)
- No explicit file tracking during task work
- No subtask or dependency relationships
- Basic timestamp and notes in completed tasks
- Limited git integration context



## Current Problems Identified

1. **Insufficient task metadata** - tasks lack proper subfields for files, dates, notes
2. **Poor git integration** - no tracking of commits, git hashes, or relationship to code changes  
3. **No subtask support** - complex work cannot be broken down hierarchically
4. **No dependency management** - tasks often depend on other tasks being completed first
5. **Weak commit message generation** - doesn't leverage rich task data effectively
6. **Unclear state management** - task lifecycle and transitions are not well-defined

# Proposed Task Schema v2.0

### Core Task Structure
```markdown
- [ ] **TASK-001** Main task description
  **Created:** 2025-06-29T14:30:00Z
  **Priority:** high | medium | low  
  **Category:** features | bugs | docs | refactor | test
  **Assignee:** @username (optional)
  **Dependencies:** TASK-003, TASK-007
  **Estimated:** 2h | 4h | 1d | 1w
  
  **Description:**
  Detailed description of what needs to be done, acceptance criteria,
  and any relevant context or links.
  
  **Subtasks:**
  - [ ] TASK-001.1 - Specific subtask description
  - [ ] TASK-001.2 - Another subtask
  - [x] TASK-001.3 - Completed subtask
  
  **Files:** (auto-tracked when task completed)
  - src/commands/add.js
  - tests/commands/add.test.js
  - docs/add-command.md
  
  **Timeline:**
  - Started: 2025-06-29T15:00:00Z (@username)
  - Paused: 2025-06-29T16:30:00Z (waiting for TASK-003)
  - Resumed: 2025-06-30T09:00:00Z  
  - Completed: 2025-06-30T11:45:00Z
  
  **Git commits:**
  - abc123f: Initial implementation of add command
  - def456a: Add tests for add command
  - ghi789b: Update documentation
  
  **Notes:**
  Implementation notes, issues encountered, decisions made, links to
  relevant discussions or documentation.
```

### Task States and Lifecycle
```
[ ] todo       → [>] in-progress → [x] completed
                 ↓                   ↓
                [!] blocked         [~] archived
                 ↓                   
                [>] in-progress (resumed)
```

**State Definitions:**
- `[ ]` **todo** - Ready to start, all dependencies met
- `[>]` **in-progress** - Actively being worked on
- `[!]` **blocked** - Cannot proceed due to dependency or external blocker  
- `[x]` **completed** - Successfully finished
- `[~]` **archived** - Cancelled, obsolete, or moved elsewhere

## Task Format Examples

### Example 1: Complete Task with All Fields

```markdown
- [>] **TASK-045** Fix user authentication timeout issue  
  **Created:** 2025-06-29T14:30:00Z
  **Priority:** high
  **Category:** bugs
  **Assignee:** @johndoe
  **Dependencies:** TASK-043, TASK-044
  **Estimated:** 4h
  
  **Description:**
  Users are being logged out after 30 minutes of inactivity instead of the 
  configured 2 hours. This appears to be related to the session token refresh
  mechanism not properly extending the expiration time.
  
  Acceptance criteria:
  - Session timeout should respect the 2-hour configuration
  - Token refresh should properly extend session duration
  - Add tests to verify timeout behavior
  
  Related issue: https://github.com/company/app/issues/1234
  
  **Files:**
  - src/auth/session-manager.js
  - src/auth/token-service.js
  - tests/auth/session-timeout.test.js
  - docs/api/authentication.md
  
  **Timeline:**
  - Started: 2025-06-29T15:00:00Z (@johndoe)
  - Paused: 2025-06-29T16:30:00Z (waiting for TASK-044 API changes)
  - Resumed: 2025-06-30T09:00:00Z  
  - Review: 2025-06-30T11:00:00Z (@janedoe)
  - Completed: 2025-06-30T11:45:00Z
  
  **Git commits:**
  - abc123f: Fix session timeout calculation in token refresh
  - def456a: Add comprehensive session timeout tests
  - ghi789b: Update authentication documentation
  
  **Notes:**
  Found that the token refresh was using client timestamp instead of server
  timestamp, causing drift issues. Also discovered that the refresh endpoint
  wasn't properly updating the Redis session TTL. Both issues fixed and tested.
```

### Example 2: Task with Subtasks

```markdown
- [ ] **TASK-100** Implement comprehensive user dashboard
  **Created:** 2025-06-28T10:00:00Z
  **Priority:** high
  **Category:** features
  **Assignee:** @team-frontend
  **Dependencies:** TASK-098 (API design), TASK-099 (auth middleware)
  **Estimated:** 3d
  
  **Description:**
  Create a new user dashboard showing activity feed, statistics, and quick
  actions. Should be responsive and support dark mode from day one.
  
  **Subtasks:**
  - [x] TASK-100.1 - Design dashboard wireframes and mockups
    **Assignee:** @designer
    **Completed:** 2025-06-29T14:00:00Z
    **Note:** Mockups approved by product team
    
  - [>] TASK-100.2 - Implement design system tokens for dashboard
    **Assignee:** @johndoe  
    **Dependencies:** TASK-100.1
    **Started:** 2025-06-29T15:00:00Z
    **Files:** src/styles/tokens/dashboard.css, src/components/theme/
    
  - [ ] TASK-100.3 - Create dashboard layout components
    **Assignee:** @janedoe
    **Dependencies:** TASK-100.2
    **Estimated:** 1d
    
  - [ ] TASK-100.4 - Implement data fetching and state management
    **Assignee:** @bobsmith
    **Dependencies:** TASK-098, TASK-100.3
    **Estimated:** 1d
    
  - [ ] TASK-100.5 - Add loading states and error handling
    **Dependencies:** TASK-100.4
    **Estimated:** 4h
    
  - [ ] TASK-100.6 - Write integration and unit tests
    **Dependencies:** TASK-100.3, TASK-100.4, TASK-100.5
    **Estimated:** 1d
    
  - [ ] TASK-100.7 - Add documentation and storybook stories
    **Dependencies:** TASK-100.3
    **Estimated:** 4h
  
  **Progress:** 1/7 subtasks completed (14%)
  
  **Notes:**
  Design approved with minor revisions. Using new chart library for 
  statistics widgets. Need to coordinate with backend team on WebSocket
  events for real-time updates.
```

### Example 3: Completed Task with Rich History

```markdown
- [x] **TASK-087** Migrate database from PostgreSQL 12 to 15
  **Created:** 2025-06-20T08:00:00Z
  **Priority:** high
  **Category:** infrastructure
  **Assignee:** @dbadmin
  **Dependencies:** TASK-085 (backup verification), TASK-086 (staging test)
  **Estimated:** 8h
  **Actual:** 6h 30m
  
  **Description:**
  Upgrade production database from PostgreSQL 12 to 15 to take advantage of
  performance improvements and new features. Must be done with zero downtime
  using logical replication.
  
  **Files:**
  - scripts/db/migration/pg15-upgrade.sql
  - scripts/db/migration/pg15-rollback.sql
  - terraform/rds/main.tf
  - docs/runbooks/database-upgrade.md
  
  **Timeline:**
  - Started: 2025-06-25T22:00:00Z (@dbadmin)
  - Checkpoint: 2025-06-25T23:30:00Z (replica synced)
  - Checkpoint: 2025-06-26T01:00:00Z (validation passed)
  - Checkpoint: 2025-06-26T02:30:00Z (cutover complete)
  - Completed: 2025-06-26T04:30:00Z
  
  **Git commits:**
  - zyx987a: Add PostgreSQL 15 migration scripts
  - wvu654b: Update Terraform configs for RDS PostgreSQL 15
  - tsr321c: Add comprehensive migration runbook
  - qpo098d: Update connection pooler configs for PG15
  
  **Notes:**
  Migration completed successfully with only 12 seconds of write downtime
  during cutover. Logical replication worked flawlessly. Seeing 20% query
  performance improvement on complex analytical queries. No application
  changes required. Rollback plan tested but not needed.
  
  **Metrics:**
  - Downtime: 12 seconds (write), 0 seconds (read)
  - Data migrated: 847 GB
  - Migration duration: 6h 30m
  - Performance gain: ~20% on OLAP queries
```

## Enhanced Git Integration

### Commit Message Generation
```bash
# TaskWerk analyzes completed tasks and generates:
fix: Complete user authentication improvements (v0.1.8)

Resolved tasks:
- TASK-045: Fix login session timeout issue
  - Files: src/auth/session.js, tests/auth/session.test.js
  - Duration: 3h 15m
  - Commits: 3 commits (abc123f..def456a)
  
- TASK-047: Add password reset functionality  
  - Files: src/auth/reset.js, src/email/templates.js, tests/auth/reset.test.js
  - Duration: 5h 30m
  - Commits: 4 commits (ghi789b..jkl012c)

Dependencies resolved:
- TASK-045 was blocking TASK-049 (user profile updates)

Next up:
- TASK-049: Update user profile system (ready to start)
- TASK-051: Add two-factor authentication (waiting on TASK-049)

Total: 8h 45m work, 7 commits, 6 files modified
```

### Git Hooks Integration
- **Pre-commit**: Validate that in-progress tasks reference the files being committed
- **Post-commit**: Auto-link git commit hashes to related tasks
- **Branch naming**: Auto-suggest branch names based on task IDs (`feature/task-045-login-timeout`)

## Subtask and Dependency System

### Hierarchical Task Structure
```markdown
- [ ] **TASK-100** Implement user dashboard
  **Dependencies:** TASK-098 (API design)
  
  **Subtasks:**
  - [ ] TASK-100.1 - Create dashboard layout component
    **Dependencies:** TASK-100.2 (design system)
  - [ ] TASK-100.2 - Implement design system tokens
  - [ ] TASK-100.3 - Add data fetching logic
    **Dependencies:** TASK-100.1, TASK-098
  - [ ] TASK-100.4 - Write integration tests
    **Dependencies:** TASK-100.1, TASK-100.3
```

### Dependency Management Commands
```bash
# Check what's blocking a task
taskwerk deps TASK-100

# Show dependency tree
taskwerk tree TASK-100

# Find tasks ready to start (no blockers)
taskwerk ready

# Show critical path for project
taskwerk critical-path
```

## Enhanced Commands

### Task Creation with Rich Metadata
```bash
# Create task with full metadata
taskwerk add "Fix login timeout" \
  --priority high \
  --category bugs \
  --depends TASK-045,TASK-047 \
  --estimate 3h \
  --description "Users report being logged out after 30min instead of 2h"

# Create subtask
taskwerk add "Write unit tests" --parent TASK-100 --estimate 1h

# Create task from template
taskwerk add --template feature "Add dark mode toggle"
```

### Advanced Task Management
```bash
# Work with dependencies
taskwerk block TASK-100 "Waiting for design review"
taskwerk unblock TASK-100
taskwerk depends TASK-100 TASK-099  # Add dependency

# Subtask management  
taskwerk subtasks TASK-100           # List subtasks
taskwerk progress TASK-100           # Show completion percentage

# Timeline and tracking
taskwerk timeline TASK-100           # Show full history
taskwerk estimate TASK-100 --actual 4h  # Record actual time spent
taskwerk worklog                     # Show time tracking summary
```

### Enhanced Commit Workflow
```bash
# Intelligent staging and commit based on completed tasks
taskwerk commit --smart              # Auto-stage files from completed tasks
taskwerk commit --template feature   # Use feature commit template
taskwerk commit --version-bump minor # Bump version and include in message

# Review what would be committed
taskwerk stage --preview             # Show tasks + files that would be committed
taskwerk impact                      # Show potential impact of changes
```

## File Structure Changes

### Enhanced Task Files
```
tasks/
├── tasks.md              # Active tasks (current system)
├── tasks_completed.md    # Completed tasks (enhanced format)
├── tasks_archived.md     # Cancelled/obsolete tasks
├── templates/            # Task templates
│   ├── feature.md
│   ├── bug.md
│   └── epic.md
└── metrics/              # Performance data
    ├── velocity.json     # Completion rates
    ├── estimates.json    # Estimation accuracy
    └── timeline.json     # Historical data
```

### Configuration Schema
```json
{
  "taskwerk": {
    "version": "2.0",
    "templates": {
      "defaultTemplate": "standard",
      "customTemplates": ["feature", "bug", "epic"]
    },
    "git": {
      "autoLinkCommits": true,
      "branchNaming": "feature/task-{id}-{slug}",
      "requireTaskReference": true
    },
    "workflow": {
      "requireEstimates": false,
      "autoTrackTime": true,
      "dependencyChecking": true
    },
    "display": {
      "showSubtasks": true,
      "showDependencies": true,
      "maxRecent": 20
    }
  }
}
```

## Implementation Plan

### Phase 1: Core Schema (TASK-074.1)
- [ ] Design and implement new task markdown format
- [ ] Migrate existing tasks to new format
- [ ] Update parser to handle rich metadata

### Phase 2: Subtasks and Dependencies (TASK-074.2)  
- [ ] Implement subtask creation and management
- [ ] Add dependency tracking and validation
- [ ] Create dependency resolution commands

### Phase 3: Enhanced Git Integration (TASK-074.3)
- [ ] Auto-link commits to tasks
- [ ] Intelligent commit message generation
- [ ] Git hooks for workflow enforcement

### Phase 4: Advanced Features (TASK-074.4)
- [ ] Time tracking and estimates
- [ ] Task templates system
- [ ] Performance metrics and reporting

## Benefits

1. **Rich Context**: Every task has comprehensive metadata for better understanding
2. **Clear Dependencies**: Explicit task relationships prevent blocking issues
3. **Better Git Integration**: Commits are tightly linked to task completion
4. **Hierarchical Organization**: Complex work can be broken down systematically
5. **Time Awareness**: Estimation and tracking improve planning accuracy
6. **Intelligent Automation**: System can suggest next actions and optimize workflow

This architecture transforms TaskWerk from a simple task list into a comprehensive project management system while maintaining its markdown-based simplicity.