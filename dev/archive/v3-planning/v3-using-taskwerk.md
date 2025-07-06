# TaskWerk v3: Complete Usage Guide and Workflow Documentation

**Purpose:** Comprehensive walkthrough of TaskWerk v3 CLI usage patterns to validate design completeness and identify missing functionality.

**Audience:** Developers, AI agents, and system architects ensuring robust workflow coverage.

---

## Table of Contents

1. [Project Initialization](#project-initialization)
2. [Task Creation and Management](#task-creation-and-management)
3. [Working with Tasks](#working-with-tasks)
4. [Dependencies and Relationships](#dependencies-and-relationships)
5. [Search and Discovery](#search-and-discovery)
6. [Task Completion Workflows](#task-completion-workflows)
7. [Summary and Context Generation](#summary-and-context-generation)
8. [Git Integration](#git-integration)
9. [Agent and AI Interactions](#agent-and-ai-interactions)
10. [Team Collaboration](#team-collaboration)
11. [Advanced Workflows](#advanced-workflows)
12. [Maintenance and Administration](#maintenance-and-administration)

---

## Project Initialization

### Starting a New Project

```bash
# Initialize TaskWerk in a new project
cd /path/to/my-project
taskwerk init

# What TaskWerk does internally:
# 1. Creates taskwerk.db SQLite database with schema
# 2. Creates tasks/ directory for exports and rules
# 3. Generates initial taskwerk-rules.md with project defaults
# 4. Creates .gitignore entries for session files
# 5. Initializes meta table with schema version
```

**Output:**
```
✓ Initialized TaskWerk v3 database
✓ Created tasks/ directory structure
✓ Generated default workflow rules
✓ Updated .gitignore for session files
📁 Project ready at: /path/to/my-project/taskwerk.db

Next steps:
  taskwerk add "Setup project structure" --priority high
  taskwerk rules --edit  # Customize workflow rules
```

### Initializing in Existing Project

```bash
# Initialize in project with existing git history
taskwerk init --import-from tasks.md

# What TaskWerk does internally:
# 1. Creates new SQLite database
# 2. Parses existing tasks.md (v1/v2 format)
# 3. Migrates tasks to database with validation
# 4. Preserves task history and metadata
# 5. Backs up original files as .backup
# 6. Updates schema to v3 format
```

**Migration Output:**
```
🔄 Migrating from existing TaskWerk files...
✓ Parsed 23 tasks from tasks.md
✓ Migrated 18 active tasks
✓ Migrated 5 completed tasks
⚠️  2 tasks had validation warnings (see log)
✓ Backup created: tasks.md.backup

Migration Summary:
  23 total tasks processed
  21 successfully migrated
  2 require manual review
  
Next: taskwerk list --status error
```

### Configuration and Rules Setup

```bash
# Edit workflow rules
taskwerk rules --edit

# What TaskWerk does internally:
# 1. Opens taskwerk-rules.md in $EDITOR
# 2. Validates rule syntax on save
# 3. Updates rule cache in database
# 4. Checks rule compatibility with existing tasks
```

**Sample taskwerk-rules.md:**
```markdown
# TaskWerk Project Rules

## Test Requirements
- HIGH priority tasks must have associated test files
- Bug fixes require regression tests
- Features require integration tests

## File Patterns
- Tests must be in tests/ directory
- Documentation updates required for public APIs
- No commits without task reference

## Workflow Gates
- Tasks cannot be completed with failing tests
- Dependencies must be completed before starting
- High priority tasks require estimation

## Git Integration
- Auto-create branches for tasks
- Require clean working directory for completion
- Generate conventional commit messages
```

---

## Task Creation and Management

### Basic Task Creation

```bash
# Simple task
taskwerk add "Fix authentication timeout bug"

# What TaskWerk does internally:
# 1. Generates unique task ID (auto-increment)
# 2. Creates database record with defaults
# 3. Sets status to 'todo', priority to 'medium'
# 4. Records creation timestamp and author
# 5. Validates against project rules
```

**Output:**
```
✓ Created TASK-001: Fix authentication timeout bug
  Status: todo
  Priority: medium
  Created: 2025-07-03T10:30:00Z
  
Use: taskwerk start 1
```

### Rich Task Creation

```bash
# Task with full metadata
taskwerk add "Implement user dashboard with analytics" \
  --priority high \
  --category features \
  --assignee @alice \
  --estimate 3d \
  --description "Create comprehensive user dashboard with real-time analytics, charts, and export functionality"

# What TaskWerk does internally:
# 1. Validates all input parameters against schema
# 2. Checks assignee format (@username)
# 3. Validates estimate format (3d, 2h, etc.)
# 4. Stores rich metadata in task record
# 5. Creates initial note with description
# 6. Applies any rule-based defaults
```

**Output:**
```
✓ Created TASK-002: Implement user dashboard with analytics
  Status: todo
  Priority: high
  Category: features
  Assignee: @alice
  Estimate: 3d
  Created: 2025-07-03T10:35:00Z
  
⚠️  Rule check: HIGH priority task requires test plan
Next: taskwerk note 2 "Add test plan details"
```

### Task Templates

```bash
# Create task from template
taskwerk add --template bug "Login fails on mobile Safari"

# What TaskWerk does internally:
# 1. Loads bug template from tasks/templates/bug.yaml
# 2. Applies template defaults (priority, category, etc.)
# 3. Includes template-specific fields (reproduction steps, environment)
# 4. Creates task with pre-filled structure
```

**Bug Template Output:**
```
✓ Created TASK-003: Login fails on mobile Safari
  Status: todo
  Priority: high (from bug template)
  Category: bugs
  
Template fields added:
  ✓ Reproduction steps (empty - fill required)
  ✓ Environment details (empty - fill required)
  ✓ Expected vs actual behavior (empty - fill required)
  
Next: taskwerk edit 3  # Fill template details
```

### Bulk Task Operations

```bash
# Create multiple related tasks
taskwerk add --template epic "User Authentication Overhaul" \
  --subtasks "Update login UI,Implement 2FA,Add OAuth providers,Write documentation"

# What TaskWerk does internally:
# 1. Creates parent epic task
# 2. Creates subtasks with dependencies on parent
# 3. Establishes dependency relationships
# 4. Distributes estimates across subtasks
# 5. Maintains referential integrity
```

---

## Working with Tasks

### Starting Work on a Task

```bash
# Start working on a task
taskwerk start 2

# What TaskWerk does internally:
# 1. Validates all dependencies are completed
# 2. Checks if task is currently assigned to another user
# 3. Updates status from 'todo' to 'in_progress'
# 4. Records start timestamp in notes
# 5. Creates git branch (if git integration enabled)
# 6. Updates session state (.task-session.json)
# 7. Checks workflow rules compliance
```

**Output:**
```
🚀 Started TASK-002: Implement user dashboard with analytics
  Status: todo → in_progress
  Branch: feature/task-002-user-dashboard
  Started: 2025-07-03T14:20:00Z
  
Dependencies: All clear ✓
Rules check: Passed ✓
Session: Updated

Working on: TASK-002
Files to track: (none yet)
Next: Make your changes, then `taskwerk track <files>`
```

### Tracking Work Progress

```bash
# Track files being modified
taskwerk track src/dashboard/Dashboard.jsx src/api/analytics.js

# What TaskWerk does internally:
# 1. Associates files with current task
# 2. Records file paths in task_files table
# 3. Updates modification tracking
# 4. Monitors git status for changes
```

**Output:**
```
✓ Tracking files for TASK-002:
  + src/dashboard/Dashboard.jsx
  + src/api/analytics.js
  
Files will be included in completion analysis.
```

### Adding Notes and Updates

```bash
# Add progress note
taskwerk note 2 "Implemented basic dashboard layout, working on charts integration"

# What TaskWerk does internally:
# 1. Creates timestamped note record
# 2. Links note to task and current user
# 3. Updates task modification timestamp
# 4. Preserves note history for audit trail
```

**Output:**
```
✓ Added note to TASK-002
  Author: @alice
  Time: 2025-07-03T15:45:00Z
  
Note: Implemented basic dashboard layout, working on charts integration
```

### Pausing and Resuming Work

```bash
# Pause work temporarily
taskwerk pause 2 --reason "Waiting for API documentation"

# What TaskWerk does internally:
# 1. Updates status from 'in_progress' to 'blocked'
# 2. Records pause reason and timestamp
# 3. Preserves branch and file tracking
# 4. Updates session state
# 5. Notifies of blocking dependencies
```

**Output:**
```
⏸️  Paused TASK-002: Implement user dashboard with analytics
  Status: in_progress → blocked
  Reason: Waiting for API documentation
  Paused: 2025-07-03T16:30:00Z
  
Branch: feature/task-002-user-dashboard (preserved)
Tracked files: 2 files (preserved)
```

```bash
# Resume work
taskwerk resume 2 --note "API docs received, continuing implementation"

# What TaskWerk does internally:
# 1. Updates status from 'blocked' to 'in_progress'
# 2. Records resume timestamp and note
# 3. Restores session context
# 4. Validates dependencies still met
```

---

## Dependencies and Relationships

### Adding Dependencies

```bash
# Add dependency (task 2 depends on task 1)
taskwerk depends 2 1

# What TaskWerk does internally:
# 1. Validates both tasks exist
# 2. Checks for circular dependencies
# 3. Creates relationship in task_dependencies table
# 4. Updates dependent task status if needed
# 5. Recalculates ready-to-start tasks
```

**Output:**
```
✓ Added dependency: TASK-002 → TASK-001
  TASK-002 now depends on TASK-001 completion
  
Dependency tree updated:
  TASK-001: Fix authentication timeout bug (todo)
    └── TASK-002: Implement user dashboard (blocked by dependencies)
    
⚠️  TASK-002 status changed: in_progress → blocked
Reason: Dependency TASK-001 not completed
```

### Managing Subtasks

```bash
# Add subtask to existing task
taskwerk subtask 2 "Create user analytics API endpoint" --assignee @bob

# What TaskWerk does internally:
# 1. Creates new task with parent relationship
# 2. Inherits category and priority from parent
# 3. Creates dependency relationship (parent depends on subtask)
# 4. Updates parent task progress tracking
```

**Output:**
```
✓ Created subtask TASK-004: Create user analytics API endpoint
  Parent: TASK-002 (Implement user dashboard with analytics)
  Assignee: @bob
  Status: todo
  
Parent task progress: 0/1 subtasks completed (0%)
```

### Viewing Dependencies

```bash
# Show dependency tree
taskwerk tree 2

# What TaskWerk does internally:
# 1. Queries recursive dependencies from database
# 2. Builds hierarchical tree structure
# 3. Shows status and blocking relationships
# 4. Calculates critical path
```

**Output:**
```
📊 Dependency Tree for TASK-002

TASK-002: Implement user dashboard with analytics [BLOCKED]
├── Dependencies (must complete first):
│   └── TASK-001: Fix authentication timeout bug [TODO]
│       ├── Files: src/auth/session.js
│       └── Estimate: 2h
├── Subtasks (0/1 completed):
│   └── TASK-004: Create user analytics API endpoint [TODO] (@bob)
│       └── Estimate: 1d
└── Progress: 0% (blocked by 1 dependency, 1 subtask pending)

Critical Path: TASK-001 → TASK-004 → TASK-002 (3d total)
Ready to start: TASK-001
```

### Removing Dependencies

```bash
# Remove dependency
taskwerk undepends 2 1 --reason "Decided to implement independently"

# What TaskWerk does internally:
# 1. Removes relationship from task_dependencies
# 2. Updates dependent task status if appropriate
# 3. Records reason in task notes
# 4. Recalculates ready-to-start tasks
```

---

## Search and Discovery

### Basic Search

```bash
# Search tasks by keyword
taskwerk search "dashboard"

# What TaskWerk does internally:
# 1. Performs full-text search across task names and descriptions
# 2. Searches notes and comments
# 3. Ranks results by relevance
# 4. Returns formatted results with context
```

**Output:**
```
🔍 Search results for "dashboard"

3 tasks found:

TASK-002: Implement user dashboard with analytics [BLOCKED] @alice
  Priority: high | Category: features | Created: 2025-07-03
  Match: "dashboard" in title, "dashboard layout" in notes
  Files: src/dashboard/Dashboard.jsx, src/api/analytics.js

TASK-004: Create user analytics API endpoint [TODO] @bob
  Priority: high | Category: features | Created: 2025-07-03
  Match: "dashboard" in parent task
  Parent: TASK-002

TASK-007: Update admin dashboard colors [COMPLETED] @alice
  Priority: low | Category: ui | Completed: 2025-07-02
  Match: "dashboard" in title
```

### Advanced Search and Filtering

```bash
# Complex search with filters
taskwerk search --assignee @alice --status in_progress,blocked --priority high

# What TaskWerk does internally:
# 1. Builds SQL query with multiple filter conditions
# 2. Joins across tables for assignee, status, priority
# 3. Applies date ranges and metadata filters
# 4. Returns structured results
```

**Output:**
```
🎯 Filtered search: @alice, status:(in_progress,blocked), priority:high

2 tasks found:

TASK-002: Implement user dashboard with analytics [BLOCKED] @alice
  Dependencies: TASK-001 (todo)
  Started: 2025-07-03T14:20:00Z
  Files: 2 tracked files
  
TASK-005: Optimize database queries [IN_PROGRESS] @alice
  Started: 2025-07-02T09:15:00Z
  Progress: 75% (3/4 subtasks completed)
  Files: 5 tracked files
```

### Finding Ready Work

```bash
# Show tasks ready to start
taskwerk ready

# What TaskWerk does internally:
# 1. Queries tasks with status 'todo'
# 2. Filters out tasks with incomplete dependencies
# 3. Applies rule-based ready criteria
# 4. Sorts by priority and creation date
```

**Output:**
```
🎯 Ready to start (4 tasks):

HIGH PRIORITY:
TASK-001: Fix authentication timeout bug [TODO]
  No dependencies | Estimate: 2h | Category: bugs
  Ready for: @anyone
  
TASK-008: Update documentation for API v2 [TODO]
  No dependencies | Estimate: 4h | Category: docs
  Ready for: @anyone

MEDIUM PRIORITY:
TASK-006: Refactor user service tests [TODO]
  No dependencies | Estimate: 1d | Category: testing
  Ready for: @anyone

LOW PRIORITY:
TASK-009: Add dark mode to settings page [TODO]
  No dependencies | Estimate: 3h | Category: ui
  Ready for: @anyone

Recommended next: taskwerk start 1
```

---

## Task Completion Workflows

### Simple Task Completion

```bash
# Complete a task
taskwerk complete 1 --note "Fixed session timeout calculation, added proper error handling"

# What TaskWerk does internally:
# 1. Validates task is in 'in_progress' status
# 2. Runs workflow rule checks (tests, documentation)
# 3. Collects files changed since task start
# 4. Updates status to 'completed'
# 5. Records completion timestamp and note
# 6. Updates dependent tasks (unblocks them)
# 7. Runs git operations if configured
# 8. Updates session state
```

**Output:**
```
✅ Completing TASK-001: Fix authentication timeout bug

Rule checks:
  ✓ Tests passing (npm test)
  ✓ No lint errors
  ✓ Files tracked: 3 files
  
Files changed since start:
  ✓ src/auth/session-manager.js (modified)
  ✓ src/auth/middleware.js (modified)  
  ✓ tests/auth/session.test.js (created)

Git operations:
  ✓ Changes staged
  ✓ Commit created: "fix: Complete TASK-001 - Fix authentication timeout"
  ✓ Branch ready for merge

Completion summary:
  Status: in_progress → completed
  Duration: 2h 15m (actual vs 2h estimate)
  Files: 3 files modified
  
Unblocked tasks:
  ✓ TASK-002: Now ready to start
  
Next: taskwerk start 2
```

### Completion with Validation Failures

```bash
# Attempt completion with failing tests
taskwerk complete 1

# What TaskWerk does internally:
# 1. Runs pre-completion validation
# 2. Detects test failures
# 3. Blocks completion
# 4. Updates task status to 'error'
# 5. Records error details
```

**Output:**
```
❌ Cannot complete TASK-001: Validation failed

Rule violations:
  ✗ Tests failing (2 failures in auth.test.js)
  ✓ No lint errors
  ✓ Files tracked
  
Error details:
  Test failures:
    - should extend session on activity (line 45)
    - should handle invalid tokens (line 67)
    
Status: in_progress → error
Next steps:
  1. Fix failing tests
  2. Run: npm test
  3. Try: taskwerk complete 1
  
Use --force to override (not recommended)
```

### Force Completion

```bash
# Force completion despite validation failures
taskwerk complete 1 --force --note "Tests will be fixed in follow-up task"

# What TaskWerk does internally:
# 1. Bypasses rule validation checks
# 2. Records force completion in notes
# 3. Adds warning tags to task
# 4. Completes task with error state notation
```

---

## Summary and Context Generation

### Agent Context Summary

```bash
# Get context for starting work on a task
taskwerk summary --agent-context 2

# What TaskWerk does internally:
# 1. Queries task details and metadata
# 2. Builds dependency tree and relationships
# 3. Finds related tasks (by files, keywords)
# 4. Includes recent relevant history
# 5. Formats for optimal agent consumption
```

**Output:**
```
🤖 Agent Context for TASK-002

## Task Overview
ID: TASK-002
Title: Implement user dashboard with analytics
Status: blocked → ready (dependencies completed)
Priority: high | Category: features | Assignee: @alice
Estimate: 3d | Created: 2025-07-03T10:35:00Z

## Description
Create comprehensive user dashboard with real-time analytics, 
charts, and export functionality

## Dependencies (resolved)
✓ TASK-001: Fix authentication timeout bug (completed 2025-07-03T16:45:00Z)
  - Fixed session management issues
  - Affects: src/auth/session-manager.js

## Subtasks (0/1 completed)
⏳ TASK-004: Create user analytics API endpoint (todo) @bob
  - Required for dashboard data
  - Estimate: 1d

## Related Work
- TASK-007: Update admin dashboard colors (completed)
  - Same files: src/dashboard/Dashboard.jsx
- TASK-012: User profile redesign (in_progress) @alice
  - Shared component: UserAvatar

## Files to Work With
- src/dashboard/Dashboard.jsx (tracked, modified recently)
- src/api/analytics.js (tracked, new file)
- src/components/charts/ (suggested location)

## Implementation Notes
- Dashboard layout implemented (75% complete)
- Charts integration in progress
- API endpoint pending (TASK-004)

## Next Steps
1. Continue charts integration
2. Mock API data until TASK-004 complete
3. Implement responsive layout
4. Add export functionality
```

### Daily Standup Summary

```bash
# Get daily progress summary
taskwerk summary --completed --since yesterday --author @alice

# What TaskWerk does internally:
# 1. Queries completed tasks in time range
# 2. Aggregates work by author
# 3. Includes duration and effort metrics
# 4. Shows impact on other tasks
```

**Output:**
```
📊 Daily Summary for @alice (2025-07-03)

## Completed Yesterday (2 tasks)

✅ TASK-001: Fix authentication timeout bug
  Duration: 2h 15m (est: 2h) ✓ on track
  Files: 3 files (src/auth/*, tests/auth/session.test.js)
  Impact: Unblocked TASK-002, TASK-006
  
✅ TASK-007: Update admin dashboard colors  
  Duration: 45m (est: 1h) ✓ under estimate
  Files: 2 files (src/admin/*, styles/admin.css)
  Impact: Closed design debt

## Currently Working On
⏳ TASK-002: Implement user dashboard (blocked → ready)
⏳ TASK-005: Optimize database queries (75% complete)

## Velocity Metrics
- Completed: 2 tasks, 3h actual vs 3h estimated
- Accuracy: 100% (on or under estimate)
- Unblocked: 2 tasks for team

## Ready for Today
🎯 TASK-002: Ready to start (dependencies resolved)
```

### Project Health Summary

```bash
# Get project overview
taskwerk summary --project-health

# What TaskWerk does internally:
# 1. Analyzes all tasks across project
# 2. Identifies bottlenecks and blockers
# 3. Calculates velocity and completion rates
# 4. Highlights risks and dependencies
```

**Output:**
```
🏥 Project Health Summary

## Task Distribution
📋 Total: 45 tasks
  ✅ Completed: 23 (51%)
  🏃 In Progress: 8 (18%)
  ⏸️  Blocked: 3 (7%)
  📝 Todo: 11 (24%)

## Priority Breakdown
🔴 High: 12 tasks (4 completed, 3 in progress, 5 todo)
🟡 Medium: 25 tasks (15 completed, 4 in progress, 6 todo)  
🟢 Low: 8 tasks (4 completed, 1 in progress, 3 todo)

## Bottlenecks
⚠️  TASK-010: Database migration (blocking 5 tasks)
  - In progress 4 days
  - Assigned: @bob
  - Risk: Timeline impact

⚠️  TASK-015: API redesign (blocking 3 tasks)
  - Blocked 2 days (waiting external review)
  - Critical path dependency

## Velocity Trends
📈 Last 7 days: 8 tasks completed
📊 Average task time: 1.2d (estimate accuracy: 85%)
🎯 Projected completion: 2025-07-15 (12 days)

## Recommendations
1. Prioritize TASK-010 completion (bottleneck)
2. Follow up on TASK-015 external dependency
3. Consider reassigning 2 overdue tasks
```

### Search-Based Summaries

```bash
# Find all authentication-related work
taskwerk summary --search "auth" --include-notes --include-history

# What TaskWerk does internally:
# 1. Performs comprehensive search across all task data
# 2. Includes notes, comments, and historical events
# 3. Groups by relevance and recency
# 4. Shows relationships and patterns
```

**Output:**
```
🔍 Authentication Work Summary (12 items found)

## Active Tasks (3)
TASK-002: Implement user dashboard (auth integration needed)
  - Dependencies on TASK-001 (auth timeout fix)
  - Files: src/auth/*, src/dashboard/auth-check.js
  
TASK-015: OAuth provider integration (blocked)
  - Waiting: External API review
  - Files: src/auth/oauth/, config/auth.yaml

TASK-018: Add 2FA support (todo)
  - Dependencies: TASK-015
  - Estimate: 2d

## Recently Completed (2)  
✅ TASK-001: Fix authentication timeout bug (completed yesterday)
  - Duration: 2h 15m
  - Impact: Session management improved
  
✅ TASK-009: Update auth middleware (completed 3 days ago)
  - Duration: 1d
  - Files: src/auth/middleware.js

## Historical Pattern Analysis
📊 Auth tasks: 12 total over 30 days
🕐 Average completion: 1.5d 
🎯 Success rate: 92% (11/12 completed successfully)
⚠️  Common issues: Testing complexity, external dependencies

## Knowledge Insights
- Session timeout logic in: src/auth/session-manager.js
- Test patterns in: tests/auth/
- Configuration: config/auth.yaml, .env.auth
- Documentation: docs/authentication.md (updated recently)

## Recommendations
1. Prioritize TASK-015 unblocking for OAuth work
2. Consider 2FA implementation after OAuth stable
3. Review session management patterns (2 recent fixes)
```

---

## Git Integration

### Automatic Branch Management

```bash
# Starting a task automatically creates branch
taskwerk start 5

# What TaskWerk does internally:
# 1. Checks git working directory is clean
# 2. Creates feature branch: feature/task-5-optimize-queries
# 3. Updates task with branch information
# 4. Records git context in task notes
```

**Output:**
```
🚀 Started TASK-005: Optimize database queries

Git integration:
  ✓ Working directory clean
  ✓ Created branch: feature/task-5-optimize-queries
  ✓ Switched to new branch
  
Current context:
  Base branch: main (commit: abc123f)
  Working branch: feature/task-5-optimize-queries
  Files to track: (use `taskwerk track <files>`)
```

### Intelligent Commit Generation

```bash
# Complete task with automatic commit
taskwerk complete 5 --auto-commit

# What TaskWerk does internally:
# 1. Validates completion rules
# 2. Collects all file changes since task start
# 3. Generates conventional commit message
# 4. Includes task context and metadata
# 5. Stages files and creates commit
# 6. Updates task with commit hash
```

**Generated Commit Message:**
```
perf: Complete TASK-005 - Optimize database queries

Tasks completed:
- TASK-005: Optimize database queries (@alice, 2d)

Implementation details:
- Added indexes on user_id and created_at columns
- Implemented query result caching with 5min TTL
- Reduced dashboard load time from 3.2s to 400ms
- Added database connection pooling

Performance impact:
- 87% reduction in query time
- 40% reduction in database load
- Cache hit ratio: 85%

Files modified:
- src/database/models/User.js (query optimization)
- src/database/cache.js (new caching layer)
- src/api/analytics.js (cache integration)
- tests/database/queries.test.js (performance tests)
- docs/database-optimization.md (documentation)

Dependencies resolved:
- Unblocked TASK-002 (dashboard implementation)
- Unblocked TASK-012 (user profile performance)

🤖 Generated with TaskWerk v3
Co-Authored-By: TaskWerk <taskwerk@project.local>
```

### Manual Git Operations

```bash
# Stage specific files for task
taskwerk git stage src/database/ tests/database/

# What TaskWerk does internally:
# 1. Associates files with current task
# 2. Runs git add on specified paths
# 3. Updates file tracking in database
# 4. Prepares for commit generation
```

```bash
# Generate commit message preview
taskwerk git commit --preview

# What TaskWerk does internally:
# 1. Analyzes staged files and task context
# 2. Generates commit message using task metadata
# 3. Shows preview without committing
# 4. Allows editing before actual commit
```

```bash
# Commit with task context
taskwerk git commit --message "Custom message prefix"

# What TaskWerk does internally:
# 1. Uses custom prefix with generated suffix
# 2. Includes task metadata in commit body
# 3. Links commit hash to task record
# 4. Updates task progress tracking
```

### Branch Cleanup

```bash
# Complete task and clean up branch
taskwerk complete 5 --merge-branch

# What TaskWerk does internally:
# 1. Completes task normally
# 2. Switches back to base branch (main)
# 3. Merges feature branch
# 4. Deletes feature branch
# 5. Updates task with merge commit hash
```

**Output:**
```
✅ TASK-005 completed successfully

Git cleanup:
  ✓ Switched to main branch
  ✓ Merged feature/task-5-optimize-queries
  ✓ Deleted feature branch
  ✓ Updated remote refs
  
Merge commit: def456g
Task record updated with merge hash
```

---

## Agent and AI Interactions

### Agent Task Assignment

```bash
# Agent claims a task
taskwerk start 3 --agent "claude-3" --note "AI agent starting work"

# What TaskWerk does internally:
# 1. Records agent identifier in task notes
# 2. Updates assignee field with agent info
# 3. Tracks agent sessions separately
# 4. Applies agent-specific workflows
```

**Output:**
```
🤖 Agent claude-3 started TASK-003: Login fails on mobile Safari

Agent session:
  ✓ Agent: claude-3
  ✓ Session ID: agent-session-abc123
  ✓ Human oversight: @alice (monitoring)
  
Agent context loaded:
  - Task details and requirements
  - Related bug reports and fixes
  - Test environment setup
  - Code patterns and conventions
  
Next: Agent will analyze issue and propose solution
```

### Agent Context Requests

```bash
# Agent requests focused context
taskwerk ask "What authentication-related tasks are currently blocked and why?"

# What TaskWerk does internally:
# 1. Parses natural language query
# 2. Identifies relevant search terms and filters
# 3. Queries database with semantic search
# 4. Formats response for agent consumption
```

**Agent Response:**
```
🤖 Agent Query Response

Based on your question about blocked authentication tasks:

## Currently Blocked (2 tasks)

TASK-015: OAuth provider integration [BLOCKED - 2 days]
  Reason: Waiting for external API review from Google OAuth team
  Impact: Blocking TASK-018 (2FA support), TASK-022 (SSO integration)
  Owner: @bob
  Next: Follow up on support ticket #GCP-789123
  
TASK-021: Security audit implementation [BLOCKED - 1 day]  
  Reason: Dependency on TASK-015 completion
  Impact: Security compliance deadline risk
  Owner: @alice
  Next: Consider interim solution or scope reduction

## Resolution Recommendations
1. Escalate TASK-015 external dependency (critical path)
2. Consider OAuth alternative or interim solution
3. Decouple TASK-021 security requirements if possible

Context: 3 other auth tasks are ready but depend on these blockers.
```

### Agent Learning and Adaptation

```bash
# Agent reports completion with learning
taskwerk complete 3 --agent "claude-3" \
  --note "Fixed Safari cookie handling bug, learned about SameSite attribute requirements" \
  --learned "Mobile Safari requires SameSite=None for cross-site cookies in embedded contexts"

# What TaskWerk does internally:
# 1. Records agent completion and learning
# 2. Stores learning for future context
# 3. Updates project knowledge base
# 4. Links learning to similar issue patterns
```

**Output:**
```
✅ Agent claude-3 completed TASK-003: Login fails on mobile Safari

Agent completion summary:
  ✓ Duration: 45 minutes
  ✓ Solution: Safari cookie handling fix
  ✓ Learning recorded: SameSite attribute requirements
  
Knowledge base updated:
  + Mobile Safari cookie handling patterns
  + Cross-site embedding requirements
  + Browser compatibility considerations
  
Similar issues found (will apply learning):
  - TASK-009: Cross-domain login issues
  - TASK-014: Embedded widget authentication
  
Agent efficiency: +15% (compared to similar tasks)
```

### Agent-Human Handoffs

```bash
# Agent requests human review
taskwerk escalate 7 --agent "claude-3" --reason "Complex architecture decision needed"

# What TaskWerk does internally:
# 1. Updates task status to 'review_requested'
# 2. Notifies assigned human reviewer
# 3. Preserves agent work context
# 4. Records handoff reason and timing
```

**Output:**
```
🔄 TASK-007 escalated for human review

Agent: claude-3
Reason: Complex architecture decision needed
Escalated to: @alice (task owner)

Agent work preserved:
  ✓ Code changes staged (not committed)
  ✓ Analysis notes saved
  ✓ Decision points documented
  ✓ Alternative approaches evaluated

Human context:
  Location: feature/task-7-api-redesign
  Files: 8 modified, 3 new
  Decisions needed: Database schema migration strategy
  
Notification sent to @alice
```

### Multi-Agent Coordination

```bash
# Coordinate multiple agents on large task
taskwerk subtask 10 "Frontend implementation" --agent "claude-frontend" 
taskwerk subtask 10 "Backend API" --agent "claude-backend"
taskwerk subtask 10 "Database migration" --assignee @alice

# What TaskWerk does internally:
# 1. Creates parallel subtasks with different agents
# 2. Establishes coordination protocols
# 3. Tracks inter-agent dependencies
# 4. Manages shared resources and conflicts
```

---

## Team Collaboration

### Team Task Distribution

```bash
# View team workload
taskwerk team --workload

# What TaskWerk does internally:
# 1. Queries all tasks by assignee
# 2. Calculates workload distribution
# 3. Identifies bottlenecks and over-allocation
# 4. Suggests rebalancing opportunities
```

**Output:**
```
👥 Team Workload Distribution

## Active Work (8 tasks in progress)
@alice    ████████░░ 3 tasks (4d estimated) 
  - TASK-002: User dashboard (high, 3d remaining)
  - TASK-005: DB optimization (medium, 1d remaining)  
  - TASK-012: Profile redesign (low, 2h remaining)

@bob      ██████████ 2 tasks (5d estimated) ⚠️ OVERLOADED
  - TASK-010: DB migration (high, 3d remaining) 🔥 BOTTLENECK
  - TASK-015: OAuth integration (high, 2d remaining) ⏸️ BLOCKED

@charlie  ████░░░░░░ 2 tasks (2d estimated)
  - TASK-008: Documentation (medium, 1d remaining)
  - TASK-011: UI polish (low, 1d remaining)

## Recommendations
⚠️  @bob overloaded - consider reassigning TASK-015
🔥 TASK-010 blocking 5 other tasks - needs priority
💡 @charlie available for additional high priority work

## Ready to Assign (3 tasks)
TASK-018: 2FA implementation (high, 2d) - suggested: @charlie
TASK-019: Performance testing (medium, 1d) - suggested: @alice  
TASK-020: Code review automation (low, 4h) - suggested: @anyone
```

### Task Assignment and Handoffs

```bash
# Assign task to team member
taskwerk assign 18 @charlie --note "Charlie has bandwidth and relevant experience"

# What TaskWerk does internally:
# 1. Updates assignee field in database
# 2. Notifies new assignee via configured channels
# 3. Transfers task context and history
# 4. Updates team workload calculations
```

**Output:**
```
✅ Assigned TASK-018 to @charlie

Assignment details:
  Task: Add 2FA support
  From: unassigned → @charlie
  Reason: Charlie has bandwidth and relevant experience
  
Context transferred:
  ✓ Dependencies: TASK-015 (OAuth integration)
  ✓ Related work: TASK-003 (Safari login fix)
  ✓ Technical notes: 2FA requirements doc
  
Notifications sent:
  📧 @charlie: New task assigned
  📊 Team: Workload updated
  
Next: @charlie can run `taskwerk start 18` when ready
```

### Team Synchronization

```bash
# Generate team standup report
taskwerk team --standup --since yesterday

# What TaskWerk does internally:
# 1. Aggregates all team member activity
# 2. Identifies completed work and progress
# 3. Highlights blockers and dependencies
# 4. Formats for standup meeting consumption
```

**Output:**
```
📋 Daily Standup Report (2025-07-03)

## Team Velocity
✅ Completed: 4 tasks (6d total effort)
🏃 In Progress: 8 tasks  
⚠️  New Blockers: 1 task

## Individual Updates

### @alice (2 completions)
✅ TASK-001: Fix auth timeout (2h) - unblocked 2 tasks
✅ TASK-007: Update dashboard colors (45m)
🏃 TASK-002: User dashboard (50% complete)
🏃 TASK-005: DB optimization (75% complete)

### @bob (1 completion)  
✅ TASK-009: Auth middleware update (1d)
🏃 TASK-010: DB migration (day 4, blocking others) ⚠️
⏸️  TASK-015: OAuth integration (blocked: external review)

### @charlie (1 completion)
✅ TASK-011: UI polish completion (6h)
🏃 TASK-008: Documentation (90% complete)
🆕 TASK-018: 2FA support (just assigned)

## Team Issues
🔥 CRITICAL: TASK-010 blocking 5 tasks (assign help?)
⏳ EXTERNAL: TASK-015 waiting on Google review (follow up?)
📈 VELOCITY: On track for sprint goals

## Action Items
1. @bob: Needs help with TASK-010 (database migration)
2. @alice: Follow up on TASK-015 external dependency  
3. @charlie: Start TASK-018 when TASK-015 unblocks
```

---

## Advanced Workflows

### Complex Dependency Management

```bash
# Create complex project with dependencies
taskwerk add "Release v2.0" --template release --priority high
taskwerk subtask 25 "Frontend redesign" --assignee @alice
taskwerk subtask 25 "API v2 implementation" --assignee @bob  
taskwerk subtask 25 "Database migration" --assignee @charlie
taskwerk subtask 25 "Documentation update" --assignee @alice
taskwerk subtask 25 "QA testing" --assignee @qa-team

# Set up dependency chain
taskwerk depends 26 27  # Frontend depends on API
taskwerk depends 27 28  # API depends on DB migration
taskwerk depends 29 26  # Docs depend on Frontend
taskwerk depends 30 29  # QA depends on Docs
```

**Dependency Analysis:**
```bash
taskwerk tree 25 --critical-path

# What TaskWerk does internally:
# 1. Calculates complete dependency graph
# 2. Identifies critical path through project
# 3. Finds parallel work opportunities
# 4. Estimates total completion time
```

**Output:**
```
🎯 Release v2.0 Critical Path Analysis

Critical Path (longest): 7 days
  TASK-28: Database migration (2d) @charlie
    └── TASK-27: API v2 implementation (3d) @bob
        └── TASK-26: Frontend redesign (2d) @alice
            └── TASK-29: Documentation (1d) @alice
                └── TASK-30: QA testing (1d) @qa-team

Parallel Opportunities:
  ⚡ TASK-31: Performance optimization (2d) - can start now
  ⚡ TASK-32: Security audit (1d) - can run parallel to development

Resource Conflicts:
  ⚠️  @alice: 3d work (frontend + docs) - consider splitting docs

Recommendations:
  1. Start TASK-28 immediately (critical path)
  2. Parallelize TASK-31 and TASK-32
  3. Consider docs handoff to free @alice bandwidth
  
Projected completion: 2025-07-10 (7 working days)
```

### Template-Based Workflows

```bash
# Create bug report template
taskwerk template create bug --fields "reproduction,environment,expected,actual" \
  --priority high --category bugs --assignee @qa-team

# What TaskWerk does internally:
# 1. Creates template definition in tasks/templates/
# 2. Defines required and optional fields
# 3. Sets default values and validation rules
# 4. Enables template-based task creation
```

**Template Usage:**
```bash
# Use template for consistent bug reporting
taskwerk add --template bug "Payment processing fails on checkout"

# What TaskWerk does internally:
# 1. Loads bug template structure
# 2. Prompts for required fields
# 3. Validates input according to template rules
# 4. Creates task with complete bug report format
```

### Automated Workflows

```bash
# Set up automated task progression
taskwerk workflow create "feature-development" \
  --trigger "task_completed" \
  --condition "category=features AND priority=high" \
  --action "create_subtask:QA testing" \
  --action "notify:qa-team"

# What TaskWerk does internally:
# 1. Creates workflow rule in database
# 2. Monitors task events for trigger conditions
# 3. Executes actions when conditions met
# 4. Logs workflow execution for audit
```

### Bulk Operations

```bash
# Bulk update tasks
taskwerk bulk --filter "category=bugs AND status=todo" \
  --set "priority=high" \
  --set "assignee=@qa-team" \
  --reason "Bug triage: all open bugs now high priority"

# What TaskWerk does internally:
# 1. Queries tasks matching filter criteria
# 2. Validates bulk update permissions
# 3. Applies changes atomically
# 4. Records bulk operation in audit log
# 5. Notifies affected team members
```

**Output:**
```
📦 Bulk Update Operation

Filter: category=bugs AND status=todo
Changes: priority→high, assignee→@qa-team
Reason: Bug triage: all open bugs now high priority

Affected tasks (5):
  ✓ TASK-033: Login validation error
  ✓ TASK-034: Mobile layout issues  
  ✓ TASK-035: API timeout errors
  ✓ TASK-036: Form submission bug
  ✓ TASK-037: Cache invalidation issue

Results:
  ✅ 5 tasks updated successfully
  📧 Notifications sent to @qa-team
  📝 Audit log entry created

⚠️  Note: Use bulk operations carefully - changes cannot be undone
```

---

## Maintenance and Administration

### Database Health and Optimization

```bash
# Check database health
taskwerk admin --health-check

# What TaskWerk does internally:
# 1. Validates database schema integrity
# 2. Checks for orphaned records and relationships
# 3. Analyzes query performance
# 4. Identifies optimization opportunities
```

**Output:**
```
🏥 TaskWerk Database Health Check

## Schema Status
✅ Schema version: 3.1.0 (current)
✅ All tables present and valid
✅ Indexes optimized
✅ Foreign key constraints intact

## Data Integrity
✅ Tasks: 247 records (0 orphaned)
✅ Dependencies: 89 relationships (0 invalid)
✅ Notes: 1,234 records (0 orphaned)
✅ Files: 456 associations (0 broken)

## Performance Metrics
📊 Average query time: 12ms (excellent)
📊 Cache hit ratio: 87% (good)
📊 Database size: 15.2MB (normal)

## Recommendations
💡 Consider archiving completed tasks older than 6 months
💡 Vacuum database to reclaim space (saves ~2MB)
💡 Update query statistics for better optimization

All systems healthy ✅
```

### Data Export and Backup

```bash
# Export project data
taskwerk export --format yaml --include-completed --include-notes

# What TaskWerk does internally:
# 1. Queries all task data from database
# 2. Formats according to specified format
# 3. Includes metadata and relationships
# 4. Creates human-readable export file
```

**Export Output:**
```yaml
# TaskWerk Export - Project: my-awesome-app
# Generated: 2025-07-03T18:30:00Z
# Version: 3.1.0
# Total tasks: 247 (134 completed, 113 active)

metadata:
  project: my-awesome-app
  exported_at: 2025-07-03T18:30:00Z
  taskwerk_version: 3.1.0
  schema_version: 3.1.0
  total_tasks: 247

tasks:
  - id: 1
    name: "Fix authentication timeout bug"
    status: completed
    priority: high
    category: bugs
    assignee: "@alice"
    created_at: 2025-06-28T09:15:00Z
    completed_at: 2025-07-03T16:45:00Z
    files:
      - src/auth/session-manager.js
      - tests/auth/session.test.js
    notes:
      - author: "@alice"
        timestamp: 2025-07-03T16:45:00Z
        text: "Fixed session timeout calculation, added proper error handling"
    git:
      commits:
        - hash: abc123f
          message: "fix: Complete TASK-001 - Fix authentication timeout"
          timestamp: 2025-07-03T16:50:00Z

  # ... additional tasks
```

### System Migration

```bash
# Migrate to new version
taskwerk admin --migrate --backup-first

# What TaskWerk does internally:
# 1. Creates full database backup
# 2. Runs schema migration scripts
# 3. Validates data integrity after migration
# 4. Updates version metadata
# 5. Provides rollback option if needed
```

### Analytics and Reporting

```bash
# Generate comprehensive project analytics
taskwerk analytics --period "last-30-days" --export-csv

# What TaskWerk does internally:
# 1. Aggregates task completion data over period
# 2. Calculates velocity and estimation accuracy
# 3. Identifies patterns and trends
# 4. Generates actionable insights
```

**Analytics Output:**
```
📊 Project Analytics (Last 30 Days)

## Completion Metrics
✅ Tasks completed: 45
📈 Average velocity: 1.5 tasks/day
⏱️  Average task duration: 1.8 days
🎯 Estimation accuracy: 76% (within 25% of estimate)

## Category Breakdown
🐛 Bugs: 18 tasks (40% of work)
✨ Features: 15 tasks (33% of work)  
📚 Docs: 8 tasks (18% of work)
🧪 Tests: 4 tasks (9% of work)

## Team Performance
@alice: 20 tasks (44%), avg 1.6d per task
@bob: 15 tasks (33%), avg 2.1d per task  
@charlie: 10 tasks (22%), avg 1.3d per task

## Workflow Insights
🏃 Most efficient: UI tasks (avg 0.8d)
⏳ Most time-consuming: Database tasks (avg 2.8d)
🔄 Most rework: Integration tasks (15% reopened)

## Recommendations
1. Improve estimation for database work
2. Create templates for common UI patterns
3. Add integration testing to prevent rework
4. Consider pair programming for complex features

Data exported to: project-analytics-2025-07-03.csv
```

---

## Validation and Testing

This comprehensive usage guide serves as both documentation and design validation. Key areas validated:

### ✅ Complete Workflow Coverage
- Project initialization and migration
- Task lifecycle management
- Dependency and relationship handling
- Search and discovery capabilities
- Completion workflows with validation
- Context generation for agents
- Git integration throughout
- Team collaboration features
- Advanced automation and templating
- System administration and maintenance

### ✅ User Experience Consistency
- Consistent command patterns and outputs
- Clear error messages and guidance
- Progressive disclosure of complexity
- Helpful suggestions and next steps
- Rich context in all operations

### ✅ Technical Robustness
- Database integrity throughout operations
- Atomic transactions and rollback capability
- Comprehensive validation and error handling
- Performance considerations for large datasets
- Scalable architecture for team growth

### ✅ Agent Integration
- Natural language query processing
- Context-aware response generation
- Learning and adaptation capabilities
- Human-agent handoff protocols
- Multi-agent coordination support

This guide demonstrates that TaskWerk v3's SQLite-based architecture enables sophisticated workflows while maintaining the simplicity and developer-centricity that defines TaskWerk's core philosophy.