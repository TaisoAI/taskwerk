# TaskWerk How-To Guide

This guide explains how to effectively use TaskWerk for managing tasks in your development workflow.

## Quick Start

### 1. Initialize TaskWerk
```bash
# Initialize in current project
taskwerk init

# Or specify a custom directory
taskwerk init my-tasks
```

### 2. Add Your First Task
```bash
# Basic task
taskwerk add "Fix login validation bug"

# Task with priority and category
taskwerk add "Add dark mode support" --priority high --category features
```

### 3. Start Working
```bash
# List all tasks
taskwerk list

# Start a specific task
taskwerk start TASK-001

# Check your current status
taskwerk status
```

## Task Management Workflow

### Adding Tasks
```bash
# Different priority levels
taskwerk add "Critical security fix" --priority high
taskwerk add "Refactor auth module" --priority medium
taskwerk add "Update documentation" --priority low

# Categorize tasks
taskwerk add "Fix memory leak" --category bugs
taskwerk add "Add PDF export" --category features
taskwerk add "Write API docs" --category docs
```

### Working with Tasks
```bash
# Start working on a task
taskwerk start TASK-001

# Get context about a task
taskwerk context TASK-001

# Pause a task (return to todo)
taskwerk pause TASK-001

# Complete a task with notes
taskwerk complete TASK-001 --note "Used OAuth 2.0 implementation"
```

### Finding Tasks
```bash
# Search task descriptions
taskwerk search "auth"

# Filter by priority
taskwerk list --priority high

# Filter by category
taskwerk list --category features

# Show completed tasks
taskwerk list --completed

# Show recent completions
taskwerk recent
```

## Git Integration

### Branch Management
```bash
# Create a feature branch for a task
taskwerk branch TASK-001

# This creates: feature/task-001-fix-login-validation-bug
```

### Committing Changes
```bash
# Commit with task context
taskwerk commit

# This creates a commit message like:
# TASK-001: Fix login validation bug
# 
# Files: auth/validation.js, tests/auth.test.js
```

## Statistics and Reporting

```bash
# View project statistics
taskwerk stats

# Current session status
taskwerk status

# Recently completed tasks
taskwerk recent
```

## Configuration

Create a `.taskrc.json` file in your project root to customize behavior:

```json
{
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

## Human-AI Collaboration

### For AI Assistants (Claude Code, Cursor, etc.)
```bash
# AI workflow
taskwerk list --priority high           # See what to work on
taskwerk start TASK-003                 # Claim a task
taskwerk context TASK-003               # Get full context
# ... AI does the work ...
taskwerk complete TASK-003 --note "Implemented using React hooks pattern"
```

### Session Management
TaskWerk automatically tracks:
- Current active task
- When work started
- Which AI agent is working
- Git branch information
- Files being modified

## Best Practices

### Task Descriptions
- **Good**: "Fix authentication timeout on mobile Safari - users logged out after 2 minutes"
- **Bad**: "Fix auth bug"

### Categories
Use consistent categories across your team:
- `bugs` - Bug fixes and issue resolution
- `features` - New functionality
- `docs` - Documentation updates
- `refactor` - Code improvements without behavior changes
- `test` - Test additions and improvements

### Priorities
- **HIGH**: Critical issues, blockers, security fixes
- **MEDIUM**: Standard features, improvements (default)
- **LOW**: Nice-to-have improvements, cleanup

### Completion Notes
Always add notes when completing tasks:
```bash
taskwerk complete TASK-001 --note "Added rate limiting with Redis backend, 100 req/min limit"
```

## File Structure

TaskWerk creates these files:

```
your-project/
├── tasks/
│   ├── tasks.md              # Active tasks
│   ├── tasks_completed.md    # Completed tasks archive
│   └── tasks-how-to.md       # This guide
├── .taskrc.json              # Configuration
└── .task-session.json       # Current session (git-ignored)
```

## Troubleshooting

### Common Issues

**"Tasks file not found"**
```bash
# Make sure you've initialized
taskwerk init
```

**"Task not found"**
```bash
# Check available tasks
taskwerk list

# Use exact task ID
taskwerk start TASK-001  # Not task-1 or TASK-1
```

**Git integration not working**
```bash
# Make sure you're in a git repository
git status

# TaskWerk gracefully degrades without git
```

### Tips
- Use `taskwerk --help` or `taskwerk <command> --help` for detailed usage
- Task IDs are sequential: TASK-001, TASK-002, etc.
- Completed tasks are moved to the archive file
- Session state is preserved between CLI runs

## Advanced Usage

### Aliases
Add to your shell profile for convenience:
```bash
alias task="taskwerk"
alias t="taskwerk"
```

### Project Integration
Add to your `package.json`:
```json
{
  "scripts": {
    "task": "taskwerk",
    "tasks": "taskwerk list"
  }
}
```

Then use:
```bash
npm run task add "New feature"
npm run tasks
```

---

*Happy task management! 🚀*