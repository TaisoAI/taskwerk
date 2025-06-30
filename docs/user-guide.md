# TaskWerk v2.0 User Guide

A comprehensive guide to using TaskWerk's enhanced YAML frontmatter task management system.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Task Format](#task-format)
3. [Basic Task Management](#basic-task-management)
4. [Enhanced Features](#enhanced-features)
5. [Team Collaboration](#team-collaboration)
6. [Git Integration](#git-integration)
7. [Configuration](#configuration)
8. [Workflows & Patterns](#workflows--patterns)
9. [Migration & Compatibility](#migration--compatibility)
10. [Troubleshooting](#troubleshooting)

## Getting Started

### Installation & Setup

```bash
# No installation required - use with npx
npx taskwerk init

# Or install globally
npm install -g taskwerk
taskwerk --help

# Initialize in your project
taskwerk init
```

### Your First Task

```bash
# Add a task with rich metadata
taskwerk add "Fix authentication timeout" \
  --priority high \
  --category bugs \
  --assignee @john \
  --estimated 2h

# Start working on it
taskwerk start TASK-001

# Complete when done
taskwerk complete TASK-001 --note "Increased timeout from 2min to 30min"
```

## Task Format

TaskWerk v2.0 uses YAML frontmatter for structured metadata with markdown content for rich descriptions:

```markdown
---
id: TASK-001
description: Fix authentication timeout on mobile Safari
status: in_progress
priority: high
category: bugs
assignee: @john
estimated: 2h
created: 2025-06-30T10:00:00.000Z
updated: 2025-06-30T14:30:00.000Z
dependencies: []
subtasks:
  - id: TASK-001.1
    description: Reproduce the issue
    status: completed
    assignee: @john
  - id: TASK-001.2
    description: Implement fix
    status: in_progress
    assignee: @john
timeline:
  - timestamp: 2025-06-30T10:00:00.000Z
    action: created
    user: @john
  - timestamp: 2025-06-30T10:15:00.000Z
    action: started
    user: @john
    note: Beginning investigation
---

# Fix authentication timeout on mobile Safari

## Problem Description
Users on mobile Safari experience session timeouts after 15 minutes of inactivity.

## Acceptance Criteria
- [ ] Session persists for full 30-minute timeout
- [ ] Works in Safari background tab mode
- [ ] No impact on other browsers
```

### Task States

- `todo` - Ready to start
- `in_progress` - Currently being worked on  
- `blocked` - Waiting for dependencies or external factors
- `completed` - Successfully finished
- `archived` - Cancelled or no longer relevant

### Metadata Fields

- **id**: Auto-generated unique identifier (TASK-001, TASK-002, etc.)
- **description**: Brief, descriptive title
- **status**: Current task state
- **priority**: high | medium | low
- **category**: Organizing tag (bugs, features, docs, etc.)
- **assignee**: Responsible person (@username format)
- **estimated**: Time estimate (2h, 1d, 1w format)
- **dependencies**: Array of task IDs this task depends on
- **subtasks**: Array of smaller tasks within this task
- **timeline**: Complete history of all task actions

## Basic Task Management

### Adding Tasks

```bash
# Simple task
taskwerk add "Update documentation"

# Task with metadata
taskwerk add "Implement user dashboard" \
  --priority medium \
  --category features \
  --assignee @alice \
  --estimated 4h

# Task with category shorthand
taskwerk add "Fix memory leak" --category bugs --priority high
```

### Working with Tasks

```bash
# View tasks
taskwerk list                    # All active tasks
taskwerk list --priority high   # Filter by priority
taskwerk list --assignee @alice # Filter by assignee
taskwerk list --category bugs   # Filter by category

# Start working
taskwerk start TASK-001          # Validates dependencies first
taskwerk start TASK-001 --note "Beginning investigation"

# Pause work temporarily
taskwerk pause TASK-001 --note "Need to wait for code review"

# Complete tasks
taskwerk complete TASK-001 --note "Fixed session timeout logic"
```

### Task Information

```bash
# Get detailed task info
taskwerk context TASK-001        # Complete details & dependency tree
taskwerk timeline TASK-001       # Full history of task changes
taskwerk search "authentication" # Search across all task fields
```

## Enhanced Features

### Dependencies

Tasks can depend on other tasks being completed first:

```bash
# Create dependent tasks
taskwerk add "Set up authentication system" --assignee @alice
taskwerk add "Build user dashboard" --assignee @bob

# Add dependency (dashboard depends on auth)
taskwerk add-dependency TASK-002 TASK-001

# View ready tasks (no blocking dependencies)
taskwerk ready-tasks

# See dependency hierarchy
taskwerk dependency-tree TASK-002
```

**Dependency Workflow:**
1. Dependencies are validated when starting tasks
2. Tasks with incomplete dependencies cannot be started
3. Use `ready-tasks` to see what can be worked on
4. Circular dependencies are automatically detected and prevented

### Subtasks

Break complex work into manageable pieces:

```bash
# Add subtasks to existing task
taskwerk add-subtask TASK-001 "Write unit tests" --assignee @john
taskwerk add-subtask TASK-001 "Update documentation" --assignee @alice

# View subtasks
taskwerk list-subtasks TASK-001

# Update subtask status
taskwerk update-subtask TASK-001 TASK-001.1 --status completed

# Parent task completion automatically completes remaining subtasks
taskwerk complete TASK-001
```

### Blocking & Unblocking

Handle external dependencies and blockers:

```bash
# Block a task with reason
taskwerk block TASK-001 --reason "Waiting for API documentation from backend team"

# View blocked tasks
taskwerk list --status blocked

# Unblock when ready
taskwerk unblock TASK-001 --note "API docs received, proceeding"

# Timeline tracks all blocking/unblocking events
taskwerk timeline TASK-001
```

### Timeline Tracking

Every task action is automatically tracked:

```bash
# View complete task timeline
taskwerk timeline TASK-001

# Timeline includes:
# - Task creation
# - Status changes (start, pause, block, unblock, complete)
# - Subtask additions/completions
# - Dependency changes
# - User notes and context
```

## Team Collaboration

### Assignee System

Track responsibility with @username format:

```bash
# Assign during creation
taskwerk add "Fix responsive layout" --assignee @alice

# Filter by assignee
taskwerk list --assignee @alice
taskwerk list --assignee @me     # Special alias for yourself

# View team workload
taskwerk stats                   # Shows assignee distribution
```

### Categories & Organization

```bash
# Use consistent categories
taskwerk add "Fix login bug" --category bugs
taskwerk add "Add dark mode" --category features
taskwerk add "Update README" --category docs
taskwerk add "Optimize queries" --category performance

# Filter by category
taskwerk list --category bugs
taskwerk search "performance"    # Search includes categories
```

### Shared Task Files

Tasks are stored in plain text files that work perfectly with Git:

```bash
# Team workflow
git pull                         # Get latest tasks
taskwerk list --priority high   # See what needs attention
taskwerk start TASK-007          # Claim a task
# ... do your work ...
taskwerk complete TASK-007 --note "Implemented with Redis caching"
git add tasks/
git commit -m "Complete TASK-007: Add caching layer"
git push                         # Share completed work
```

## Git Integration

### Intelligent Commit Messages

TaskWerk generates commit messages from completed tasks:

```bash
# Safe workflow
git add src/auth.js tests/auth.test.js    # 1. Stage files manually
taskwerk commit                           # 2. Preview message
taskwerk commit --auto                    # 3. Actually commit
```

**Generated commit format:**
```
fix: Complete TASK-001 - Fix authentication timeout

Tasks completed since last commit:
- TASK-001: Fix authentication timeout on mobile Safari

Implementation details:
- Increased session timeout from 2min to 30min
- Added keepalive mechanism for mobile browsers
- Enhanced error handling for network interruptions

Files modified:
- src/auth/session-manager.js
- src/auth/middleware.js
- tests/auth/session.test.js

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>
```

### Branch Management

```bash
# Create feature branch for task
taskwerk branch TASK-001         # Creates: feature/task-001-fix-auth-timeout

# Work on the task
taskwerk start TASK-001
# ... implement fix ...
git add src/
taskwerk commit --auto

# Complete and merge
taskwerk complete TASK-001
git checkout main
git merge feature/task-001-fix-auth-timeout
```

## Configuration

Create `.taskrc.json` in your project root:

```json
{
  "defaultPriority": "medium",
  "defaultAssignee": "@me",
  "autoCreateBranch": true,
  "validateDependencies": true,
  "timelineTracking": true,
  "categories": {
    "bugs": "Bug Fixes",
    "features": "Features",
    "docs": "Documentation",
    "refactor": "Code Refactoring",
    "tests": "Testing",
    "performance": "Performance"
  },
  "estimateFormats": ["30m", "1h", "2h", "4h", "1d", "2d", "1w"],
  "workflowRules": {
    "requireEstimateForHighPriority": true,
    "autoCompleteSubtasks": true,
    "enforceAssigneeFormat": true,
    "requireReasonForBlocking": true,
    "requireReasonForArchiving": true
  }
}
```

### Configuration Options

- **defaultPriority**: Default priority for new tasks
- **defaultAssignee**: Default assignee (@username or @me)
- **validateDependencies**: Check dependencies before starting tasks
- **timelineTracking**: Enable detailed action tracking
- **categories**: Predefined categories for consistency
- **estimateFormats**: Valid time estimate formats
- **workflowRules**: Enforce team standards and workflows

## Workflows & Patterns

### Feature Development with Dependencies

```bash
# Plan a complex feature
taskwerk add "Design user onboarding flow" --priority high --assignee @designer
taskwerk add "Implement onboarding API" --priority high --assignee @backend
taskwerk add "Build onboarding UI" --priority medium --assignee @frontend

# Set up dependencies
taskwerk add-dependency TASK-002 TASK-001  # API depends on design
taskwerk add-dependency TASK-003 TASK-002  # UI depends on API

# Work through dependencies
taskwerk ready-tasks                        # Shows only TASK-001
taskwerk start TASK-001                     # Designer starts
taskwerk complete TASK-001                  # Design complete

taskwerk ready-tasks                        # Shows TASK-002 is now ready
taskwerk start TASK-002                     # Backend starts
# ... and so on
```

### Complex Task with Subtasks

```bash
# Large task broken down
taskwerk add "Migrate user authentication to OAuth2" \
  --priority high \
  --assignee @john \
  --estimated 1w

# Break into subtasks
taskwerk add-subtask TASK-001 "Research OAuth2 providers" --assignee @john
taskwerk add-subtask TASK-001 "Set up OAuth2 configuration" --assignee @john
taskwerk add-subtask TASK-001 "Update login UI" --assignee @alice
taskwerk add-subtask TASK-001 "Migrate existing users" --assignee @bob
taskwerk add-subtask TASK-001 "Update documentation" --assignee @alice

# Work through subtasks
taskwerk list-subtasks TASK-001
taskwerk update-subtask TASK-001 TASK-001.1 --status completed
taskwerk update-subtask TASK-001 TASK-001.2 --status in_progress

# Complete parent task (auto-completes remaining subtasks)
taskwerk complete TASK-001 --note "OAuth2 migration complete, all tests passing"
```

### Handling External Dependencies

```bash
# Task blocked by external factor
taskwerk start TASK-005
taskwerk block TASK-005 --reason "Waiting for third-party API key approval"

# Later when unblocked
taskwerk unblock TASK-005 --note "API key received, proceeding with integration"
taskwerk complete TASK-005
```

### Daily Team Standup

```bash
# Prepare for standup
taskwerk list --assignee @me --status in_progress  # What I'm working on
taskwerk list --assignee @me --status blocked      # What's blocking me
taskwerk recent --limit 3                          # What I completed recently
taskwerk stats                                     # Team progress overview
```

## Migration & Compatibility

### Automatic Migration

TaskWerk v2.0 automatically migrates older task formats:

- **v1 Format**: Simple markdown task lists are converted to YAML frontmatter
- **Legacy Files**: Existing `tasks.md` files are upgraded on first use
- **Backward Compatibility**: Old formats remain readable during transition

### Manual Migration

```bash
# Force migration of specific files
taskwerk migrate

# Check if migration is needed
taskwerk list    # Will show migration status if needed
```

### Migration Process

1. **Detection**: TaskWerk detects v1 format files automatically
2. **Conversion**: Tasks are converted to v2.0 YAML frontmatter format
3. **Validation**: New format is validated against v2.0 schema
4. **Backup**: Original files are preserved as `.backup` files

## Troubleshooting

### Common Issues

**"Task validation failed"**
```bash
# Check task format
taskwerk context TASK-001       # View task details
# Fix: Ensure assignee uses @username format, valid priority/status
```

**"Circular dependency detected"**
```bash
# View dependency tree
taskwerk dependency-tree TASK-001
# Fix: Remove circular dependency with remove-dependency
```

**"Cannot start task - dependencies not completed"**
```bash
# Check dependencies
taskwerk dependency-tree TASK-001
taskwerk ready-tasks            # See what can be started
# Fix: Complete dependencies first, or remove them
```

**"YAML parsing error"**
```bash
# Check task file format
cat tasks/tasks.md              # Look for YAML syntax errors
# Fix: Ensure proper YAML frontmatter formatting
```

### Getting Help

```bash
taskwerk --help                 # General help
taskwerk <command> --help       # Command-specific help
taskwerk about                  # Version and system info
taskwerk context TASK-001       # Detailed task information
taskwerk timeline TASK-001      # Task history for debugging
```

### Debug Mode

```bash
# Enable verbose output
DEBUG=taskwerk* taskwerk <command>

# Check configuration
taskwerk rules --status
cat .taskrc.json
```

## Best Practices

### Task Creation
- **Be specific**: "Fix login timeout on mobile Safari" vs "Fix login bug"
- **Use consistent categories**: Agree on category names with your team
- **Assign responsibility**: Always specify assignee for team projects
- **Estimate effort**: Include time estimates for planning

### Dependencies
- **Keep simple**: Avoid deep dependency chains when possible
- **Document reasons**: Use task descriptions to explain why dependencies exist
- **Review regularly**: Use `dependency-tree` to visualize complex relationships

### Team Collaboration
- **Sync frequently**: Pull/push task changes regularly
- **Communicate blocks**: Use blocking with clear reasons
- **Review together**: Use `stats` and `recent` for team progress reviews
- **Maintain categories**: Keep category usage consistent across the team

### Git Integration
- **Stage first**: Always stage files before using `taskwerk commit`
- **Preview commits**: Use `taskwerk commit` (without --auto) to review first
- **Meaningful notes**: Include detailed completion notes for better commit messages

### Timeline Management
- **Track decisions**: Use notes in start/pause/block actions to capture context
- **Review history**: Use `timeline` to understand task evolution
- **Learn patterns**: Review completed task timelines to improve estimation

---

*For command reference and additional examples, see the main [README.md](../README.md)*