[![npm version](https://badge.fury.io/js/taskwerk.svg)](https://www.npmjs.com/package/taskwerk)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

# taskwerk

A simple, markdown-based task management CLI tool that works with your existing development workflow.

## Why taskwerk?

- **Markdown-native**: Tasks stored in plain text files you can edit anywhere
- **Git-integrated**: Track tasks alongside your code changes
- **Zero vendor lock-in**: Just markdown files, works without the CLI
- **AI-ready**: Optional LLM integration for natural language task management

## Quick Start

```bash
# Initialize TaskWerk in your project
npx taskwerk init

# Add your first task
npx taskwerk add "Fix login validation bug"

# Start working on it
npx taskwerk start TASK-001

# Complete when done
npx taskwerk complete TASK-001 --note "Fixed session timeout issue"
```

That's it! taskwerk creates simple markdown files to track your tasks.

## Installation

### No Installation Required
```bash
npx taskwerk init          # Use directly with npx
```

### Global Installation
```bash
npm install -g taskwerk
taskwerk --help
```

### Project Integration
```bash
# Add to package.json scripts
{
  "scripts": {
    "task": "npx taskwerk"
  }
}

npm run task list
```

## Core Workflow

### 1. Task Management
```bash
# Add tasks
taskwerk add "Task description"
taskwerk add "Fix memory leak" --priority high --category bugs

# View tasks
taskwerk list                    # All active tasks
taskwerk list --priority high   # Filter by priority
taskwerk status                  # Current session info

# Work with tasks
taskwerk start TASK-001          # Begin work
taskwerk complete TASK-001       # Mark done
taskwerk search "login"          # Find tasks
```

### 2. Git Integration (Optional)
```bash
# Create feature branch for task
taskwerk branch TASK-001         # Creates: feature/task-001-fix-memory-leak

# Make your code changes...
git add src/auth.js

# Generate intelligent commit message
taskwerk commit                  # Shows preview
taskwerk commit --auto          # Actually commits
```

### 3. Progress Tracking
```bash
taskwerk stats                   # Project overview
taskwerk recent                  # Recently completed
taskwerk context TASK-001       # Task details
```

## File Structure

taskwerk creates these files in your project:

```
tasks/
├── tasks.md              # Active tasks (hand-editable)
├── tasks_completed.md    # Completed tasks archive
├── tasks-how-to.md       # Quick reference
└── taskwerk-rules.md     # Project workflow rules
.taskrc.json              # Configuration (optional)
```

## Task Format

Tasks are stored in clean, readable markdown:

```markdown
# Project Tasks

*Last updated: 2025-06-29*
*Next ID: TASK-004*

## HIGH Priority

### Bug Fixes
- [>] **TASK-001** Fix authentication timeout on mobile Safari
- [ ] **TASK-003** Memory leak in WebSocket connections

### Features  
- [ ] **TASK-002** Add two-factor authentication support

## MEDIUM Priority
- [ ] **TASK-004** Update API documentation
```

**Task States:**
- `[ ]` Todo
- `[>]` In Progress  
- `[x]` Completed
- `[!]` Blocked

## Configuration

Create `.taskrc.json` in your project root:

```json
{
  "defaultPriority": "medium",
  "autoCreateBranch": true,
  "categories": {
    "bugs": "Bug Fixes",
    "features": "Features",
    "docs": "Documentation"
  }
}
```

## Common Workflows

### Simple Project Management
```bash
# Daily workflow
taskwerk add "Implement user settings page" --priority high
taskwerk list
taskwerk start TASK-005
# ... do the work ...
taskwerk complete TASK-005 --note "Added profile, preferences, and notifications"
taskwerk stats
```

### Git-Integrated Development
```bash
# Feature development workflow
taskwerk add "Add dark mode toggle"
taskwerk branch TASK-006        # Create feature branch
# ... implement feature ...
git add src/components/
taskwerk commit                 # Smart commit message from completed tasks
```

### Team Collaboration
```bash
# Tasks are just markdown - works great with teams
git pull                        # Get latest tasks
taskwerk list --priority high  # See what needs attention
taskwerk start TASK-007         # Claim a task
# ... work collaboratively ...
taskwerk complete TASK-007 --note "Implemented with Redis caching"
git push                        # Share completed work
```

## AI Integration (Optional)

taskwerk supports optional AI assistance for natural language task management:

### Setup
```bash
# Interactive setup
taskwerk llmconfig --choose     # Select from available models

# Or set environment variable
export OPENAI_API_KEY="your-key"
```

### Usage
```bash
# Natural language commands
taskwerk ask "what should I work on next?"
taskwerk ask "add a task for fixing the memory leak"
taskwerk ask "show me all high priority bugs"

# AI can also work with tasks like:
taskwerk agent "start working on the authentication task"
```

**Supported Models:**
- **OpenAI**: GPT-4, GPT-3.5 (remote)
- **Ollama**: Local models (llama3.2, etc.)
- **LM Studio**: Local model server

See `taskwerk llmconfig --help` for complete setup guide.

## Commands Reference

### Task Management
- `taskwerk add "description" [--priority] [--category]` - Add new task
- `taskwerk list [--priority] [--category] [--completed]` - List tasks
- `taskwerk start TASK-ID` - Begin working on task
- `taskwerk complete TASK-ID [--note]` - Mark task completed
- `taskwerk pause TASK-ID` - Return task to todo state
- `taskwerk search "keyword"` - Search task descriptions

### Information & Context
- `taskwerk status` - Current session and active tasks
- `taskwerk context TASK-ID` - Detailed task information
- `taskwerk stats` - Project statistics and progress
- `taskwerk recent` - Recently completed tasks

### Git Integration
- `taskwerk branch TASK-ID` - Create/switch to feature branch
- `taskwerk commit [--auto] [--message]` - Commit with task context

### AI Features (Optional)
- `taskwerk ask "question"` - Ask questions about tasks
- `taskwerk agent "instruction"` - Have AI perform task operations
- `taskwerk llmconfig` - Configure AI models

### Configuration
- `taskwerk init` - Initialize TaskWerk in project
- `taskwerk rules` - View/edit workflow rules
- `taskwerk about` - Version and help information

## Development & Contributing

### Setup
```bash
git clone https://github.com/yourusername/taskwerk.git
cd taskwerk
npm install
```

### Build & Test
```bash
npm test                 # Run all tests
npm run build           # Lint, format, test, and build
npm run lint            # Check code style
npm start               # Run local development version
```

See [BUILD.md](BUILD.md) for detailed build instructions.

## Requirements

- **Node.js**: 18.0.0 or higher
- **Git**: For git integration features (optional)
- **AI Models**: For natural language features (optional)

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Philosophy

taskwerk believes task management should be:
- **Simple**: Add, work, complete
- **Transparent**: Plain text files you can read and edit
- **Integrated**: Works with your existing Git workflow
- **Flexible**: Use as little or as much as you need

Whether you're working solo, with a team, or with AI assistants, taskwerk provides the shared context and intelligent task management you need.

---

*Simple task management for modern development*