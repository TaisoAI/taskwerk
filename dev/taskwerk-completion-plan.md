# Taskwerk Completion Plan

**Version**: 0.6.x series completion
**Focus**: Core task management and markdown interoperability
**Approach**: Fix existing features, add search/split, then import/export

## Task Sequence Summary
- **TASK-001 to TASK-009**: ✅ Already completed (infrastructure, API, basic commands)
- **TASK-010 to TASK-011**: Fix existing features (tags, notes)
- **TASK-012**: Add search functionality
- **TASK-013**: Add split command
- **TASK-014 to TASK-016**: Import/Export functionality
- **TASK-017**: Testing & documentation
- **TASK-018 to TASK-022**: AI mode commands

## Phase 1: Fix Existing Features

### TASK-010: Fix Tag Filtering in List Command
- Make `task list --tags <tags...>` actually filter by tags
- Update `listTasks()` to handle tag filtering
- Add JOIN with task_tags table when tags filter is present
- Test with multiple tags
- **Estimated Time**: 1-2 hours

### TASK-011: Display Notes in Task Show
- Add `getTaskNotes()` method to TaskwerkAPI
- Retrieve notes from task_notes table ordered by created_at
- Display notes section in `task show` after timeline
- Show note content, author, and timestamp
- **Estimated Time**: 1-2 hours

## Phase 2: Search Functionality

### TASK-012: Implement Search Command
- Add `--search <term>` option to `task list` command
- Use existing `searchTasks()` API method when search term present
- Support combining search with other filters (status, priority, etc.)
- Show search term in output header
- Test with various search queries
- **Estimated Time**: 2-3 hours

## Phase 3: Task Split Command

### TASK-013: Implement Task Split
- Create new `task split <id>` command
- Interactive prompts for:
  - How many subtasks to create
  - Names for each subtask
  - Optional: divide estimate across subtasks
- Auto-set parent_id on new tasks
- Copy tags from parent to children
- Update parent status to "in-progress" if it was "todo"
- Show created subtasks summary
- **Estimated Time**: 3-4 hours

## Phase 4: Import/Export (Markdown Interoperability)

### TASK-014: Markdown Export
- Implement `taskwerk export` command
- Options:
  - `--format <format>` - markdown (default), json, csv
  - `--output <file>` - output filename (default: stdout)
  - `--status <status>` - filter by status
  - `--all` - include completed/cancelled tasks
- Markdown format:
  ```markdown
  # Tasks Export - 2024-07-12

  ## TASK-001: Task Name
  - Status: todo
  - Priority: high
  - Assignee: john
  - Tags: backend, urgent
  - Created: 2024-07-12 10:00
  
  Task description goes here...
  
  ### Notes
  - [2024-07-12 14:00] @jane: This needs review
  - [2024-07-12 15:00] @john: Updated requirements
  ```
- Include metadata as YAML frontmatter option
- **Estimated Time**: 3-4 hours

### TASK-015: Markdown Import
- Implement `taskwerk import <file>` command
- Options:
  - `--format <format>` - markdown (default), json, csv
  - `--update` - update existing tasks by ID
  - `--prefix <prefix>` - add prefix to imported task IDs
- Parse markdown format:
  - Headers as task names
  - Lists as task metadata
  - Support YAML frontmatter
  - Detect task IDs in headers
- Handle conflicts:
  - Skip existing IDs unless --update
  - Generate new IDs if needed
  - Report import summary
- **Estimated Time**: 4-5 hours

### TASK-016: JSON Import/Export
- Add JSON format support to export command
- Export full task data including all fields
- Import JSON with validation
- Support bulk operations
- Handle relationships (parent_id, dependencies)
- **Estimated Time**: 2-3 hours

## Phase 5: Testing & Polish

### TASK-017: Comprehensive Testing
- Add tests for all new functionality
- Test import/export round trips
- Test edge cases (empty files, malformed data)
- Update documentation
- **Estimated Time**: 2-3 hours

## Implementation Notes

### Tag Filtering Fix (TASK-010)
The infrastructure exists, just need to:
1. Parse the tags option in list command
2. Add tag filter to queryOptions
3. Modify `listTasks()` to JOIN with task_tags when tags specified

### Notes Display (TASK-011)
The `task_notes` table exists and notes can be added via `update --note`, but:
1. No API method to retrieve notes
2. `task show` doesn't display them
3. Need to maintain chronological order

### Search Implementation (TASK-012)
The `searchTasks()` method is fully implemented and tested. Just need to:
1. Add command option
2. Call searchTasks instead of listTasks when search term present
3. Maintain compatibility with other filters

### Split Command (TASK-013)
New functionality to break down large tasks:
1. Interactive or command-line driven
2. Maintains parent-child relationships
3. Useful for task decomposition

### Import/Export Philosophy
- Markdown as primary format (human-readable, git-friendly)
- Preserves original vision of markdown-based task management
- Enables backup, sharing, and migration
- Round-trip capable (export → edit → import)

## Success Criteria
- All task management commands work intuitively
- Can export entire task database to markdown
- Can import markdown files to create/update tasks  
- Tests pass, documentation updated
- Ready for AI mode implementation

## Phase 6: AI Mode Commands

### TASK-018: Implement AI Ask Command
- Create `taskwerk ai ask <question>` command
- Context-aware queries about tasks and project state
- Integration with AI provider (configurable)
- Options:
  - `--context <task-id>` - Ask about specific task
  - `--format <format>` - Response format (text, json)
- Return structured responses
- **Estimated Time**: 4-5 hours

### TASK-019: Implement AI Agent Mode
- Create `taskwerk ai agent` command
- Long-running agent mode for task automation
- Capabilities:
  - Task creation and updates
  - Status management
  - Dependency analysis
  - Progress tracking
- Safety controls and confirmation prompts
- **Estimated Time**: 6-8 hours

### TASK-020: AI Configuration Command
- Create `taskwerk ai config` command
- Manage AI provider settings
- Options:
  - API keys management (secure storage)
  - Model selection
  - Temperature and other parameters
  - Rate limiting settings
- Integration with main config system
- **Estimated Time**: 3-4 hours

### TASK-021: AI Raw Command Interface
- Create `taskwerk ai raw` command
- Direct AI interaction with raw prompts
- Options:
  - `--system <prompt>` - System prompt override
  - `--stream` - Stream responses
  - `--max-tokens <n>` - Token limits
- Useful for debugging and advanced usage
- **Estimated Time**: 2-3 hours

### TASK-022: AI Mode Integration & Testing
- Integration tests for all AI commands
- Documentation for AI features
- Example workflows and best practices
- Error handling for API failures
- **Estimated Time**: 3-4 hours

## Estimated Total Time
- Phase 1: 2-4 hours
- Phase 2: 2-3 hours  
- Phase 3: 3-4 hours
- Phase 4: 9-11 hours
- Phase 5: 2-3 hours
- Phase 6: 18-24 hours
- **Total: 36-49 hours**