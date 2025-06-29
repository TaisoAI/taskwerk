# taskwerk Workflow Guide

This guide shows you how to use taskwerk effectively for different scenarios and team sizes.

## Quick Reference

### Basic Commands
```bash
taskwerk init                    # Initialize in project
taskwerk add "Task description"  # Add new task
taskwerk list                    # View all tasks
taskwerk start TASK-001          # Begin working
taskwerk complete TASK-001       # Mark finished
taskwerk status                  # Check current state
```

### Git Integration
```bash
taskwerk branch TASK-001         # Create feature branch
git add files                    # Stage your changes
taskwerk commit                  # Generate smart commit message
taskwerk commit --auto          # Actually commit
```

## Core Workflow Patterns

### Solo Development

**Daily routine:**
```bash
# Morning: check what to work on
taskwerk list --priority high
taskwerk start TASK-003

# During work: track progress
taskwerk status

# When done: complete and commit
taskwerk complete TASK-003 --note "Fixed memory leak in user service"
git add src/
taskwerk commit --auto
```

### Team Collaboration

**Shared task management:**
```bash
# Get latest team tasks
git pull

# See what needs attention
taskwerk list --priority high

# Claim a task
taskwerk start TASK-007

# Work and complete
taskwerk complete TASK-007 --note "Implemented with Redis caching"

# Share with team
git add .
taskwerk commit --auto
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

### Editing Tasks Directly

You can edit `tasks/tasks.md` by hand:

```markdown
# Project Tasks

*Next ID: TASK-008*

## HIGH Priority
- [>] **TASK-001** Fix login bug - John working on this
- [ ] **TASK-005** Add 2FA support - needs security review

## MEDIUM Priority  
- [ ] **TASK-006** Update documentation
- [!] **TASK-007** Refactor auth service - blocked by API changes
```

**Pro tip:** Use your editor's markdown preview to see tasks visually.

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

### Configuration
```bash
# View current configuration
cat .taskrc.json

# Example configuration
{
  "defaultPriority": "medium",
  "autoCreateBranch": true,
  "categories": {
    "bugs": "Bug Fixes",
    "features": "Features",
    "docs": "Documentation",
    "perf": "Performance",
    "security": "Security"
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

## Summary

taskwerk works with your existing workflow:
- **Core**: Add → Start → Complete → Repeat
- **Git**: Create branches, stage files, generate commit messages
- **Team**: Share tasks via Git, edit markdown directly
- **AI**: Optional natural language interface

The key is simplicity: taskwerk enhances your workflow without taking it over.

---

*For detailed command reference, see the main [README.md](../README.md)*