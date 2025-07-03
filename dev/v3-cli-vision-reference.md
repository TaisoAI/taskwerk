# TaskWerk v3 CLI Command Reference

**Purpose:** Comprehensive specification of all TaskWerk v3 CLI commands for implementation and testing.

**Architecture Note:** Commands are separated into Mechanical Operations (deterministic, work offline) and Intelligent Operations (AI-powered, may require external services).

---

## Table of Contents

1. [Core Task Management](#core-task-management)
2. [Workflow Operations](#workflow-operations)
3. [Mechanical Task Operations](#mechanical-task-operations)
4. [Dependency & Relationship Management](#dependency--relationship-management)
5. [Search & Discovery](#search--discovery)
6. [Context & Summary Generation](#context--summary-generation)
7. [Intelligent Analysis Operations](#intelligent-analysis-operations)
8. [Git Integration](#git-integration)
9. [Team Collaboration](#team-collaboration)
10. [Import/Export Operations](#importexport-operations)
11. [Configuration & Administration](#configuration--administration)
12. [Session Management](#session-management)

---

## Core Task Management

### `taskwerk init`
**Purpose:** Initialize TaskWerk v3 in a project directory  
**Type:** Administrative  
**Parameters:**
- `[path]` - Optional project path (default: current directory)
- `--import-from <file>` - Import existing v1/v2 tasks during initialization
- `--force` - Overwrite existing TaskWerk installation

**What it does:**
1. Creates `taskwerk.db` SQLite database with v3 schema
2. Creates `tasks/` directory structure
3. Generates `tasks/taskwerk-rules.md` with default workflow rules
4. Creates `.taskrc.json` with default configuration
5. Updates `.gitignore` to exclude session files
6. If `--import-from` specified, migrates existing tasks

**Side effects:**
- Creates database file and directory structure
- Modifies `.gitignore`
- May create backup files during import

**Exit codes:** 0 (success), 1 (error), 2 (already initialized)

---

### `taskwerk add`
**Purpose:** Create a new task with metadata  
**Type:** Mechanical  
**Parameters:**
- `<description>` - Task description (required)
- `--priority <high|medium|low>` - Task priority (default: medium)
- `--category <string>` - Task category
- `--assignee <@username>` - Assigned user (@ prefix required)
- `--estimate <duration>` - Time estimate (e.g., "2h", "1d", "1w")
- `--depends <task-id>` - Comma-separated list of dependency task IDs
- `--parent <task-id>` - Make this a subtask of specified task
- `--template <name>` - Use predefined task template

**What it does:**
1. Generates unique auto-increment task ID
2. Validates all input parameters against schema
3. Creates database record in `tasks` table
4. Creates initial timeline entry for creation
5. Links dependencies if specified
6. Applies template defaults if specified
7. Validates against project rules

**Side effects:**
- Creates task record in database
- Updates task counters and indexes
- May trigger rule validation warnings

**Exit codes:** 0 (success), 1 (validation error), 2 (dependency error)

---

### `taskwerk list`
**Purpose:** Display tasks with filtering and formatting  
**Type:** Query  
**Parameters:**
- `--status <status>` - Filter by status (todo, in_progress, blocked, completed, archived)
- `--priority <priority>` - Filter by priority (high, medium, low)
- `--assignee <@username>` - Filter by assignee
- `--category <string>` - Filter by category (partial match)
- `--since <date>` - Filter by creation/update date
- `--format <table|json|yaml>` - Output format (default: table)
- `--include-completed` - Include completed tasks (default: false)
- `--include-subtasks` - Show subtasks inline (default: true)
- `--limit <number>` - Maximum number of tasks to show

**What it does:**
1. Builds SQL query based on filter parameters
2. Joins with related tables for complete data
3. Applies date range and limit constraints
4. Formats output according to specified format
5. Calculates and displays summary statistics

**Side effects:** None (read-only operation)

**Exit codes:** 0 (success), 1 (invalid filter)

---

### `taskwerk get`
**Purpose:** Display detailed information for a specific task  
**Type:** Query  
**Parameters:**
- `<task-id>` - Task ID to display (required)
- `--format <table|json|yaml>` - Output format (default: table)
- `--include-notes` - Include all notes and timeline (default: true)
- `--include-dependencies` - Show dependency tree (default: true)
- `--include-files` - Show associated files (default: true)

**What it does:**
1. Retrieves complete task record from database
2. Joins with dependencies, notes, files, and timeline
3. Formats comprehensive task information
4. Calculates progress metrics for subtasks

**Side effects:** None (read-only operation)

**Exit codes:** 0 (success), 1 (task not found)

---

## Workflow Operations

### `taskwerk start`
**Purpose:** Begin work on a task with full workflow integration  
**Type:** Workflow  
**Parameters:**
- `<task-id>` - Task ID to start (required)
- `--note <string>` - Optional note for timeline
- `--agent <agent-id>` - Mark as agent-driven work
- `--branch` - Create Git branch (default: auto from config)
- `--no-branch` - Skip Git branch creation

**What it does:**
1. Validates task exists and is in valid state for starting
2. Checks all dependencies are completed
3. Validates against workflow rules
4. Updates task status to 'in_progress'
5. Records start timestamp and user in timeline
6. Creates Git feature branch if enabled
7. Updates session state with current task
8. Checks for conflicts with other in-progress tasks

**Side effects:**
- Updates task status in database
- Creates Git branch
- Updates session file
- May create workflow validation warnings

**Exit codes:** 0 (success), 1 (validation error), 2 (dependency error), 3 (git error)

---

### `taskwerk pause`
**Purpose:** Temporarily pause work on a task  
**Type:** Workflow  
**Parameters:**
- `<task-id>` - Task ID to pause (required)
- `--reason <string>` - Reason for pausing (recommended)
- `--note <string>` - Additional context note

**What it does:**
1. Validates task is currently in 'in_progress' state
2. Updates status to 'blocked' or 'todo' based on reason
3. Records pause timestamp and reason in timeline
4. Preserves Git branch and file tracking state
5. Updates session state

**Side effects:**
- Updates task status in database
- Preserves but doesn't update Git state
- Updates session file

**Exit codes:** 0 (success), 1 (task not in progress), 2 (validation error)

---

### `taskwerk resume`
**Purpose:** Resume work on a paused task  
**Type:** Workflow  
**Parameters:**
- `<task-id>` - Task ID to resume (required)
- `--note <string>` - Note about resumption context

**What it does:**
1. Validates task is in 'blocked' or 'todo' state
2. Re-validates dependencies are still completed
3. Updates status to 'in_progress'
4. Records resume timestamp in timeline
5. Restores session context and Git branch
6. Re-applies workflow validation

**Side effects:**
- Updates task status in database
- Restores Git branch context
- Updates session file

**Exit codes:** 0 (success), 1 (invalid state), 2 (dependency error)

---

### `taskwerk complete`
**Purpose:** Mark task as completed with full validation workflow  
**Type:** Workflow  
**Parameters:**
- `<task-id>` - Task ID to complete (required)
- `--note <string>` - Completion note with implementation details
- `--auto-commit` - Automatically create Git commit
- `--force` - Bypass workflow rule validation
- `--files <file-list>` - Manually specify files to associate

**What it does:**
1. Validates task is in 'in_progress' state
2. Runs workflow rule validation (tests, linting, etc.)
3. Collects Git file changes since task start
4. Updates status to 'completed'
5. Records completion timestamp and note
6. Updates dependent tasks (unblocks them)
7. Auto-completes subtasks if all completed
8. Creates Git commit if requested
9. Updates velocity and estimation metrics

**Side effects:**
- Updates task status in database
- May create Git commit
- Updates dependent task states
- Runs external validation commands
- Updates project metrics

**Exit codes:** 0 (success), 1 (validation failed), 2 (git error), 3 (workflow rule failure)

---

### `taskwerk block`
**Purpose:** Mark task as blocked with explicit reason  
**Type:** Workflow  
**Parameters:**
- `<task-id>` - Task ID to block (required)
- `--reason <string>` - Blocking reason (required)
- `--depends-on <task-id>` - Task this is waiting for
- `--external` - Mark as external dependency

**What it does:**
1. Updates task status to 'blocked'
2. Records blocking reason and timestamp
3. Links to blocking task if specified
4. Preserves work context and Git state
5. Notifies dependent tasks of status change

**Side effects:**
- Updates task status in database
- May create dependency relationships
- Preserves Git branch state

**Exit codes:** 0 (success), 1 (task not found), 2 (validation error)

---

### `taskwerk unblock`
**Purpose:** Remove blocking status from task  
**Type:** Workflow  
**Parameters:**
- `<task-id>` - Task ID to unblock (required)
- `--note <string>` - Note about unblocking context

**What it does:**
1. Validates task is in 'blocked' state
2. Re-validates dependencies if any
3. Updates status to 'todo' or 'in_progress'
4. Records unblock timestamp and note
5. Restores work context if returning to progress

**Side effects:**
- Updates task status in database
- May restore session context

**Exit codes:** 0 (success), 1 (not blocked), 2 (dependencies still incomplete)

---

## Mechanical Task Operations

### `taskwerk split`
**Purpose:** Split one task into multiple independent tasks  
**Type:** Mechanical  
**Parameters:**
- `<task-id>` - Task ID to split (required)
- `<description-1> [description-2] ...` - Descriptions for new tasks
- `--preserve-dependencies` - New tasks inherit original dependencies
- `--distribute-files` - Automatically distribute file associations
- `--assign <strategy>` - Assignment strategy (inherit, distribute, unassigned)

**What it does:**
1. Archives original task with split marker
2. Creates new independent tasks with specified descriptions
3. Redistributes dependencies to appropriate new tasks
4. Distributes file associations based on patterns
5. Copies relevant metadata (category, priority)
6. Records split operation in audit trail
7. Updates timeline with split reasoning

**Side effects:**
- Archives original task
- Creates multiple new task records
- Updates dependency relationships
- Updates file associations

**Exit codes:** 0 (success), 1 (task not found), 2 (invalid split parameters)

---

### `taskwerk merge`
**Purpose:** Combine multiple tasks into a single task  
**Type:** Mechanical  
**Parameters:**
- `<task-id-1> <task-id-2> [task-id-3] ...` - Task IDs to merge (required)
- `--into <description>` - Description for merged task (required)
- `--preserve-notes` - Include all notes from merged tasks
- `--assignee <@username>` - Assignee for merged task

**What it does:**
1. Validates all tasks exist and are in valid states
2. Creates new task with combined scope
3. Merges all notes and timeline entries
4. Combines file associations
5. Merges dependency relationships
6. Archives original tasks with merge markers
7. Records merge operation rationale

**Side effects:**
- Archives multiple tasks
- Creates new merged task record
- Consolidates notes and timeline
- Updates dependency graph

**Exit codes:** 0 (success), 1 (invalid task states), 2 (conflicting dependencies)

---

### `taskwerk clone`
**Purpose:** Create a copy of an existing task  
**Type:** Mechanical  
**Parameters:**
- `<task-id>` - Task ID to clone (required)
- `--as <description>` - Description for cloned task (required)
- `--assignee <@username>` - Assignee for cloned task
- `--copy-notes` - Include notes from original task
- `--copy-dependencies` - Include dependency relationships

**What it does:**
1. Creates new task based on original task metadata
2. Copies specified fields and relationships
3. Generates new unique task ID
4. Records clone relationship in audit trail
5. Optionally copies notes and dependencies

**Side effects:**
- Creates new task record
- May duplicate dependency relationships
- Creates clone tracking relationship

**Exit codes:** 0 (success), 1 (source task not found)

---

### `taskwerk promote`
**Purpose:** Convert subtask to independent task  
**Type:** Mechanical  
**Parameters:**
- `<subtask-id>` - Subtask ID to promote (required)
- `--inherit-dependencies` - Inherit parent task dependencies

**What it does:**
1. Removes parent-child relationship
2. Converts subtask to independent task
3. Optionally inherits parent dependencies
4. Updates parent task progress calculation
5. Records promotion in timeline

**Side effects:**
- Updates task hierarchy relationships
- Modifies parent task state
- Updates dependency graph

**Exit codes:** 0 (success), 1 (not a subtask), 2 (invalid hierarchy state)

---

### `taskwerk demote`
**Purpose:** Convert independent task to subtask  
**Type:** Mechanical  
**Parameters:**
- `<task-id>` - Task ID to demote (required)
- `--parent <parent-task-id>` - Parent task ID (required)

**What it does:**
1. Validates parent task exists and accepts subtasks
2. Creates parent-child relationship
3. Updates task hierarchy
4. Adjusts parent progress calculation
5. Records demotion in timeline

**Side effects:**
- Creates hierarchy relationship
- Updates parent task metadata
- May affect dependency calculations

**Exit codes:** 0 (success), 1 (invalid parent), 2 (circular hierarchy)

---

### `taskwerk move`
**Purpose:** Change subtask parent  
**Type:** Mechanical  
**Parameters:**
- `<subtask-id>` - Subtask ID to move (required)
- `--parent <new-parent-id>` - New parent task ID (required)

**What it does:**
1. Validates subtask and new parent exist
2. Updates parent-child relationships
3. Adjusts progress calculations for both parents
4. Records move operation in timeline
5. Validates no circular dependencies created

**Side effects:**
- Updates hierarchy relationships
- Modifies multiple parent task states
- Updates progress calculations

**Exit codes:** 0 (success), 1 (invalid hierarchy), 2 (circular dependency)

---

## Dependency & Relationship Management

### `taskwerk link`
**Purpose:** Add dependency relationship between tasks  
**Type:** Mechanical  
**Parameters:**
- `<dependent-task-id>` - Task that depends on another (required)
- `<dependency-task-id>` - Task that must be completed first (required)
- `--type <blocks|requires>` - Dependency type (default: blocks)

**What it does:**
1. Validates both tasks exist
2. Checks for circular dependency creation
3. Creates dependency relationship in database
4. Updates dependent task status if needed
5. Recalculates ready-to-start task list
6. Records dependency creation in timeline

**Side effects:**
- Creates dependency relationship
- May update task status
- Updates ready task calculations

**Exit codes:** 0 (success), 1 (circular dependency), 2 (task not found)

---

### `taskwerk unlink`
**Purpose:** Remove dependency relationship between tasks  
**Type:** Mechanical  
**Parameters:**
- `<dependent-task-id>` - Task with dependency (required)
- `<dependency-task-id>` - Dependency to remove (required)

**What it does:**
1. Validates dependency relationship exists
2. Removes relationship from database
3. Updates dependent task status if appropriate
4. Recalculates ready-to-start tasks
5. Records dependency removal in timeline

**Side effects:**
- Removes dependency relationship
- May update task status
- Updates ready task calculations

**Exit codes:** 0 (success), 1 (dependency not found)

---

### `taskwerk tree`
**Purpose:** Display dependency tree for task or project  
**Type:** Query  
**Parameters:**
- `[task-id]` - Task ID for tree root (default: all tasks)
- `--depth <number>` - Maximum tree depth (default: unlimited)
- `--format <tree|graph|json>` - Output format (default: tree)
- `--include-completed` - Show completed dependencies
- `--critical-path` - Highlight critical path

**What it does:**
1. Queries recursive dependency relationships
2. Builds hierarchical tree structure
3. Calculates critical path if requested
4. Formats output as text tree or graph
5. Shows task status and progress indicators

**Side effects:** None (read-only operation)

**Exit codes:** 0 (success), 1 (task not found)

---

### `taskwerk ready`
**Purpose:** Show tasks ready to start (no incomplete dependencies)  
**Type:** Query  
**Parameters:**
- `--assignee <@username>` - Filter by assignee
- `--priority <priority>` - Filter by priority
- `--category <string>` - Filter by category
- `--format <table|json>` - Output format

**What it does:**
1. Queries all 'todo' status tasks
2. Filters out tasks with incomplete dependencies
3. Applies additional filters
4. Sorts by priority and creation date
5. Displays ready tasks with context

**Side effects:** None (read-only operation)

**Exit codes:** 0 (success)

---

## Search & Discovery

### `taskwerk search`
**Purpose:** Search tasks by text, metadata, and content  
**Type:** Query  
**Parameters:**
- `<query>` - Search query string (required)
- `--fields <field-list>` - Fields to search (title, description, notes)
- `--status <status>` - Limit to specific status
- `--include-completed` - Include completed tasks
- `--include-notes` - Search in notes and comments
- `--include-files` - Search in file associations
- `--format <table|json>` - Output format
- `--limit <number>` - Maximum results

**What it does:**
1. Performs full-text search across specified fields
2. Uses SQL LIKE or FTS for text matching
3. Applies status and metadata filters
4. Ranks results by relevance
5. Includes context snippets in results

**Side effects:** None (read-only operation)

**Exit codes:** 0 (success), 1 (no results found)

---

### `taskwerk find`
**Purpose:** Find tasks by exact metadata criteria  
**Type:** Query  
**Parameters:**
- `--id <task-id>` - Find by exact ID
- `--assignee <@username>` - Find by assignee
- `--category <string>` - Find by category
- `--has-files <pattern>` - Find tasks with matching file patterns
- `--created-since <date>` - Find tasks created after date
- `--format <table|json>` - Output format

**What it does:**
1. Builds precise SQL query from criteria
2. Applies exact matching filters
3. Joins with related tables as needed
4. Returns matching tasks with metadata

**Side effects:** None (read-only operation)

**Exit codes:** 0 (success), 1 (no matches)

---

## Context & Summary Generation

### `taskwerk summary`
**Purpose:** Generate intelligent contextual summaries  
**Type:** Intelligent Query  
**Parameters:**
- `--agent-context <task-id>` - Context optimized for AI agents
- `--completed` - Summary of completed work
- `--since <date>` - Time range for summary
- `--author <@username>` - Filter by author/assignee
- `--project-health` - Overall project status summary
- `--search <query>` - Summary focused on search results
- `--include-notes` - Include notes in analysis
- `--include-history` - Include timeline events
- `--format <markdown|json>` - Output format

**What it does:**
1. Queries relevant tasks based on parameters
2. Builds contextual relationships and dependencies
3. Analyzes patterns and metrics
4. Generates human or agent-optimized summaries
5. Includes actionable insights and recommendations

**Side effects:** None (read-only operation, but may cache results)

**Exit codes:** 0 (success), 1 (insufficient data)

---

### `taskwerk context`
**Purpose:** Get detailed context for a specific task  
**Type:** Query  
**Parameters:**
- `<task-id>` - Task ID for context (required)
- `--include-related` - Include related tasks by files/keywords
- `--include-similar` - Include similar historical tasks
- `--agent-format` - Format for AI agent consumption
- `--depth <number>` - Relationship depth (default: 2)

**What it does:**
1. Retrieves complete task information
2. Finds related tasks through various relationships
3. Includes relevant historical context
4. Formats for optimal human or agent understanding
5. Calculates task complexity and scope metrics

**Side effects:** None (read-only operation)

**Exit codes:** 0 (success), 1 (task not found)

---

### `taskwerk ask`
**Purpose:** Natural language query interface  
**Type:** Intelligent Query  
**Parameters:**
- `<question>` - Natural language question (required)
- `--context <additional-context>` - Additional context for query
- `--format <text|json>` - Response format

**What it does:**
1. Parses natural language query
2. Converts to appropriate database queries
3. Analyzes results in context
4. Formats natural language response
5. May suggest follow-up actions

**Side effects:** None (read-only operation)

**Exit codes:** 0 (success), 1 (query not understood), 2 (no relevant data)

---

## Intelligent Analysis Operations

### `taskwerk analyze`
**Purpose:** AI-powered task and project analysis  
**Type:** Intelligent Analysis  
**Parameters:**
- `[task-id]` - Specific task to analyze (default: all tasks)
- `--project` - Analyze entire project health
- `--context <string>` - Additional context for analysis
- `--agent <agent-id>` - Specific AI agent to use
- `--depth <shallow|deep>` - Analysis depth
- `--format <text|json>` - Output format

**What it does:**
1. Calls configured AI agent/service
2. Provides task data and context to agent
3. Receives analysis and recommendations
4. Formats and validates response
5. May cache results for performance

**Side effects:**
- Makes external API calls
- May cache analysis results
- Creates analysis audit trail

**Exit codes:** 0 (success), 1 (analysis failed), 2 (agent unavailable), 3 (invalid context)

---

### `taskwerk implement`
**Purpose:** Execute AI recommendations via mechanical operations  
**Type:** Implementation  
**Parameters:**
- `<recommendation>` - Recommendation text or file (required)
- `--dry-run` - Show operations without executing
- `--confirm` - Prompt for confirmation before each operation
- `--force` - Execute without validation
- `--from-file <file>` - Read recommendations from file

**What it does:**
1. Parses recommendation text or JSON
2. Converts to specific mechanical operations
3. Validates operation feasibility
4. Executes operations in safe order
5. Reports results and any failures

**Side effects:**
- Executes mechanical operations
- Modifies task database
- Creates implementation audit trail

**Exit codes:** 0 (success), 1 (parse error), 2 (operation failed), 3 (validation error)

---

## Git Integration

### `taskwerk branch`
**Purpose:** Create or switch to task-specific Git branch  
**Type:** Git Operation  
**Parameters:**
- `<task-id>` - Task ID for branch (required)
- `--force` - Force branch creation even if exists
- `--base <branch>` - Base branch for new branch (default: main)

**What it does:**
1. Validates task exists and Git repository available
2. Creates branch name from task ID and description
3. Creates and switches to new Git branch
4. Associates branch with task in database
5. Records Git operation in task timeline

**Side effects:**
- Creates Git branch
- Changes Git working directory
- Updates task metadata

**Exit codes:** 0 (success), 1 (git error), 2 (task not found), 3 (branch exists)

---

### `taskwerk commit`
**Purpose:** Create intelligent commit with task context  
**Type:** Git Operation  
**Parameters:**
- `[task-id]` - Task ID for commit context (default: current task)
- `--message <string>` - Custom commit message prefix
- `--auto` - Actually create commit (default: preview only)
- `--include-files <pattern>` - Include specific file patterns
- `--template <template>` - Use commit message template

**What it does:**
1. Generates commit message from task metadata
2. Includes completed tasks and implementation notes
3. Lists modified files with context
4. Creates conventional commit format
5. Links commit hash to task record if executed

**Side effects:**
- Creates Git commit (if --auto specified)
- Updates task with commit reference
- May stage files automatically

**Exit codes:** 0 (success), 1 (no changes), 2 (git error), 3 (task not found)

---

### `taskwerk track`
**Purpose:** Associate files with current task  
**Type:** File Tracking  
**Parameters:**
- `<file-pattern> [file-pattern-2] ...` - File patterns to track (required)
- `--task <task-id>` - Task to associate with (default: current task)
- `--auto-detect` - Auto-detect changed files

**What it does:**
1. Resolves file patterns to actual file paths
2. Associates files with specified task
3. Records file associations in database
4. Updates task modification tracking
5. Monitors for future changes to tracked files

**Side effects:**
- Creates file association records
- Updates task metadata
- May setup file monitoring

**Exit codes:** 0 (success), 1 (no current task), 2 (files not found)

---

## Team Collaboration

### `taskwerk assign`
**Purpose:** Assign task to team member  
**Type:** Mechanical  
**Parameters:**
- `<task-id>` - Task ID to assign (required)
- `<@username>` - Assignee username (required)
- `--note <string>` - Assignment reason/context
- `--notify` - Send notification to assignee

**What it does:**
1. Updates task assignee field
2. Records assignment change in timeline
3. Optionally sends notification
4. Updates team workload calculations
5. Validates assignee format and permissions

**Side effects:**
- Updates task assignee
- May send notifications
- Updates team metrics

**Exit codes:** 0 (success), 1 (task not found), 2 (invalid assignee)

---

### `taskwerk team`
**Purpose:** Team collaboration and workload management  
**Type:** Team Query  
**Parameters:**
- `--workload` - Show team workload distribution
- `--standup` - Generate standup report
- `--since <date>` - Time range for team analysis
- `--member <@username>` - Focus on specific team member

**What it does:**
1. Aggregates team task data
2. Calculates workload distribution
3. Identifies bottlenecks and capacity
4. Generates team progress reports
5. Suggests workload rebalancing

**Side effects:** None (read-only operation)

**Exit codes:** 0 (success), 1 (insufficient team data)

---

## Import/Export Operations

### `taskwerk import`
**Purpose:** Import tasks from external formats  
**Type:** Data Import  
**Parameters:**
- `<file>` - File to import (required)
- `--format <yaml|json|csv|markdown>` - Input format (auto-detected)
- `--merge` - Merge with existing tasks
- `--overwrite` - Overwrite existing tasks
- `--validate-only` - Validate without importing

**What it does:**
1. Parses input file according to format
2. Validates task data against schema
3. Checks for ID conflicts and duplicates
4. Imports tasks into database
5. Creates import audit trail

**Side effects:**
- Creates task records in database
- May overwrite existing data
- Creates backup before import

**Exit codes:** 0 (success), 1 (parse error), 2 (validation error), 3 (conflict error)

---

### `taskwerk export`
**Purpose:** Export tasks to external formats  
**Type:** Data Export  
**Parameters:**
- `--format <yaml|json|csv|markdown>` - Output format (default: yaml)
- `--output <file>` - Output file (default: stdout)
- `--filter <expression>` - Task filter expression
- `--include-completed` - Include completed tasks
- `--include-notes` - Include notes and timeline
- `--template <template>` - Use export template

**What it does:**
1. Queries tasks based on filter criteria
2. Formats according to specified format
3. Includes metadata and relationships
4. Writes to file or stdout
5. Creates export audit record

**Side effects:**
- Creates output file
- Records export operation

**Exit codes:** 0 (success), 1 (filter error), 2 (write error)

---

## Configuration & Administration

### `taskwerk config`
**Purpose:** Manage TaskWerk configuration  
**Type:** Configuration  
**Parameters:**
- `--get <key>` - Get configuration value
- `--set <key> <value>` - Set configuration value
- `--edit` - Edit configuration file
- `--validate` - Validate configuration
- `--reset` - Reset to defaults

**What it does:**
1. Manages `.taskrc.json` configuration file
2. Validates configuration values
3. Applies configuration changes
4. Updates runtime configuration cache

**Side effects:**
- Modifies configuration file
- Updates runtime settings

**Exit codes:** 0 (success), 1 (invalid key), 2 (validation error)

---

### `taskwerk rules`
**Purpose:** Manage workflow rules  
**Type:** Configuration  
**Parameters:**
- `--edit` - Edit rules file
- `--validate` - Validate rules syntax
- `--test <task-id>` - Test rules against specific task
- `--status` - Show current rules status

**What it does:**
1. Manages `tasks/taskwerk-rules.md` file
2. Validates rule syntax and logic
3. Tests rules against existing tasks
4. Updates rule cache and validation

**Side effects:**
- Modifies rules file
- Updates rule validation cache

**Exit codes:** 0 (success), 1 (syntax error), 2 (validation failed)

---

### `taskwerk admin`
**Purpose:** Administrative operations  
**Type:** Administrative  
**Parameters:**
- `--health-check` - Check database and system health
- `--vacuum` - Optimize database storage
- `--backup <file>` - Create database backup
- `--restore <file>` - Restore from backup
- `--migrate` - Run schema migrations
- `--stats` - Show system statistics

**What it does:**
1. Performs administrative operations on database
2. Validates data integrity
3. Optimizes performance
4. Manages backups and migrations

**Side effects:**
- Modifies database structure
- Creates/restores backup files
- May lock database temporarily

**Exit codes:** 0 (success), 1 (operation failed), 2 (data corruption)

---

## Session Management

### `taskwerk status`
**Purpose:** Show current session and task status  
**Type:** Session Query  
**Parameters:**
- `--verbose` - Show detailed session information
- `--git` - Include Git status information

**What it does:**
1. Reads current session state
2. Shows active task and context
3. Displays Git branch and file status
4. Shows pending notifications and alerts

**Side effects:** None (read-only operation)

**Exit codes:** 0 (success)

---

### `taskwerk note`
**Purpose:** Add note to task or session  
**Type:** Mechanical  
**Parameters:**
- `<task-id>` - Task ID for note (required)
- `<note-text>` - Note content (required)
- `--private` - Mark as private note
- `--type <type>` - Note type (comment, decision, reminder)

**What it does:**
1. Creates timestamped note record
2. Associates with specified task
3. Records author and note type
4. Updates task modification time

**Side effects:**
- Creates note record in database
- Updates task modification time

**Exit codes:** 0 (success), 1 (task not found)

---

## Command Categories Summary

### Mechanical Operations (Always Available)
- Core: `add`, `list`, `get`
- Structure: `split`, `merge`, `clone`, `promote`, `demote`, `move`
- Relationships: `link`, `unlink`
- Metadata: `assign`, `note`
- Import/Export: `import`, `export`

### Workflow Operations (Business Logic)
- Workflow: `start`, `pause`, `resume`, `complete`, `block`, `unblock`
- Git: `branch`, `commit`, `track`
- Session: `status`

### Query Operations (Read-Only)
- Discovery: `search`, `find`, `tree`, `ready`
- Context: `summary`, `context`
- Team: `team`

### Intelligent Operations (AI-Powered)
- Analysis: `analyze`, `ask`
- Implementation: `implement`

### Administrative Operations
- System: `init`, `config`, `rules`, `admin`

---

## Global Options

All commands support these global options:

- `--help` - Show command help
- `--version` - Show TaskWerk version
- `--config <file>` - Use specific config file
- `--database <file>` - Use specific database file
- `--verbose` - Enable verbose output
- `--quiet` - Suppress non-essential output
- `--no-color` - Disable colored output
- `--format <format>` - Override default output format

---

This reference serves as the complete specification for TaskWerk v3 CLI implementation and will guide test case development and API design.