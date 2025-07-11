# Taskwerk: Product Requirements & Vision

**Version**: 0.3.x (v3 Architecture)  
**Last Updated**: 2025-01-06

## What is Taskwerk?

Taskwerk is a git-aware task management CLI designed for developers and AI agents working together. It lives in your project repository, tracks your work alongside your code, and helps both humans and AI assistants understand what needs to be done.

## Why Taskwerk?

### The Problem

Modern development involves:
- Multiple tasks and subtasks with complex dependencies
- Switching between features, bugs, and experiments
- Collaborating with AI coding assistants
- Maintaining context across long-running projects
- Tracking what changed and why

Traditional task managers live outside your code. Taskwerk lives WITH your code, understanding your git workflow and providing rich context to both humans and AI agents.

### Solution

1. **Git-Native**: Tasks are tied to branches, commits reference tasks
2. **CLI-First**: Fast, scriptable, works in any terminal
3. **AI-Ready**: Three modes for different AI interaction patterns
4. **Context-Rich**: Maintains notes, dependencies, and history
5. **Simple**: Learn the basics in 5 minutes

## Core Concepts

### Tasks

Tasks are the heart of Taskwerk. Each task has:
- **Unique ID**: TASK-001, TASK-002, etc.
- **Status**: One of `todo`, `active`, `paused`, `blocked`, `completed`, `archived`
- **Metadata**: Priority, assignee, estimates, due dates
- **Relationships**: Parent tasks, subtasks, dependencies
- **Context**: Notes that grow as you work

### Task Lifecycle

```
todo → You know what needs doing
active → You're working on it now
paused → Taking a break, will resume
blocked → Waiting on something external
completed → All done!
archived → Hidden from normal view
```

### Notes: Your Task's Memory

As you work, you update task notes with discoveries, decisions, and progress. These notes use markdown with YAML frontmatter to track who added what when:

```markdown
---
created_at: 2024-01-15T10:00:00Z
author: john
type: investigation
---
Found the timeout setting in config.js:42
```

## Getting Started

### Installation

```bash
npm install -g taskwerk
```

### Initialize a Project

```bash
cd my-project
twrk init
```

This creates:
- `.taskwerk/` directory for data
- `taskwerk_rules.md` with project guidelines (optional)

### Basic Workflow

```bash
# Add a task
twrk task add "Fix login timeout bug"
# Output: Created TASK-001

# Start working
twrk task update TASK-001 --status active
twrk git branch TASK-001  # Creates feature/TASK-001

# Track progress
twrk task update TASK-001 --note "Found issue in auth.js"

# Complete
twrk task update TASK-001 --status completed
twrk git commit TASK-001  # Includes task context
```

## Command Reference Overview

Taskwerk uses subcommands for clarity:

### Task Management
- `twrk task add` - Create new tasks
- `twrk task list` - View tasks (with filters)
- `twrk task show` - See task details
- `twrk task update` - Modify tasks
- `twrk task delete` - Remove tasks (use sparingly)

### Data Operations
- `twrk data export` - Export as markdown/JSON
- `twrk data import` - Import from markdown/JSON

### Git Integration
- `twrk git branch` - Create task branches
- `twrk git commit` - Commit with task context

### AI Assistant
- `twrk ai ask` - Query tasks (read-only)
- `twrk ai agent` - Let AI manage tasks
- `twrk ai raw` - Pipeline mode for scripts

### System
- `twrk init` - Setup Taskwerk
- `twrk status` - Overview of workspace
- `twrk config` - Manage settings
- `twrk logs` - View operation logs

## AI Integration

Taskwerk is designed to work seamlessly with AI coding assistants.

### Three AI Modes

1. **Ask Mode** (Read-Only)
   ```bash
   twrk ai ask "what tasks are blocked?"
   twrk ai ask "show me high priority tasks"
   ```
   Safe queries that don't modify anything.

2. **Agent Mode** (Full Access)
   ```bash
   twrk ai agent "complete TASK-001 with a summary"
   twrk ai agent "create subtasks for authentication"
   ```
   AI can create, update, and manage tasks.

3. **Raw Mode** (Pipeline)
   ```bash
   echo "list of features" | twrk ai raw "convert to tasks"
   twrk ai raw "format as JSON" < tasks.md > tasks.json
   ```
   Text transformation utility.

### Natural Language Interface

Taskwerk includes smart mode detection:

```bash
# These are equivalent:
twrk ai ask "what's blocking the release?"
twrk "what's blocking the release?"  # Auto-detects 'ask' mode

twrk ai agent "create tasks for user authentication"  
twrk "create tasks for user authentication"  # Auto-detects 'agent' mode
```

### AI Configuration

```bash
# Configure AI providers
twrk ai config add openai --api-key sk-...
twrk ai config add anthropic --api-key sk-...
twrk ai config set-default claude
```

## Use Cases

### Solo Developer

Track your work, maintain context across sessions:

```bash
# Monday: Start new feature
twrk task add "Add user notifications" --priority high
twrk task update TASK-001 --status active
twrk git branch TASK-001

# Wednesday: What was I doing?
twrk status
twrk task show TASK-001  # See all your notes

# Friday: Wrap up
twrk task update TASK-001 --status completed
twrk git commit TASK-001
```

### AI Pair Programming

Let AI help manage tasks while you code:

```bash
# Human creates high-level task
twrk task add "Implement OAuth login"

# AI breaks it down
twrk ai agent "create subtasks for OAuth implementation"

# AI helps with specific task
twrk "implement the OAuth callback handler for TASK-002"

# Human reviews
twrk task show TASK-002 --history
```

### Bug Triage

Quick response to production issues:

```bash
# Urgent bug reported
twrk task add "URGENT: Payment failing for EU users" --priority high

# Track investigation
twrk task update TASK-050 --status active
twrk task update TASK-050 --note "Investigating payment logs"

# AI assists
twrk ai ask "what recent tasks touched payment code?"

# Fix and deploy
twrk task update TASK-050 --status completed
twrk git commit TASK-050 --message "Fix EU VAT calculation"
```

### Team Handoffs

Rich context for collaboration:

```bash
# Before vacation
twrk task list --assignee me --status active > handoff.md
twrk data export --status active --format markdown

# Teammate picks up
twrk data import handoff.md
twrk task update TASK-023 --assignee alice
twrk task show TASK-023  # Sees all context and notes
```

## Project Guidelines

Taskwerk can read `taskwerk_rules.md` for project-specific workflows:

```markdown
# Project Rules

## Before Starting a Task
- [ ] Task has clear acceptance criteria
- [ ] Dependencies are available
- [ ] Create feature branch

## Before Completing  
- [ ] All tests pass
- [ ] Code is documented
- [ ] PR is reviewed
```

AI agents read these rules and follow them when working on tasks.

## Architecture Philosophy

1. **SQLite Database**: Fast, reliable, portable
2. **CLI-First**: Everything through commands
3. **Git-Aware**: Understands branches and commits
4. **AI-Native**: Built for human-AI collaboration
5. **Progressive**: Start simple, add features as needed

## Future Vision

### Near Term (0.4.x)
- Task templates for common workflows
- Better dependency visualization
- Enhanced AI context awareness

### Medium Term (0.5.x)
- Multi-user support
- Web UI (optional)
- Plugin system

### Long Term (1.x)
- Team features
- External integrations
- Advanced analytics

## FAQ

**Q: How is this different from GitHub Issues?**  
A: Taskwerk lives in your repo, works offline, integrates with your development flow, and provides rich AI context.

**Q: Can I use it without AI?**  
A: Absolutely! AI features are optional. Taskwerk is a great task manager on its own.

**Q: What about existing tasks in other systems?**  
A: Import via markdown or JSON formats. Export anytime.

**Q: Is my data secure?**  
A: Tasks stay in your repo. AI features only send what you explicitly ask about.

## Getting Help

```bash
# Built-in help
twrk --help
twrk task --help

# See examples
twrk examples

# Check status
twrk status
```

## Contributing

Taskwerk is open source. We welcome contributions!

- Report issues: https://github.com/taskwerk/taskwerk/issues
- Documentation: https://taskwerk.dev/docs
- Community: https://discord.gg/taskwerk

## Summary

Taskwerk brings task management to where you work - your code repository. It's fast, git-aware, AI-ready, and designed for the realities of modern development. Whether you're a solo developer or working with AI assistants, Taskwerk helps you stay organized and maintain context.

Start simple, grow as needed. Your tasks, your way.