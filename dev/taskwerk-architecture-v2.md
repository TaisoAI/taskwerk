# TaskWerk Architecture v2.0 - Comprehensive Task Management

## Current Problems Identified

1. **Insufficient task metadata** - tasks lack proper subfields for files, dates, notes
2. **Poor git integration** - no tracking of commits, git hashes, or relationship to code changes  
3. **No subtask support** - complex work cannot be broken down hierarchically
4. **No dependency management** - tasks often depend on other tasks being completed first
5. **Weak commit message generation** - doesn't leverage rich task data effectively
6. **Unclear state management** - task lifecycle and transitions are not well-defined

## Proposed Task Schema v2.0

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