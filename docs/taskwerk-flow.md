# TaskWerk v2.0 Workflow Guide

This guide shows you how to use TaskWerk v2.0 effectively with YAML frontmatter for different scenarios and team sizes.

> **📖 Complete Documentation**: For comprehensive documentation, see the [User Guide](user-guide.md) and [Developer Guide](developer-guide.md).

## Quick Reference

### Enhanced v2.0 Commands
```bash
taskwerk init                                    # Initialize in project
taskwerk add "Task description" --assignee @me  # Add task with metadata
taskwerk list --assignee @alice                 # Filter by assignee
taskwerk start TASK-001                          # Begin working (validates dependencies)
taskwerk complete TASK-001 --note "Details"     # Mark finished with timeline
taskwerk status                                 # Check current state & dependencies
```

### v2.0 Git Integration
```bash
taskwerk branch TASK-001         # Create feature branch
git add files                    # Stage your changes
taskwerk commit                  # Generate smart commit with task context
taskwerk commit --auto          # Actually commit with Co-Authored-By tags
```

### v2.0 Enhanced Features
```bash
# Dependencies & subtasks
taskwerk add-dependency TASK-002 TASK-001   # TASK-002 depends on TASK-001
taskwerk add-subtask TASK-001 "Unit tests"  # Add subtask
taskwerk ready-tasks                         # Show tasks ready to work on

# Blocking & timeline
taskwerk block TASK-001 --reason "Waiting for API docs"
taskwerk unblock TASK-001 --note "Docs received"
taskwerk timeline TASK-001                  # View complete task history
```

## Core Workflow Patterns

### Solo Development with v2.0

**Enhanced daily routine:**
```bash
# Morning: check what to work on with enhanced filtering
taskwerk list --priority high --assignee @me
taskwerk ready-tasks                         # See what has no blocking dependencies
taskwerk start TASK-003

# During work: track progress with timeline
taskwerk status                              # Shows dependencies & session info
taskwerk timeline TASK-003                  # Review task history if needed

# When done: complete with rich metadata
taskwerk complete TASK-003 --note "Fixed memory leak in user service, reduced heap usage by 40%"
git add src/
taskwerk commit --auto                       # Intelligent commit with task context
```

### Team Collaboration with v2.0

**Enhanced shared task management:**
```bash
# Get latest team tasks
git pull

# See what needs attention with assignee filtering
taskwerk list --priority high --assignee @me    # My high priority tasks
taskwerk list --priority high                   # All high priority tasks
taskwerk ready-tasks                             # Tasks ready to work on (no dependencies)

# Claim and assign a task
taskwerk start TASK-007

# Work with subtasks and dependencies
taskwerk add-subtask TASK-007 "Write integration tests" --assignee @alice
taskwerk complete TASK-007 --note "Implemented with Redis caching, includes rate limiting"

# Share with team including timeline history
git add .
taskwerk commit --auto                           # Smart commit with task metadata
git push
```

### Feature Development

**End-to-end feature workflow:**
```bash
# Plan the feature
taskwerk add "Add user profile page" --category features --priority high
taskwerk add "Add profile photo upload" --category features --priority medium

# Start development
taskwerk start TASK-015
taskwerk branch TASK-015          # Creates feature/task-015-add-user-profile

# Build incrementally
# ... implement profile page ...
git add src/components/
taskwerk commit --auto

taskwerk complete TASK-015
taskwerk start TASK-016           # Continue with photo upload

# ... implement photo upload ...
git add src/
taskwerk commit --auto
taskwerk complete TASK-016

# Feature is done, merge to main
git checkout main
git merge feature/task-015-add-user-profile
```

## File Organization

### Project Structure
```
your-project/
├── src/                 # Your code
├── tasks/               # taskwerk files
│   ├── tasks.md         # Active tasks (edit directly)
│   ├── tasks_completed.md    # Completed archive
│   ├── tasks-how-to.md       # Quick reference
│   └── taskwerk-rules.md     # Project guidelines
├── .taskrc.json         # Configuration
└── .task-session.json   # Current session (git-ignored)
```

### v2.0 YAML Frontmatter Format

TaskWerk v2.0 uses YAML frontmatter for structured metadata. You can edit `tasks/tasks.md` by hand:

```markdown
<!-- TaskWerk v2.0 Format -->

---
id: TASK-001
description: Fix login bug on mobile Safari
status: in_progress
priority: high
category: bugs
assignee: @john
estimated: 2h
dependencies: []
subtasks:
  - id: TASK-001.1
    description: Reproduce issue
    status: completed
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

# Fix login bug on mobile Safari

## Problem Description
Session timeout occurs after 15 minutes on mobile Safari...

## Acceptance Criteria
- [ ] Session persists for 30 minutes
- [ ] Works in background tabs
```

**Pro tip:** v2.0 format provides rich metadata while keeping content human-readable.

## Task Management Strategies

### Priority Management
- **HIGH**: Critical bugs, blockers, security issues
- **MEDIUM**: Standard features, improvements (default)
- **LOW**: Nice-to-have, cleanup, documentation

### Category Organization
```bash
taskwerk add "Fix auth bug" --category bugs
taskwerk add "Add dark mode" --category features  
taskwerk add "Update README" --category docs
taskwerk add "Optimize queries" --category perf
```

### Task Completion Notes
Always include meaningful completion notes:
```bash
# Good examples
taskwerk complete TASK-001 --note "Fixed session timeout, increased from 2min to 30min"
taskwerk complete TASK-002 --note "Added lazy loading, reduced bundle size by 40%"
taskwerk complete TASK-003 --note "Implemented rate limiting with Redis, 100 req/min per user"

# Avoid
taskwerk complete TASK-001 --note "done"
taskwerk complete TASK-002 --note "fixed"
```

## Git Integration Patterns

### Safe Git Workflow

taskwerk follows these safety principles:
- **You control staging**: taskwerk never runs `git add`
- **Preview by default**: `taskwerk commit` shows preview only
- **Explicit commits**: Use `--auto` to actually commit

```bash
# Safe workflow
git add src/components/           # 1. You stage files
taskwerk commit                   # 2. Preview message
taskwerk commit --auto           # 3. Actually commit
```

### Branch Management

```bash
# Create task-specific branches
taskwerk branch TASK-001          # feature/task-001-fix-login-bug

# Or stay on main for simple changes
git add fixes/
taskwerk commit --auto
```

### Commit Message Generation

taskwerk generates conventional commit messages:

```
fix: Complete 1 task - Fix authentication timeout

Tasks completed since last commit:
- TASK-001: Fix authentication timeout on mobile Safari

Implementation details:
- Increased session timeout from 2min to 30min
- Added keepalive mechanism for mobile browsers

Files modified:
- src/auth/session.js
- src/auth/middleware.js
- tests/auth.test.js
```

## AI Integration (Optional)

### Natural Language Commands
```bash
# Ask questions
taskwerk ask "what should I work on next?"
taskwerk ask "show me all high priority bugs"
taskwerk ask "what tasks are related to authentication?"

# Get AI to perform actions
taskwerk agent "add a task for fixing the memory leak"
taskwerk agent "mark TASK-003 as completed"
taskwerk agent "start working on the highest priority bug"
```

### Setup
```bash
# Interactive setup
taskwerk llmconfig --choose

# Or configure manually
export OPENAI_API_KEY="your-key"
taskwerk llmconfig --set-default gpt-4
```

## Advanced Usage

### Search and Discovery
```bash
taskwerk search "auth"           # Find authentication-related tasks
taskwerk search "login"          # Find login tasks
taskwerk context TASK-001        # Get detailed task info
```

### Project Insights
```bash
taskwerk stats                   # Overall project statistics
taskwerk recent                  # Recently completed tasks
taskwerk list --completed       # All completed tasks
```

### v2.0 Enhanced Configuration
```bash
# View current configuration
cat .taskrc.json

# Enhanced v2.0 configuration example
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
    "performance": "Performance",
    "security": "Security",
    "refactor": "Code Refactoring",
    "tests": "Testing"
  },
  "estimateFormats": ["30m", "1h", "2h", "4h", "1d", "2d", "1w"],
  "workflowRules": {
    "requireEstimateForHighPriority": true,
    "autoCompleteSubtasks": true,
    "enforceAssigneeFormat": true,
    "requireReasonForBlocking": true
  }
}
```

## Troubleshooting

### Common Issues

**"No tasks found"**
```bash
taskwerk list                    # Verify tasks exist
ls tasks/                        # Check files exist
```

**"Task not found: TASK-XXX"**
```bash
taskwerk list                    # Check exact task ID
taskwerk search "partial desc"   # Find by description
```

**"No files staged for commit"**
```bash
git add <files>                  # Stage files manually
git status                       # Check what needs staging
```

**Git integration not working**
```bash
git status                       # Verify you're in a git repo
git init                         # Initialize if needed
```

### Getting Help
```bash
taskwerk --help                  # General help
taskwerk <command> --help        # Command-specific help
taskwerk about                   # Version and info
```

## Best Practices

1. **Keep task descriptions specific**: "Fix login validation for mobile Safari" vs "Fix login bug"

2. **Use categories consistently**: Stick to the same category names across your team

3. **Complete tasks promptly**: Don't let tasks stay "in progress" too long

4. **Write meaningful completion notes**: Include what you did and why

5. **Review regularly**: Use `taskwerk stats` to track progress

6. **Keep files clean**: Edit tasks.md directly when needed

7. **Git safety**: Always check `git status` before using taskwerk git commands

## v2.0 Migration & Compatibility

TaskWerk v2.0 automatically migrates older task formats:

```bash
# Automatic migration when adding tasks to existing projects
taskwerk add "New v2.0 task"    # Automatically converts existing v1 format

# Check migration status
taskwerk list                   # Shows if migration occurred

# Manual migration if needed
taskwerk migrate               # Force migration to v2.0 format
```

**Migration Features:**
- Automatic detection of older formats
- Seamless conversion to YAML frontmatter
- Preservation of all existing task data
- Backup creation for safety

## Summary

TaskWerk v2.0 enhances your workflow with structured task management:
- **Core**: Add → Start → Complete with rich metadata and timeline tracking
- **Relationships**: Dependencies and subtasks for complex project management
- **Team**: Assignees, categories, and shared YAML frontmatter files
- **Git**: Intelligent commit messages with task context and Co-Authored-By tags
- **AI**: Enhanced natural language interface with v2.0 awareness
- **Compatibility**: Automatic migration from older formats

The key is structured simplicity: TaskWerk v2.0 provides powerful features while remaining approachable and human-readable.

---

*For comprehensive documentation, see the [User Guide](user-guide.md), [Developer Guide](developer-guide.md), and [README.md](../README.md)*