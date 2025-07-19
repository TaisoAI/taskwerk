# AI Agent Task Management Design

## Overview

A specialized workflow for AI agents to efficiently work through assigned tasks, with built-in status tracking and progress reporting. This feature creates focused work lists that agents can parse, execute, and update systematically.

## Goals

1. **Structured Workflow**: Provide agents with clear, actionable task lists
2. **Automatic Status Updates**: Include pre-written commands for status transitions
3. **Progress Tracking**: Monitor agent progress through tasks
4. **Context Preservation**: Maintain task context and dependencies
5. **Failure Recovery**: Handle errors and resume from last state

## Command Interface

### Export Agent Work List
```bash
# Export current agent tasks
twrk agent-work --assignee @ai-agent

# With filters
twrk agent-work --assignee @ai-agent --status todo,in-progress --priority high

# Custom output
twrk agent-work --assignee @ai-agent --output work.md --format detailed

# Include dependencies
twrk agent-work --assignee @ai-agent --include-deps
```

### Command Options
- `--assignee <name>`: Agent to create work for (required)
- `--status <status>`: Filter by status (default: todo,in-progress)
- `--priority <priority>`: Filter by priority
- `--limit <n>`: Limit number of tasks
- `--output <file>`: Output file (default: agent-work.md)
- `--format <format>`: Output format (simple|detailed|structured)
- `--include-deps`: Include dependency information
- `--include-blocked`: Include blocked tasks with resolution hints
- `--session <id>`: Resume previous session

## Work List Formats

### 1. Simple Format (Default)
```markdown
# Agent Work List
Generated: 2024-01-20 10:30:00
Agent: @ai-agent
Tasks: 5

## TASK-001: Implement user authentication
Status: todo
```bash
twrk start TASK-001  # Run when starting
twrk done TASK-001   # Run when complete
```

Add JWT authentication to the FastAPI endpoints. Create login and logout routes with proper session management.

---

## TASK-002: Create database models
Status: todo
Depends on: TASK-001
```bash
twrk start TASK-002
twrk done TASK-002
```

Design and implement SQLAlchemy models for users, sessions, and permissions.
```

### 2. Detailed Format
```markdown
# Agent Work List
Generated: 2024-01-20 10:30:00
Agent: @ai-agent
Session: AWL-20240120-103000

## Summary
- Total Tasks: 5
- Todo: 3
- In Progress: 1
- Blocked: 1

## Task Execution Order
Based on dependencies and priorities:
1. TASK-003 (in-progress) - Continue current work
2. TASK-001 (todo) - High priority
3. TASK-002 (todo) - Depends on TASK-001
4. TASK-004 (todo) - Low priority
5. TASK-005 (blocked) - Waiting on TASK-003

## Tasks

### 🔄 TASK-003: Refactor API endpoints
**Status**: in-progress
**Priority**: high
**Category**: refactor
**Tags**: #api #backend
**Started**: 2024-01-20 09:15:00

#### Progress Check
```bash
# Update progress (current: 60%)
twrk updatetask TASK-003 --progress 80
```

#### Context
You were working on refactoring the user endpoints. Last commit: "Refactored user creation endpoint"

#### Subtasks
- [x] Refactor user creation
- [x] Refactor user update  
- [ ] Refactor user deletion
- [ ] Update tests

#### Next Steps
1. Complete user deletion endpoint refactoring
2. Update all related tests
3. Run test suite

#### Completion
```bash
twrk done TASK-003
twrk updatetask TASK-003 --note "Refactoring complete, all tests passing"
```

---

### 📋 TASK-001: Implement user authentication
**Status**: todo
**Priority**: high
**Category**: feature
**Tags**: #auth #security
**Estimated**: 4 hours

#### Pre-requisites
- [ ] FastAPI project structure exists
- [ ] Database connection configured
- [ ] Dependencies installed

#### Implementation Steps
1. Create auth module structure
2. Implement password hashing
3. Create JWT token generation
4. Build login endpoint
5. Build logout endpoint
6. Add authentication middleware
7. Create protected route decorator
8. Write comprehensive tests

#### Commands
```bash
# Start work
twrk start TASK-001
git checkout -b feature/user-authentication

# Regular progress updates
twrk updatetask TASK-001 --progress 25 --note "Created auth module structure"
twrk updatetask TASK-001 --progress 50 --note "Implemented JWT generation"
twrk updatetask TASK-001 --progress 75 --note "Endpoints complete, writing tests"

# Add discoveries
twrk updatetask TASK-001 --add-tag security-review
twrk splittask TASK-001 "Add refresh token support"

# Completion
twrk done TASK-001
git add -A
git commit -m "feat: implement user authentication (TASK-001)"
```

#### Resources
- [FastAPI Security Docs](https://fastapi.tiangolo.com/tutorial/security/)
- Project auth requirements: `/docs/auth-spec.md`
- Previous implementation: `git:feature/old-auth`

---

### 🚫 TASK-005: Deploy to staging
**Status**: blocked
**Blocked by**: TASK-003
**Priority**: medium

#### Blocker Resolution
This task is waiting for TASK-003 to be completed. Estimated unblock time: 2 hours.

#### Pre-work Available
While blocked, you can:
1. Review deployment checklist
2. Prepare environment variables
3. Draft deployment documentation

```bash
# Check blocker status
twrk showtask TASK-003

# When unblocked
twrk start TASK-005
```
```

### 3. Structured Format (JSON)
```json
{
  "session": "AWL-20240120-103000",
  "agent": "@ai-agent",
  "generated": "2024-01-20T10:30:00Z",
  "summary": {
    "total": 5,
    "todo": 3,
    "in_progress": 1,
    "blocked": 1
  },
  "tasks": [
    {
      "id": "TASK-001",
      "name": "Implement user authentication",
      "status": "todo",
      "priority": "high",
      "commands": {
        "start": "twrk start TASK-001",
        "progress": "twrk updatetask TASK-001 --progress ${percent}",
        "complete": "twrk done TASK-001"
      },
      "context": {
        "description": "Add JWT authentication...",
        "steps": ["Create auth module", "..."],
        "estimated_hours": 4,
        "dependencies": []
      }
    }
  ]
}
```

## Session Management

### Work Sessions
Allow agents to track work across multiple runs:

```bash
# Start a new session
twrk agent-work --assignee @ai-agent --new-session

# Resume previous session
twrk agent-work --assignee @ai-agent --session AWL-20240120-103000

# Show session status
twrk agent-session --show AWL-20240120-103000

# Session provides:
# - Task completion history
# - Time tracking
# - Error recovery points
# - Context preservation
```

### Session File Format
```yaml
# .taskwerk/sessions/AWL-20240120-103000.yaml
id: AWL-20240120-103000
agent: "@ai-agent"
created: 2024-01-20T10:30:00Z
last_updated: 2024-01-20T11:45:00Z

tasks_assigned: [TASK-001, TASK-002, TASK-003, TASK-004, TASK-005]
tasks_completed: [TASK-003]
tasks_in_progress: [TASK-001]

activity_log:
  - timestamp: 2024-01-20T10:31:00Z
    action: started
    task: TASK-003
    
  - timestamp: 2024-01-20T11:45:00Z  
    action: completed
    task: TASK-003
    note: "All tests passing"

context:
  last_command: "twrk done TASK-003"
  working_directory: "/project"
  git_branch: "feature/refactor-api"
```

## Integration Features

### 1. Progress Monitoring
```bash
# Real-time progress dashboard
twrk agent-monitor @ai-agent

# Shows:
# - Current task and progress
# - Completed tasks
# - Average time per task
# - Estimation for remaining work
```

### 2. Automatic Status Updates
Agents can use structured commands that update multiple things:

```bash
# Smart status update
twrk agent-progress TASK-001 --percent 50 --note "Login endpoint complete"

# This command:
# - Updates task progress
# - Adds a timeline note
# - Updates session log
# - Triggers any webhooks
```

### 3. Error Recovery
```bash
# If agent crashes/fails
twrk agent-recover @ai-agent

# This command:
# - Finds last session
# - Shows last known state
# - Suggests recovery actions
# - Can rollback if needed
```

## Agent Instructions Template

Each work list includes standard instructions:

```markdown
## Agent Instructions

### Working with this Task List

1. **Start Order**: Work through tasks in the order presented
2. **Status Updates**: Run status commands before and after each task
3. **Progress Tracking**: Update progress at 25%, 50%, 75%, and 100%
4. **Error Handling**: If a task fails, run `twrk updatetask TASK-XXX --status blocked --note "error details"`
5. **Context Notes**: Add notes for important decisions or discoveries
6. **Time Tracking**: Tasks include estimates - note if significantly over/under

### Best Practices

1. **Atomic Commits**: Commit after each meaningful change
2. **Test Continuously**: Run tests after each implementation step  
3. **Document Decisions**: Note why you made specific choices
4. **Ask When Stuck**: If blocked for >30 minutes, note the issue
5. **Clean As You Go**: Refactor and clean up along the way

### Available Commands Reference

- `twrk start <id>` - Begin working on a task
- `twrk updatetask <id> --progress <n>` - Update completion percentage
- `twrk updatetask <id> --note "<text>"` - Add a progress note
- `twrk done <id>` - Mark task as complete
- `twrk block <id>` - Mark task as blocked
- `twrk showtask <id>` - Get full task details
- `twrk agent-help` - Get help with agent commands
```

## Implementation Approach

### Phase 1: Basic Work List Export
1. Create `agent-work` command
2. Implement simple markdown format
3. Add basic filtering options

### Phase 2: Session Management
1. Design session tracking system
2. Implement session commands
3. Add recovery mechanisms

### Phase 3: Advanced Features
1. Structured output formats
2. Real-time monitoring
3. Integration with AI platforms
4. Performance analytics

## Benefits

1. **Predictable Workflow**: Agents know exactly what to do
2. **Reduced Errors**: Pre-written commands prevent mistakes
3. **Progress Visibility**: Real-time tracking of agent work
4. **Context Preservation**: No lost work between sessions
5. **Improved Efficiency**: Optimized task ordering
6. **Easy Integration**: Works with any LLM/agent system

## Future Enhancements

1. **Multi-Agent Coordination**: Distribute tasks among multiple agents
2. **Skill Matching**: Assign tasks based on agent capabilities
3. **Performance Learning**: Optimize based on agent performance
4. **Auto-Recovery**: Automatic retry and fallback mechanisms
5. **Template Library**: Pre-built workflows for common scenarios