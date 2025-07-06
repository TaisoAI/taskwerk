# Taskwerk v3 Implementation Tasks

## Active Tasks

---
id: TASK-001
description: Set up v3 project structure
status: completed
priority: high
category: infrastructure
assignee: @ai
estimated: 1h
created: 2025-01-06T01:00:00.000Z
updated: 2025-01-06T05:10:00.000Z
completed: 2025-01-06T05:10:00.000Z
dependencies: []
subtasks: []
---

# Set up v3 project structure

## Description
Create the foundational directory structure for Taskwerk v3 following the architecture defined in the implementation guide.

## Acceptance Criteria
- [x] Create src/ directory with proper subdirectories
- [x] Create tests/ directory mirroring src/ structure
- [x] Set up initial index files
- [x] Create .gitignore for node_modules and .taskwerk/

## Implementation Notes
- Created comprehensive directory structure for v3
- Set up initial index files with proper module exports
- Created constants file with all enums and state transitions
- Added placeholder services to be implemented in later tasks
- Created structure test to verify everything is in place

## Technical Notes
Follow the structure from v3-implementation-guide.md:
- src/storage/ - Database layer
- src/core/ - Business logic
- src/cli/ - Command interface
- src/ai/ - AI module (optional)

---
id: TASK-002
description: Implement SQLite database layer
status: todo
priority: high
category: core
assignee: @ai
estimated: 3h
created: 2025-01-06T01:00:00.000Z
updated: 2025-01-06T01:00:00.000Z
dependencies: [TASK-001]
subtasks:
  - id: TASK-002.1
    description: Create database connection module
    status: todo
  - id: TASK-002.2
    description: Implement schema from implementation guide
    status: todo
  - id: TASK-002.3
    description: Add migration system
    status: todo
---

# Implement SQLite database layer

## Description
Set up the SQLite database with schema from v3-implementation-guide.md, including all tables, indexes, and triggers.

## Acceptance Criteria
- [ ] Database initialization works
- [ ] All tables created with proper constraints
- [ ] Indexes for performance
- [ ] Update trigger for timestamps
- [ ] Migration system for future updates

## Technical Notes
Use better-sqlite3 which is already in dependencies. Schema is fully defined in the implementation guide.

---
id: TASK-003
description: Create core API layer
status: todo
priority: high
category: core
assignee: @ai
estimated: 4h
created: 2025-01-06T01:00:00.000Z
updated: 2025-01-06T01:00:00.000Z
dependencies: [TASK-002]
subtasks:
  - id: TASK-003.1
    description: Implement TaskwerkAPI class
    status: todo
  - id: TASK-003.2
    description: Create task service methods
    status: todo
  - id: TASK-003.3
    description: Implement note service (dual approach)
    status: todo
  - id: TASK-003.4
    description: Add ID generator (TASK-XXX format)
    status: todo
---

# Create core API layer

## Description
Implement the core API that all interfaces (CLI, future MCP) will use. This is the business logic layer.

## Acceptance Criteria
- [ ] TaskwerkAPI class with all CRUD methods
- [ ] Note management with dual approach (field + table)
- [ ] ID generation for TASK-XXX format
- [ ] Query service for complex filters
- [ ] Proper error handling with custom errors

## Technical Notes
Follow the API design from v3-implementation-guide.md. Ensure all methods return structured data, not formatted strings.

---
id: TASK-004
description: Implement CLI with subcommand structure
status: todo
priority: high
category: interface
assignee: @ai
estimated: 4h
created: 2025-01-06T01:00:00.000Z
updated: 2025-01-06T01:00:00.000Z
dependencies: [TASK-003]
subtasks:
  - id: TASK-004.1
    description: Set up commander.js with subcommands
    status: todo
  - id: TASK-004.2
    description: Implement 'init' command
    status: todo
  - id: TASK-004.3
    description: Implement 'task add' command
    status: todo
  - id: TASK-004.4
    description: Implement 'task list' command
    status: todo
  - id: TASK-004.5
    description: Implement 'task show' command
    status: todo
  - id: TASK-004.6
    description: Implement 'task update' command
    status: todo
---

# Implement CLI with subcommand structure

## Description
Create the CLI interface using commander.js with the new subcommand structure (task add, task list, etc).

## Acceptance Criteria
- [ ] Main CLI entry point works
- [ ] Subcommand structure implemented
- [ ] Basic task CRUD commands working
- [ ] Proper help text for all commands
- [ ] Error messages are user-friendly

## Technical Notes
Use commander.js (already in dependencies). Follow command structure from v3-cli-reference.md.

---
id: TASK-005
description: Add state transition logic
status: todo
priority: medium
category: core
assignee: @ai
estimated: 2h
created: 2025-01-06T01:00:00.000Z
updated: 2025-01-06T01:00:00.000Z
dependencies: [TASK-004]
subtasks: []
---

# Add state transition logic

## Description
Implement the state machine for task status transitions with validation.

## Acceptance Criteria
- [ ] Valid transitions enforced
- [ ] Invalid transitions return clear errors
- [ ] State change side effects implemented
- [ ] History tracking for state changes

## State Rules
```
todo → active, blocked, completed, archived
active → paused, blocked, completed
paused → active, blocked, completed
blocked → todo, active, completed
completed → archived
archived → (terminal state)
```

---
id: TASK-006
description: Implement notes system with YAML frontmatter
status: todo
priority: medium
category: core
assignee: @ai
estimated: 3h
created: 2025-01-06T01:00:00.000Z
updated: 2025-01-06T01:00:00.000Z
dependencies: [TASK-004]
subtasks:
  - id: TASK-006.1
    description: YAML frontmatter parser
    status: todo
  - id: TASK-006.2
    description: Note append logic
    status: todo
  - id: TASK-006.3
    description: Task notes table for events
    status: todo
---

# Implement notes system with YAML frontmatter

## Description
Create the dual-approach notes system: mutable notes field with YAML frontmatter + immutable task_notes table.

## Acceptance Criteria
- [ ] Notes append to task.notes field
- [ ] YAML frontmatter format working
- [ ] Significant events create task_notes entries
- [ ] Notes are parsed and displayed correctly

## Format Example
```markdown
---
created_at: 2024-01-15T10:00:00Z
author: john
type: progress
---
Found the bug in auth.js
```

---
id: TASK-007
description: Add import/export functionality
status: todo
priority: medium
category: features
assignee: @ai
estimated: 3h
created: 2025-01-06T01:00:00.000Z
updated: 2025-01-06T01:00:00.000Z
dependencies: [TASK-006]
subtasks:
  - id: TASK-007.1
    description: Markdown export format
    status: todo
  - id: TASK-007.2
    description: JSON export format
    status: todo
  - id: TASK-007.3
    description: Import parser for both formats
    status: todo
  - id: TASK-007.4
    description: Migration from v2 format
    status: todo
---

# Add import/export functionality

## Description
Implement data import/export in both markdown and JSON formats for backups and migration.

## Acceptance Criteria
- [ ] Export to markdown preserves all data
- [ ] Export to JSON is complete
- [ ] Import handles both formats
- [ ] V2 migration path works
- [ ] IDs preserved where possible

## Technical Notes
Formats are defined in v3-implementation-guide.md. Use yaml package for parsing.

---
id: TASK-008
description: Implement git integration
status: todo
priority: medium
category: features
assignee: @ai
estimated: 2h
created: 2025-01-06T01:00:00.000Z
updated: 2025-01-06T01:00:00.000Z
dependencies: [TASK-004]
subtasks:
  - id: TASK-008.1
    description: git branch command
    status: todo
  - id: TASK-008.2
    description: git commit with task context
    status: todo
---

# Implement git integration

## Description
Add git commands that integrate with task context for branch creation and commits.

## Acceptance Criteria
- [ ] Can create branches from task IDs
- [ ] Commit messages include task context
- [ ] Branch names follow pattern
- [ ] Git operations are safe

## Technical Notes
Can reuse some patterns from v2 git integration in archive.

---
id: TASK-009
description: Add comprehensive test suite
status: todo
priority: high
category: quality
assignee: @ai
estimated: 4h
created: 2025-01-06T01:00:00.000Z
updated: 2025-01-06T01:00:00.000Z
dependencies: [TASK-004]
subtasks:
  - id: TASK-009.1
    description: Unit tests for API layer
    status: todo
  - id: TASK-009.2
    description: Integration tests for CLI
    status: todo
  - id: TASK-009.3
    description: Test coverage > 80%
    status: todo
---

# Add comprehensive test suite

## Description
Create test suite for v3 implementation ensuring high quality and reliability.

## Acceptance Criteria
- [ ] Unit tests for all API methods
- [ ] Integration tests for CLI commands
- [ ] Test coverage > 80%
- [ ] All tests pass
- [ ] Tests are maintainable

## Technical Notes
Use Node.js built-in test runner. Follow test patterns from implementation guide.

---
id: TASK-010
description: Create AI module with three modes
status: todo
priority: low
category: features
assignee: @ai
estimated: 4h
created: 2025-01-06T01:00:00.000Z
updated: 2025-01-06T01:00:00.000Z
dependencies: [TASK-004]
subtasks:
  - id: TASK-010.1
    description: Ask mode (read-only)
    status: todo
  - id: TASK-010.2
    description: Agent mode (mutations)
    status: todo
  - id: TASK-010.3
    description: Raw mode (pipeline)
    status: todo
  - id: TASK-010.4
    description: Natural language detection
    status: todo
---

# Create AI module with three modes

## Description
Implement the optional AI module with ask, agent, and raw modes as designed.

## Acceptance Criteria
- [ ] Ask mode handles read-only queries
- [ ] Agent mode can modify tasks
- [ ] Raw mode works as text pipeline
- [ ] Natural language detection works
- [ ] AI config separate from core

## Technical Notes
This is optional module in src/ai/. Can be implemented after core is working.