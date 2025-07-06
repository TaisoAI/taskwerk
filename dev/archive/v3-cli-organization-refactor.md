DEPRECATED

# TaskWerk v3 CLI Command Organization Refactor

## Overview

### Why Refactor Command Organization?

The current TaskWerk CLI has grown to over 30 commands in a flat structure, which presents several challenges:

1. **Cognitive Overload**: Users must remember and navigate through 30+ top-level commands
2. **Discoverability**: Related functionality is scattered, making it hard to find commands
3. **Learning Curve**: New users struggle to understand which commands to use for common workflows
4. **Namespace Pollution**: Risk of running out of good command names at the root level
5. **Help System**: `taskwerk --help` output is overwhelming with all commands listed together
6. **Conceptual Clarity**: No clear mental model of how commands relate to each other

### Goals of Refactoring

1. **Logical Grouping**: Organize commands by functional area
2. **Progressive Disclosure**: Show core commands at root, advanced features in subcommands
3. **Improved Discoverability**: Users can explore related commands naturally
4. **Consistent Patterns**: Similar operations follow similar command structures
5. **Future Scalability**: Easy to add new commands in appropriate groups

### Design Principles

1. **Keep Core Task Operations at Root**: The most common task management operations remain easily accessible
2. **Group by Workflow**: Commands that work together in workflows should be grouped
3. **Minimize Nesting**: Maximum 2 levels deep (taskwerk -> group -> command)
4. **Preserve Muscle Memory**: Provide aliases for commonly used commands during transition

---

## Command Groups

### Root Level Commands (Core Task Management)

**Description**: Essential task CRUD operations that users perform most frequently. These remain at the root level for quick access and represent the core value proposition of TaskWerk.

**Commands**:
- add
- list
- get
- update
- complete
- archive
- start

### `workflow` - Task State Management

**Description**: Commands for managing task states and workflow transitions. These commands change the state of tasks through their lifecycle.

**Commands**:
- pause
- resume
- block
- unblock

### `deps` - Dependency Management

**Description**: Commands for managing and visualizing task dependencies. These help users understand task relationships and sequencing.

**Commands**:
- tree
- ready

### `git` - Git Integration

**Description**: Commands that integrate with Git workflows, enabling version control awareness and commit management.

**Commands**:
- branch
- commit
- stage
- sync

### `data` - Data Management

**Description**: Commands for importing, exporting, and querying task data. These enable data portability and advanced searching.

**Commands**:
- import
- export
- search
- stats
- recent

### `ai` - AI/LLM Integration

**Description**: Commands for AI-assisted task management and natural language interactions.

**Commands**:
- ask
- agent
- context

### `config` - Configuration Management

**Description**: Commands for managing TaskWerk configuration and settings.

**Commands**:
- config
- llmconfig
- rules

### `system` - System Commands

**Description**: System-level commands for initialization and information.

**Commands**:
- init
- about
- status

---

## Detailed Command Specifications

### Root Level Commands

#### `add`
- **Purpose**: Create a new task
- **Usage**: `taskwerk add "Task description" [options]`
- **Parameters**:
  - `description` (required): Task description
  - `--priority`: Set priority (high/medium/low)
  - `--assignee`: Assign to user
  - `--category`: Set category
  - `--due`: Set due date
  - `--estimate`: Set time estimate
  - `--parent`: Set parent task ID
  - `--depends-on`: Set dependencies
  - `--tags`: Add tags
- **Side Effects**: 
  - Creates new task in database
  - Updates task index
  - May trigger hooks
- **Destructive**: No

#### `list`
- **Purpose**: List tasks with filtering and sorting
- **Usage**: `taskwerk list [options]`
- **Parameters**:
  - `--status`: Filter by status
  - `--priority`: Filter by priority
  - `--assignee`: Filter by assignee
  - `--category`: Filter by category
  - `--parent`: Filter by parent task
  - `--limit`: Limit results
  - `--sort`: Sort field
  - `--reverse`: Reverse sort order
  - `--format`: Output format (table/json/yaml)
- **Side Effects**: None (read-only)
- **Destructive**: No

#### `get`
- **Purpose**: Display detailed information about a specific task
- **Usage**: `taskwerk get <task-id>`
- **Parameters**:
  - `task-id` (required): Task identifier
  - `--format`: Output format (detailed/json/yaml)
  - `--show-history`: Include task history
  - `--show-notes`: Include all notes
  - `--show-deps`: Include dependency tree
- **Side Effects**: None (read-only)
- **Destructive**: No

#### `update`
- **Purpose**: Update task properties
- **Usage**: `taskwerk update <task-id> [options]`
- **Parameters**:
  - `task-id` (required): Task identifier
  - `--name`: Update task name
  - `--priority`: Update priority
  - `--assignee`: Update assignee
  - `--category`: Update category
  - `--due`: Update due date
  - `--estimate`: Update time estimate
  - `--progress`: Update progress percentage
  - `--add-tag`: Add a tag
  - `--remove-tag`: Remove a tag
- **Side Effects**:
  - Updates task in database
  - Updates modified timestamp
  - May trigger workflow rules
- **Destructive**: No (but modifies data)

#### `complete`
- **Purpose**: Mark a task as completed
- **Usage**: `taskwerk complete <task-id> [options]`
- **Parameters**:
  - `task-id` (required): Task identifier
  - `--note`: Add completion note
  - `--actual`: Record actual time spent
  - `--force`: Complete even with incomplete subtasks
- **Side Effects**:
  - Changes task status to completed
  - Sets completion timestamp
  - May unblock dependent tasks
  - Updates progress to 100%
- **Destructive**: No (but changes state)

#### `archive`
- **Purpose**: Archive completed or cancelled tasks
- **Usage**: `taskwerk archive <task-id|--filter> [options]`
- **Parameters**:
  - `task-id`: Specific task to archive
  - `--completed`: Archive all completed tasks
  - `--before`: Archive tasks completed before date
  - `--dry-run`: Preview what would be archived
  - `--include-subtasks`: Archive subtasks too
- **Side Effects**:
  - Changes task status to archived
  - Task hidden from normal views
  - Frees up task ID namespace
- **Destructive**: Partially (hides tasks but preserves data)

#### `start`
- **Purpose**: Start working on a task
- **Usage**: `taskwerk start <task-id> [options]`
- **Parameters**:
  - `task-id` (required): Task identifier
  - `--note`: Add a start note
  - `--timer`: Start time tracking
  - `--force`: Start even if blocked
- **Side Effects**:
  - Changes task status to in_progress
  - Sets start timestamp
  - May pause other in-progress tasks
  - Starts session tracking
- **Destructive**: No

### `workflow` Commands

#### `workflow pause`
- **Purpose**: Pause an in-progress task
- **Usage**: `taskwerk workflow pause <task-id> [options]`
- **Parameters**:
  - `task-id` (required): Task identifier
  - `--reason`: Reason for pausing
  - `--expected-resume`: When expecting to resume
- **Side Effects**:
  - Changes task status to paused
  - Stops time tracking
  - Records pause timestamp
- **Destructive**: No

#### `workflow resume`
- **Purpose**: Resume a paused task
- **Usage**: `taskwerk workflow resume <task-id> [options]`
- **Parameters**:
  - `task-id` (required): Task identifier
  - `--note`: Add resume note
  - `--timer`: Restart time tracking
- **Side Effects**:
  - Changes task status to in_progress
  - Restarts time tracking if enabled
  - Records resume timestamp
- **Destructive**: No

#### `workflow block`
- **Purpose**: Mark a task as blocked
- **Usage**: `taskwerk workflow block <task-id> [options]`
- **Parameters**:
  - `task-id` (required): Task identifier
  - `--reason` (required): Blocking reason
  - `--blocked-by`: Reference to blocking issue/task
  - `--expected-resolution`: Expected resolution date
- **Side Effects**:
  - Changes task status to blocked
  - Records blocking reason
  - May notify assignee
- **Destructive**: No

#### `workflow unblock`
- **Purpose**: Remove blocked status from a task
- **Usage**: `taskwerk workflow unblock <task-id> [options]`
- **Parameters**:
  - `task-id` (required): Task identifier
  - `--note`: Resolution note
  - `--next-status`: Status after unblocking (todo/in_progress)
- **Side Effects**:
  - Changes task status from blocked
  - Records unblock timestamp
  - May trigger notifications
- **Destructive**: No

### `deps` Commands

#### `deps tree`
- **Purpose**: Visualize task dependency tree
- **Usage**: `taskwerk deps tree [task-id] [options]`
- **Parameters**:
  - `task-id`: Root task (optional, shows forest if omitted)
  - `--depth`: Maximum tree depth
  - `--show-completed`: Include completed tasks
  - `--critical-path`: Highlight critical path
  - `--format`: Output format (tree/dot/json)
  - `--direction`: Tree direction (down/up/both)
- **Side Effects**: None (read-only)
- **Destructive**: No

#### `deps ready`
- **Purpose**: Show tasks ready to start (no blockers)
- **Usage**: `taskwerk deps ready [options]`
- **Parameters**:
  - `--assignee`: Filter by assignee
  - `--category`: Filter by category
  - `--limit`: Maximum results
  - `--show-impact`: Show dependency impact
  - `--format`: Output format
- **Side Effects**: None (read-only)
- **Destructive**: No

### `git` Commands

#### `git branch`
- **Purpose**: Create feature branch for task
- **Usage**: `taskwerk git branch <task-id> [options]`
- **Parameters**:
  - `task-id` (required): Task identifier
  - `--prefix`: Branch prefix (default: feature/)
  - `--checkout`: Checkout after creation
  - `--from`: Base branch (default: current)
- **Side Effects**:
  - Creates Git branch
  - Updates task with branch info
  - May checkout new branch
- **Destructive**: No

#### `git commit`
- **Purpose**: Create commit with task context
- **Usage**: `taskwerk git commit <task-id> [options]`
- **Parameters**:
  - `task-id` (required): Task identifier
  - `--message`: Commit message
  - `--close`: Mark task complete after commit
  - `--push`: Push after commit
  - `--amend`: Amend previous commit
- **Side Effects**:
  - Creates Git commit
  - Updates task history
  - May complete task
  - May push to remote
- **Destructive**: No (but creates Git history)

#### `git stage`
- **Purpose**: Stage changes related to task
- **Usage**: `taskwerk git stage <task-id> [options]`
- **Parameters**:
  - `task-id` (required): Task identifier
  - `--pattern`: File pattern to stage
  - `--interactive`: Interactive staging
  - `--all`: Stage all changes
- **Side Effects**:
  - Stages files in Git
  - Records staging in task history
- **Destructive**: No

#### `git sync`
- **Purpose**: Sync task state with Git branches
- **Usage**: `taskwerk git sync [options]`
- **Parameters**:
  - `--task-id`: Specific task to sync
  - `--all`: Sync all tasks with branches
  - `--prune`: Remove tasks for deleted branches
  - `--dry-run`: Preview sync actions
- **Side Effects**:
  - Updates task states based on Git
  - May complete merged tasks
  - May archive tasks for deleted branches
- **Destructive**: Potentially (with --prune)

### `data` Commands

#### `data import`
- **Purpose**: Import tasks from external sources
- **Usage**: `taskwerk data import <file> [options]`
- **Parameters**:
  - `file` (required): Import file path
  - `--format`: File format (json/yaml/csv/markdown)
  - `--map`: Field mapping configuration
  - `--dry-run`: Preview import
  - `--merge`: Merge with existing tasks
  - `--parent`: Import under parent task
- **Side Effects**:
  - Creates new tasks
  - May update existing tasks (with --merge)
  - Updates task relationships
- **Destructive**: No (but adds data)

#### `data export`
- **Purpose**: Export tasks to various formats
- **Usage**: `taskwerk data export [options]`
- **Parameters**:
  - `--format`: Export format (json/yaml/csv/markdown)
  - `--output`: Output file path
  - `--filter`: Export filter criteria
  - `--include-archived`: Include archived tasks
  - `--include-completed`: Include completed tasks
  - `--template`: Export template
- **Side Effects**: 
  - Creates export file
  - No database changes
- **Destructive**: No

#### `data search`
- **Purpose**: Full-text search across tasks
- **Usage**: `taskwerk data search <query> [options]`
- **Parameters**:
  - `query` (required): Search query
  - `--fields`: Fields to search
  - `--status`: Filter by status
  - `--assignee`: Filter by assignee
  - `--limit`: Result limit
  - `--regex`: Use regex search
  - `--case-sensitive`: Case sensitive search
- **Side Effects**: None (read-only)
- **Destructive**: No

#### `data stats`
- **Purpose**: Show task statistics and analytics
- **Usage**: `taskwerk data stats [options]`
- **Parameters**:
  - `--period`: Time period (week/month/quarter/year)
  - `--group-by`: Grouping field
  - `--assignee`: Filter by assignee
  - `--category`: Filter by category
  - `--format`: Output format (table/json/chart)
- **Side Effects**: None (read-only)
- **Destructive**: No

#### `data recent`
- **Purpose**: Show recently modified tasks
- **Usage**: `taskwerk data recent [options]`
- **Parameters**:
  - `--limit`: Number of tasks (default: 10)
  - `--since`: Show tasks modified since
  - `--include-completed`: Include completed tasks
  - `--activity-type`: Filter by activity type
- **Side Effects**: None (read-only)
- **Destructive**: No

### `ai` Commands

#### `ai ask`
- **Purpose**: Natural language task queries
- **Usage**: `taskwerk ai ask <question> [options]`
- **Parameters**:
  - `question` (required): Natural language question
  - `--context`: Additional context
  - `--format`: Response format
  - `--model`: AI model to use
  - `--temperature`: Response creativity
- **Side Effects**: 
  - May query AI service
  - Logs AI interactions
- **Destructive**: No

#### `ai agent`
- **Purpose**: AI agent for task automation
- **Usage**: `taskwerk ai agent <command> [options]`
- **Parameters**:
  - `command` (required): Agent command
  - `--goal`: Agent goal description
  - `--constraints`: Agent constraints
  - `--auto-approve`: Auto-approve actions
  - `--dry-run`: Preview agent actions
- **Side Effects**:
  - May create/modify tasks
  - May execute workflows
  - Logs all agent actions
- **Destructive**: Potentially (with --auto-approve)

#### `ai context`
- **Purpose**: Manage AI context and memory
- **Usage**: `taskwerk ai context <action> [options]`
- **Parameters**:
  - `action` (required): show/add/clear/export
  - `--scope`: Context scope (global/project/task)
  - `--key`: Context key
  - `--value`: Context value
  - `--ttl`: Context time-to-live
- **Side Effects**:
  - Updates AI context store
  - May affect AI responses
- **Destructive**: Only with 'clear' action

### `config` Commands

#### `config`
- **Purpose**: Manage TaskWerk configuration
- **Usage**: `taskwerk config <action> [options]`
- **Parameters**:
  - `action` (required): get/set/list/reset
  - `--key`: Configuration key
  - `--value`: Configuration value
  - `--global`: Use global config
  - `--local`: Use local config
- **Side Effects**:
  - Updates configuration files
  - May affect all operations
- **Destructive**: Only with 'reset' action

#### `config llm`
- **Purpose**: Configure LLM/AI settings
- **Usage**: `taskwerk config llm <action> [options]`
- **Parameters**:
  - `action` (required): setup/test/list/remove
  - `--provider`: LLM provider
  - `--model`: Model name
  - `--api-key`: API key
  - `--endpoint`: API endpoint
  - `--default`: Set as default
- **Side Effects**:
  - Updates LLM configuration
  - May store API credentials
- **Destructive**: Only with 'remove' action

#### `config rules`
- **Purpose**: Manage workflow automation rules
- **Usage**: `taskwerk config rules <action> [options]`
- **Parameters**:
  - `action` (required): list/add/edit/remove/test
  - `--name`: Rule name
  - `--condition`: Rule condition
  - `--action`: Rule action
  - `--priority`: Rule priority
  - `--enabled`: Enable/disable rule
- **Side Effects**:
  - Updates automation rules
  - May trigger on future operations
- **Destructive**: Only with 'remove' action

### `system` Commands

#### `init`
- **Purpose**: Initialize TaskWerk in a directory
- **Usage**: `taskwerk init [options]`
- **Parameters**:
  - `--force`: Reinitialize if exists
  - `--import-from`: Import from another system
  - `--template`: Use initialization template
  - `--no-git`: Skip Git integration
- **Side Effects**:
  - Creates .taskwerk directory
  - Creates database
  - Creates config files
  - May create Git hooks
- **Destructive**: Only with --force

#### `about`
- **Purpose**: Show TaskWerk version and info
- **Usage**: `taskwerk about [options]`
- **Parameters**:
  - `--version`: Show version only
  - `--check-updates`: Check for updates
  - `--system`: Show system info
  - `--dependencies`: Show dependencies
- **Side Effects**: None (read-only)
- **Destructive**: No

#### `status`
- **Purpose**: Show current workspace status
- **Usage**: `taskwerk status [options]`
- **Parameters**:
  - `--detailed`: Show detailed status
  - `--health`: Run health checks
  - `--session`: Show session info
  - `--format`: Output format
- **Side Effects**: None (read-only)
- **Destructive**: No

---

## Migration Strategy

### Phase 1: Implement Structure (v3.1)
- Add command groups infrastructure
- Implement subcommand routing
- Keep all existing commands working at root level
- Add deprecation notices for commands that will move

### Phase 2: Dual Support (v3.2)
- Commands available in both locations
- Root level shows deprecation warnings
- Documentation updated to show new structure
- Migration guide published

### Phase 3: Transition (v3.3)
- Remove root level access for grouped commands
- Provide clear error messages with new locations
- Offer --migrate flag to update scripts
- 6-month transition period

### Phase 4: Cleanup (v4.0)
- Remove all deprecated code paths
- Finalize command structure
- Update all documentation

## Backwards Compatibility

### Alias Support
```bash
# Common aliases maintained permanently
taskwerk ls -> taskwerk list
taskwerk rm -> taskwerk archive
taskwerk done -> taskwerk complete

# Transition aliases (removed in v4.0)
taskwerk tree -> taskwerk deps tree
taskwerk import -> taskwerk data import
```

### Environment Variables
- `TASKWERK_COMMAND_COMPAT=v2` - Use v2 command structure
- `TASKWERK_DISABLE_DEPRECATION` - Suppress deprecation warnings

### Script Migration Tool
```bash
taskwerk migrate-scripts <directory>
# Automatically updates TaskWerk commands in shell scripts
```

---

## Open Questions

1. Should `start`, `pause`, `resume` remain at root or move to `workflow`?
2. Should we have a `task` prefix for core commands? (`task add`, `task list`)
3. How to handle command shortcuts? (`tw` instead of `taskwerk`)
4. Should `config` be a root command or under `system`?
5. Integration with shell completion for subcommands?

## Future Considerations

1. **Plugin System**: Third-party commands in namespaces
2. **Command Aliases**: User-defined command shortcuts
3. **Interactive Mode**: `taskwerk shell` for command prompt
4. **Batch Operations**: Multiple commands in one invocation
5. **Command Macros**: User-defined command sequences