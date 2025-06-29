# TaskWerk Complete Workflow Guide

This guide demonstrates the unified TaskWerk workflow that works consistently for everyone - whether you're working solo, collaborating with others, or using AI assistance. TaskWerk follows one clear, predictable pattern with optional Git integration.

## Core Philosophy

- **One workflow for everyone**: Same commands, same behavior, regardless of who's using TaskWerk
- **Works standalone**: TaskWerk manages tasks without requiring AI or Git
- **Hand-editable files**: All task files are markdown and can be edited directly
- **Optional integrations**: Git and AI features enhance but don't change core workflow
- **Predictable commands**: Each command has one clear purpose with minimal side effects

## Table of Contents

1. [Initial Setup](#initial-setup)
2. [Core Task Management Workflow](#core-task-management-workflow)
3. [Advanced Task Operations](#advanced-task-operations)
4. [Optional Git Integration](#optional-git-integration)
5. [Optional AI Features](#optional-ai-features)
6. [Direct File Editing](#direct-file-editing)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

## Initial Setup

### 1. Project Initialization

Start by initializing TaskWerk in your project:

```bash
# Initialize TaskWerk in your project
cd your-project
taskwerk init

# This creates:
# - tasks/tasks.md (active tasks)
# - tasks/tasks_completed.md (completed tasks archive)
# - tasks/tasks-how-to.md (quick reference)
# - tasks/taskwerk-rules.md (workflow automation rules)
# - .taskrc.json (configuration)
```

### 2. Optional: Configure AI Features (if desired)

TaskWerk includes optional AI assistance for asking questions and automating some task operations:

```bash
# Check AI setup status
taskwerk llmconfig

# Add API keys for cloud models (optional)
taskwerk llmconfig --add-key openai     # For GPT models
taskwerk llmconfig --add-key anthropic  # For Claude models

# Or set up local models (optional)
taskwerk llmconfig --pull llama3.2      # Download local model
taskwerk llmconfig --choose             # Interactively select model
```

**Note**: All core TaskWerk functionality works without AI configuration.

### 3. Configure Project Settings

Create or modify `.taskrc.json`:

```json
{
  "defaultModel": "gpt-4",
  "tasksFile": "tasks/tasks.md",
  "completedFile": "tasks/tasks_completed.md",
  "autoCommit": false,
  "autoCreateBranch": true,
  "defaultPriority": "medium",
  "categories": {
    "bugs": "Bug Fixes",
    "features": "Features", 
    "docs": "Documentation",
    "refactor": "Refactoring",
    "test": "Testing"
  }
}
```

## Core Task Management Workflow

TaskWerk's core workflow is simple and consistent. These commands work the same way for everyone:

### Phase 1: Task Planning and Creation

```bash
# Add tasks with different priorities and categories
taskwerk add "Fix user authentication timeout bug" --priority high --category bugs
taskwerk add "Add dark mode toggle to settings" --priority medium --category features
taskwerk add "Update API documentation" --priority low --category docs

# View your task list
taskwerk list
taskwerk list --priority high    # Filter by priority
taskwerk list --category bugs    # Filter by category
```

### Phase 2: Working on Tasks

```bash
# Start working on a task
taskwerk start TASK-001

# Check current status
taskwerk status
taskwerk context TASK-001        # Get detailed task information

# Create a feature branch (optional but recommended)
taskwerk branch TASK-001         # Creates: feature/task-001-fix-user-auth-timeout

# Search for related tasks
taskwerk search "authentication"
taskwerk search "timeout"
```

### Phase 3: Task Completion

```bash
# Complete a task with details
taskwerk complete TASK-001 --note "Fixed session timeout from 2min to 30min, added keepalive mechanism"

# Complete with file tracking
taskwerk complete TASK-001 --files "src/auth.js,src/session.js,tests/auth.test.js"

# Complete with version impact
taskwerk complete TASK-001 --version-impact minor --note "Breaking change: session config format updated"
```

## Advanced Task Operations

### Task State Management

```bash
# Pause work on a task (return to todo)
taskwerk pause TASK-001

# Resume work
taskwerk start TASK-001

# Block a task (requires human attention)
# Edit tasks.md and change [>] to [!] for blocked status
```

### Search and Discovery

```bash
# Search across all task descriptions (full text, no truncation)
taskwerk search "login validation"
taskwerk search "instead of typing"     # Matches anywhere in description

# View recent activity
taskwerk recent                         # Recently completed tasks
taskwerk stats                          # Project statistics
taskwerk stats --format plain          # Plain text for scripting
```

### Task Context and Information

```bash
# Get comprehensive task details
taskwerk context TASK-001

# View current session information
taskwerk status

# List tasks with different filters
taskwerk list --completed              # Show completed tasks
taskwerk list --current                # Show session info
```

## Optional Git Integration

TaskWerk provides optional Git integration that can help generate intelligent commit messages from completed tasks. Git integration is entirely optional - TaskWerk works perfectly for task management without Git.

### Unified Git Workflow

```bash
# 1. Work on tasks (TaskWerk core functionality)
taskwerk add "Fix memory leak in user dashboard"
taskwerk start TASK-001
taskwerk branch TASK-001               # Optional: create feature branch

# 2. Do your development work
# ... make code changes ...

# 3. Complete tasks (TaskWerk core functionality)
taskwerk complete TASK-001 --note "Added cleanup in useEffect hooks, reduced memory usage by 40%"

# 4. Git integration (optional, but useful)
git add src/components/                # Always manually stage files
taskwerk commit                        # Generate intelligent commit message
# OR use regular git: git commit -m "your message"
```

### Git Commit Integration

TaskWerk generates intelligent commit messages based on completed tasks:

```bash
# Standard workflow
git add src/components/Dashboard.js tests/dashboard.test.js  # Always stage files manually
taskwerk commit                        # Shows preview, requires confirmation
taskwerk commit --auto                 # Skip preview, commit immediately

# Alternative approaches
taskwerk commit -m "hotfix: critical auth vulnerability"    # Custom message
git commit -m "your message"           # Regular git (bypasses TaskWerk)

# Optional version bumping
taskwerk commit --version-bump patch   # Bump version in package.json
```

**Key principle**: You always control file staging with `git add`. TaskWerk only helps with commit message generation.

### Generated Commit Message Format

TaskWerk creates conventional commit messages like:

```
fix: Complete 1 task - Fix memory leak in user dashboard

Tasks completed since last commit:
- TASK-001: Fix memory leak in user dashboard

Implementation details:
- Added cleanup in useEffect hooks, reduced memory usage by 40%

Files modified:
- src/components/Dashboard.js
- src/hooks/useCleanup.js
- tests/dashboard.test.js

Co-Authored-By: Claude <noreply@anthropic.com>
```

## Optional AI Features

TaskWerk includes optional AI assistance that works within the same unified workflow:

### AI Commands

```bash
# Ask questions (no actions taken)
taskwerk ask "What high priority tasks do I have?"
taskwerk ask "How should I implement user authentication?"

# AI agent (can perform task management actions)
taskwerk agent "add a task to fix the login bug"
taskwerk agent "start working on the authentication task"
```

### Collaborative Workflow

TaskWerk works the same whether you're working solo, with a team, or with AI assistance:

```bash
# Anyone can add tasks
taskwerk add "Optimize database queries - currently 3-5 sec, need <500ms" --priority high

# Anyone can work on tasks
taskwerk start TASK-004
taskwerk context TASK-004    # Get full details

# Anyone can complete tasks with notes
taskwerk complete TASK-004 --note "Added indexes on user_id, implemented query caching"

# Review what's been done
taskwerk recent               # See recent completions
taskwerk stats                # Check overall progress
```

**Key point**: AI features are additive. They don't change TaskWerk's core workflow or create different behavior modes.

## Direct File Editing

One of TaskWerk's key strengths is that all files are human-readable markdown that can be edited directly:

### Task Files Structure

```bash
tasks/
├── tasks.md              # Active tasks (you can edit this directly)
├── tasks_completed.md    # Completed tasks archive
├── taskwerk-rules.md     # Project workflow guidelines
└── tasks-how-to.md       # Quick reference guide
```

### Manual Task Editing

You can edit tasks directly in `tasks/tasks.md`:

```markdown
# Project Tasks

## HIGH Priority
- [ ] **TASK-001** Fix authentication bug
- [>] **TASK-002** Add dark mode support  
- [x] **TASK-003** Update documentation

## MEDIUM Priority
- [ ] **TASK-004** Refactor user service
```

**Task Status Markers:**
- `[ ]` = Todo
- `[>]` = In Progress  
- `[x]` = Completed
- `[!]` = Blocked

### TaskWerk Rules

The `tasks/taskwerk-rules.md` file contains project-specific guidelines that help everyone (humans and AI) follow consistent patterns. These are guidelines, not enforced behaviors:

```bash
# View current rules
taskwerk rules

# Initialize rules for your project
taskwerk rules --init
```

Rules help with consistency but don't change TaskWerk's core behavior.

## Best Practices

### Task Description Guidelines

**Good task descriptions:**
```bash
taskwerk add "Fix authentication timeout on mobile Safari - users logged out after 2 minutes instead of 30"
taskwerk add "Add PDF export feature to reports dashboard with custom styling and progress indicators"
taskwerk add "Implement rate limiting for API endpoints - 100 req/min per user with Redis backend"
```

**Poor task descriptions:**
```bash
taskwerk add "Fix auth bug"           # Too vague
taskwerk add "Update docs"            # No context
taskwerk add "Refactor code"          # No specific target
```

### Category Usage

Use consistent categories across your team:

```bash
--category bugs       # Bug fixes and issue resolution
--category features   # New functionality and enhancements
--category docs       # Documentation updates and creation
--category refactor   # Code improvements without behavior changes
--category test       # Test additions and improvements
--category perf       # Performance optimizations
--category security   # Security fixes and improvements
```

### Priority Guidelines

- **HIGH**: Critical issues, blockers, security vulnerabilities, production bugs
- **MEDIUM**: Standard features, improvements, non-critical bugs (default)
- **LOW**: Nice-to-have improvements, code cleanup, documentation updates

### Completion Notes Best Practices

Always provide meaningful completion notes:

```bash
# Good completion notes
taskwerk complete TASK-001 --note "Added rate limiting with Redis backend, 100 req/min limit per user, graceful degradation on Redis failure"

taskwerk complete TASK-002 --note "Implemented lazy loading for dashboard widgets, reduced initial bundle size by 40%, added loading skeletons for better UX"

# Include implementation details, performance impacts, and considerations
```

## Troubleshooting

### Common Issues and Solutions

**"No tasks found"**
```bash
taskwerk list                         # Verify tasks exist
taskwerk init                         # Reinitialize if needed
```

**"Task not found: TASK-XXX"**
```bash
taskwerk list                         # Check exact task ID format
taskwerk search "partial description" # Find task by content
```

**"No files staged for commit"**
```bash
git add <files>                       # Stage files manually
taskwerk commit --auto                # Use auto-staging (AI mode)
```

**"No completed tasks since last commit"**
```bash
taskwerk complete TASK-XXX            # Complete a task first
taskwerk commit --allow-empty         # Commit without completed tasks
```

**"Git integration not working"**
```bash
git init                              # Initialize Git repository
git status                            # Verify Git is working
# TaskWerk gracefully degrades without Git
```

### Debug Information

```bash
# Get comprehensive status
taskwerk status
taskwerk rules --status
taskwerk llmconfig

# Check configuration
cat .taskrc.json
cat tasks/taskwerk-rules.md

# Verify file structure
ls -la tasks/
```

### Performance Tips

- Use `taskwerk search` instead of manual file searching
- Leverage `taskwerk context` for comprehensive task details
- Use `taskwerk recent` to track progress and stay motivated
- Set up proper categories and priorities from the beginning
- Regular use of `taskwerk stats` helps identify productivity patterns

---

## Summary Workflow Cheat Sheet

```bash
# One-time setup
taskwerk init

# Core daily workflow (works for everyone)
taskwerk add "Task description" --priority high --category bugs
taskwerk list --priority high
taskwerk start TASK-001
taskwerk context TASK-001
# ... do your work ...
taskwerk complete TASK-001 --note "Implementation details"

# Optional Git integration
git add changed-files
taskwerk commit                        # Generate intelligent commit message

# Progress tracking
taskwerk recent
taskwerk stats
taskwerk list --completed
```

**Key Principles:**
- **One workflow**: Same commands, same behavior for everyone
- **TaskWerk manages tasks**: Add, start, complete, search, track
- **You manage files**: Use `git add` to stage, TaskWerk helps with commit messages
- **Everything is optional**: AI, Git, and automation features enhance but don't change core workflow
- **Hand-editable**: All task files are markdown and can be edited directly

---

*For more detailed command help, use `taskwerk <command> --help` or see the [TaskWerk documentation](../README.md).*