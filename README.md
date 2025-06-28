# TaskWerk

A lightweight CLI task manager optimized for human-AI collaboration workflows with built-in LLM integration.

[![npm version](https://badge.fury.io/js/taskwerk.svg)](https://www.npmjs.com/package/taskwerk)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

TaskWerk is a git-native, markdown-based task management system that bridges the gap between human project management and AI-powered development. With natural language support via local and remote LLMs, TaskWerk enables seamless collaboration between developers and AI assistants.

## Why TaskWerk?

**The Problem**: LLMs lose context between sessions and lack persistent task state management. Current tools don't bridge the gap between human project management and AI code generation effectively.

**The Solution**: A git-native, markdown-based task system with integrated LLM support that both humans and AI can read, write, and maintain collaboratively.

### Key Features

- 🤖 **LLM Integration**: Chat with your tasks using OpenAI, Ollama, or LM Studio
- 🔄 **Human-AI Handoffs**: Seamless collaboration between human oversight and AI execution  
- 📁 **Git-Integrated**: Tasks tracked alongside code changes with automatic branching
- 📝 **Markdown-Native**: Plain text files that work everywhere, no vendor lock-in
- ⚡ **Zero Setup**: Available via `npx` without installation
- 🏠 **Privacy-First**: Full support for local LLMs (Ollama, LM Studio)

## Quick Start

```bash
# Initialize in your project
npx taskwerk init

# Add a task
npx taskwerk add "Fix login validation bug"

# Set up AI assistant (optional)
npx taskwerk llmconfig --choose

# Chat with your tasks
npx taskwerk ask "what should I work on next?"

# Traditional workflow
npx taskwerk list
npx taskwerk start TASK-001
npx taskwerk complete TASK-001
```

## Installation

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

npm run task add "Refactor auth module"
```

## LLM Integration

TaskWerk supports multiple LLM providers for natural language task management:

### Setup Options

#### 1. OpenAI (Remote)
```bash
export OPENAI_API_KEY="your-key-here"
taskwerk ask "show me my high priority tasks"
```

#### 2. Ollama (Local)
```bash
# Install Ollama from https://ollama.ai
ollama pull llama3.2
taskwerk llmconfig --set-default llama3.2
taskwerk ask "create a task for implementing dark mode"
```

#### 3. LM Studio (Local)
```bash
# Install LM Studio from https://lmstudio.ai
# Start the local server
taskwerk llmconfig --set-default lmstudio
taskwerk ask "what tasks are currently in progress?"
```

### Interactive Setup
```bash
taskwerk llmconfig --choose    # Interactive model selection
taskwerk llmconfig --help      # Full setup guide
```

### Natural Language Commands
```bash
# Task management via chat
taskwerk ask "add a task for fixing the memory leak"
taskwerk ask "mark TASK-003 as completed"
taskwerk ask "show me all bug-related tasks"
taskwerk ask "what should I prioritize today?"

# Get help and context
taskwerk ask "how do I create a feature branch?"
taskwerk ask "show me the current project status"
```

## Core Commands

### Task Management
```bash
# Add tasks
taskwerk add "Task description" [--priority high|medium|low] [--category "category"]
taskwerk add "Fix memory leak in authentication"
taskwerk add "Add PDF export feature" --priority high --category features

# List and filter tasks
taskwerk list                    # All active tasks
taskwerk list --priority high   # Filter by priority
taskwerk list --category bugs   # Filter by category
taskwerk list --completed       # Show completed tasks

# Work with tasks
taskwerk start TASK-001         # Mark in-progress
taskwerk complete TASK-001      # Mark completed
taskwerk pause TASK-001         # Return to todo state
```

### Context and Status
```bash
taskwerk status                 # Current session status
taskwerk context TASK-001       # Task details and related files
taskwerk search "auth"          # Search task descriptions
taskwerk stats                  # Task statistics
taskwerk recent                 # Recently completed tasks
```

### Git Integration
```bash
taskwerk branch TASK-001        # Create/switch to feature branch
taskwerk commit                 # Commit with task context
```

### LLM Configuration
```bash
taskwerk llmconfig              # Show LLM status and setup guide
taskwerk llmconfig --list-models    # List available models
taskwerk llmconfig --choose     # Interactive model selection
taskwerk llmconfig --pull llama3.2  # Download Ollama models
taskwerk llmconfig --set-default gpt-4  # Set default model
```

## File Structure

TaskWerk creates these files in your project:

```
tasks/
├── tasks.md              # Active tasks
└── tasks-completed.md    # Completed tasks with metadata
.task-session.json        # Current session state (git-ignored)
.taskrc.json              # Optional configuration
```

## Task Format

Tasks are stored in clean, readable Markdown:

```markdown
# Project Tasks

*Last updated: 2025-06-28*
*Current session: CLI*
*Next ID: TASK-007*

## HIGH Priority

### Bug Fixes
- [>] **TASK-001** Fix authentication timeout on mobile Safari
- [ ] **TASK-004** Memory leak in WebSocket connection handling

### Features  
- [ ] **TASK-002** Add two-factor authentication support

## MEDIUM Priority

### Refactoring
- [ ] **TASK-003** Migrate user service from REST to GraphQL
- [!] **TASK-006** Update deprecated crypto library
```

### Task States
- `[ ]` - Todo
- `[>]` - In Progress  
- `[x]` - Completed
- `[!]` - Blocked

## Configuration

Create `.taskrc.json` in your project root:

```json
{
  "tasksFile": "tasks/tasks.md",
  "completedFile": "tasks/tasks-completed.md",
  "autoCommit": false,
  "autoCreateBranch": true,
  "defaultPriority": "medium",
  "ollamaUrl": "http://localhost:11434",
  "lmstudioUrl": "http://localhost:1234"
}
```

## Workflows

### Human-AI Collaborative Development
```bash
# Morning standup
taskwerk ask "what's the current project status?"

# AI creates tasks from requirements
taskwerk ask "create tasks for implementing user authentication with OAuth"

# Human reviews and prioritizes
taskwerk list --priority high
taskwerk start TASK-005

# AI provides implementation guidance
taskwerk ask "how should I implement rate limiting for TASK-005?"

# Human/AI completes work
taskwerk complete TASK-005 --note "Implemented with Redis backend"

# Review progress
taskwerk stats
```

### Traditional Development
```bash
# Manual task management
taskwerk add "Fix login bug" --priority high
taskwerk list
taskwerk start TASK-001
# ... do the work ...
taskwerk complete TASK-001
```

### Git Integration
```bash
# Automatic branch creation
taskwerk branch TASK-003        # Creates feature/TASK-003-migrate-user-service
# ... implement feature ...
taskwerk commit                 # Commits with task context
```

## Development

### Setup
```bash
git clone https://github.com/yourusername/taskwerk.git
cd taskwerk
npm install
```

### Scripts
```bash
npm test              # Run tests with version banners
npm run build         # Lint and format check
npm run lint          # Check code style
npm run format        # Format code
npm start             # Run local version (bin/taskwerk.js)
```

## API and Automation

TaskWerk supports programmatic access:

```bash
# JSON output for automation
taskwerk list --format json
taskwerk stats --format json

# Pipeable commands
taskwerk list | grep "high priority"
taskwerk search "auth" | taskwerk start
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Run the test suite: `npm test`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

## Requirements

- Node.js >= 18.0.0
- Git (for git integration features)
- Optional: Ollama or LM Studio for local LLMs

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Built for the AI Era

TaskWerk is designed for human-AI collaborative development. Whether you're working solo, with AI assistants like Claude, Cursor, or GitHub Copilot, or managing a team, TaskWerk provides the shared context and intelligent task management needed for effective collaboration.

The future of software development is collaborative. TaskWerk makes it seamless.

---

*Made with ❤️ for developers and their AI partners*