# TaskWerk Complete Workflow Guide

This guide demonstrates the complete TaskWerk workflow from project initialization through task completion and Git integration. Follow these patterns to maximize productivity in both human and AI-assisted development.

## Table of Contents

1. [Initial Setup](#initial-setup)
2. [Basic Task Management Workflow](#basic-task-management-workflow)
3. [Advanced Task Operations](#advanced-task-operations)
4. [Git Integration Workflow](#git-integration-workflow)
5. [Human-AI Collaboration Patterns](#human-ai-collaboration-patterns)
6. [Workflow Rules and Automation](#workflow-rules-and-automation)
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

### 2. Optional: Configure AI Features

If you plan to use AI assistance:

```bash
# Check current AI setup
taskwerk llmconfig

# Add API keys for cloud models
taskwerk llmconfig --add-key openai     # For GPT models
taskwerk llmconfig --add-key anthropic  # For Claude models

# Or set up local models (Ollama/LM Studio)
taskwerk llmconfig --pull llama3.2      # Download local model
taskwerk llmconfig --choose             # Interactively select model
```

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

## Basic Task Management Workflow

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

## Git Integration Workflow

TaskWerk provides intelligent Git integration that bridges task management with code changes.

### Recommended Git Workflow

```bash
# 1. Start with a clean Git state
git status                             # Ensure clean working directory

# 2. Create and work on tasks
taskwerk add "Fix memory leak in user dashboard"
taskwerk start TASK-001
taskwerk branch TASK-001               # Optional: create feature branch

# 3. Do your development work
# ... make code changes ...

# 4. Complete tasks with proper tracking
taskwerk complete TASK-001 --note "Added cleanup in useEffect hooks, reduced memory usage by 40%"

# 5. Use TaskWerk for intelligent commits
taskwerk commit                        # Preview commit message
taskwerk commit --auto                 # Auto-stage and commit immediately
```

### Git Commit Integration

TaskWerk generates intelligent commit messages based on completed tasks:

```bash
# Basic commit workflow
git add src/components/Dashboard.js tests/dashboard.test.js
taskwerk commit                        # Shows preview, requires confirmation

# Automated commit workflow (AI mode)
taskwerk commit --auto                 # Auto-stages files and commits

# Custom commit message
taskwerk commit -m "hotfix: critical auth vulnerability"

# Version bumping with commits
taskwerk commit --version-bump patch   # Commits and bumps version
```

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

## Human-AI Collaboration Patterns

### AI Agent Workflow

When working with AI assistants (Claude Code, Cursor, etc.):

```bash
# AI starts by reviewing current tasks
taskwerk list --priority high

# AI claims a task
taskwerk start TASK-003

# AI gets full context
taskwerk context TASK-003

# AI implements solution
# ... code development ...

# AI completes with detailed notes
taskwerk complete TASK-003 --note "Implemented using React hooks pattern with TypeScript interfaces"
```

### Human Oversight Workflow

```bash
# Human reviews AI progress
taskwerk recent                        # See what AI completed
taskwerk stats                         # Check overall progress

# Human adds new tasks or adjusts priorities
taskwerk add "Review AI implementation for security issues" --priority high

# Human can pause/redirect AI work
taskwerk pause TASK-003               # If AI needs to switch focus
```

### Handoff Patterns

```bash
# Human → AI handoff
taskwerk add "Optimize database queries in user service - currently 3-5 sec, need <500ms" --priority high --category performance
# AI uses: taskwerk start TASK-004 && taskwerk context TASK-004

# AI → Human handoff
taskwerk complete TASK-004 --note "Added indexes on user_id, implemented query caching, needs review for edge cases"
# Human uses: taskwerk context TASK-004 to understand what was done
```

## Workflow Rules and Automation

TaskWerk automatically detects AI vs human workflows and applies appropriate rules.

### Check Workflow Mode

```bash
# See current workflow mode
taskwerk rules --mode

# Show detailed rules status
taskwerk rules --status

# Initialize rules system
taskwerk rules --init
```

### AI Mode Features (Automatic)

When AI agents are detected:
- **Auto-staging**: Files automatically staged for commits
- **Version bumping**: Automatic patch/minor/major version increments
- **Co-authorship**: Automatic Co-Authored-By tags in commits
- **Quality gates**: Tests and documentation requirements enforced
- **Workflow validation**: Tasks validated against development phases

### Human Mode Features

For manual operation:
- **Manual control**: User controls all staging and commits
- **Minimal automation**: No automatic version bumping or staging
- **Flexible workflow**: Fewer enforced quality gates

### Override Automation

```bash
# Force automation in human mode
taskwerk complete TASK-001 --auto-stage --auto-commit

# Force manual control in AI mode
taskwerk commit --review               # Force preview mode

# Skip workflow validation
taskwerk complete TASK-001 --force
```

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
# Initialize project
taskwerk init

# Daily workflow
taskwerk add "Task description" --priority high --category bugs
taskwerk list --priority high
taskwerk start TASK-001
taskwerk context TASK-001
# ... do work ...
taskwerk complete TASK-001 --note "Implementation details"
taskwerk commit --auto

# Weekly review
taskwerk recent
taskwerk stats
taskwerk list --completed
```

This workflow enables efficient task management for both individual developers and human-AI collaboration teams. The key is consistency in task descriptions, proper use of priorities and categories, and leveraging the Git integration for better development history tracking.

---

*For more detailed command help, use `taskwerk <command> --help` or see the [TaskWerk documentation](../README.md).*