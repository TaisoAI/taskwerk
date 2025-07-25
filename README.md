[![npm version](https://img.shields.io/npm/v/taskwerk.svg)](https://www.npmjs.com/package/taskwerk)
[![CI](https://github.com/TaisoAI/taskwerk/actions/workflows/ci.yml/badge.svg)](https://github.com/TaisoAI/taskwerk/actions/workflows/ci.yml)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

```text
████████╗ █████╗ ███████╗██╗  ██╗██╗    ██╗███████╗██████╗ ██╗  ██╗
╚══██╔══╝██╔══██╗██╔════╝██║ ██╔╝██║    ██║██╔════╝██╔══██╗██║ ██╔╝
   ██║   ███████║███████╗█████╔╝ ██║ █╗ ██║█████╗  ██████╔╝█████╔╝ 
   ██║   ██╔══██║╚════██║██╔═██╗ ██║███╗██║██╔══╝  ██╔══██╗██╔═██╗ 
   ██║   ██║  ██║███████║██║  ██╗╚███╔███╔╝███████╗██║  ██║██║  ██╗
   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝ ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝
```

A task management CLI with AI integration for development workflows.

## What is Taskwerk?

Taskwerk is a command-line task manager that integrates with AI models (Claude, GPT, Mistral, Llama) to help manage development tasks. It stores tasks in SQLite and supports markdown import/export.

### Features

- **Task Management**: Create, update, list, and track tasks with priority, status, and tags
- **Task Organization**: Split tasks into subtasks and manage dependencies
- **AI Integration**: Ask questions about your tasks or let AI agents help complete them
- **Local Storage**: SQLite database keeps your data on your machine
- **Markdown Support**: Import and export tasks as markdown for sharing or backup

## 🎯 Quick Start

### Installation

```bash
# Install globally via npm
npm install -g taskwerk

# Or use npx (no installation required)
npx taskwerk init
```

### Your First 5 Minutes with Taskwerk

```bash
# 1. Initialize taskwerk in your project
taskwerk init

# 2. Add your first task
taskwerk add "Set up development environment" -p high

# 3. View your tasks
taskwerk list

# 4. Add more tasks with details
taskwerk add "Write unit tests for auth module" -p medium --tags backend,testing
taskwerk add "Review PR #42" -p high --due tomorrow

# 5. Use AI to help manage tasks
taskwerk ask "What should I work on first?"
taskwerk agent "Break down the auth module task into subtasks"
```

### Real-World Example

Let's say you're starting a new feature:

```bash
# Create a parent task for the feature
taskwerk add "Implement user authentication" -p high --tags feature,backend

# Use AI to help plan
taskwerk agent "Create subtasks for implementing user authentication with JWT"

# The agent creates subtasks for you:
# ✅ Created task TASK-123: Design authentication API endpoints
# ✅ Created task TASK-124: Implement JWT token generation  
# ✅ Created task TASK-125: Add password hashing with bcrypt
# ✅ Created task TASK-126: Create login/logout endpoints
# ✅ Created task TASK-127: Add authentication middleware
# ✅ Created task TASK-128: Write tests for auth flow

# Check your tasks by tag
taskwerk list --tag auth

# Get AI insights
taskwerk ask "Show me the auth tasks ordered by dependency"

# Start working on a task
taskwerk update TASK-124 --status in-progress

# Add notes as you work
taskwerk update TASK-124 --note "Using RS256 algorithm for better security"

# Complete a task
taskwerk update TASK-124 --status done
```

## 🤖 AI Integration

Taskwerk features deep AI integration with support for multiple providers:

### Supported AI Providers

- **Anthropic Claude** (Claude 3.5 Sonnet, Claude 3 Opus)
- **OpenAI** (GPT-4, GPT-4 Turbo, GPT-3.5)
- **Ollama** (Local models - Llama 3, Mistral, Gemma)
- **LM Studio** (Local model server)
- **Grok** (X.AI models)
- **Mistral** (Mistral Large, Mixtral)

### AI Commands

#### `taskwerk aiconfig`
Configure your AI providers and models:

```bash
# Interactive configuration
taskwerk aiconfig --choose

# Set provider directly
taskwerk aiconfig --provider openai --model gpt-4-turbo

# Configure API keys
taskwerk aiconfig --set anthropic.api_key=your-key-here
taskwerk aiconfig --set openai.api_key=your-key-here

# List available models
taskwerk aiconfig --list-models

# Test connections
taskwerk aiconfig --test
```

#### `taskwerk ask`
Get intelligent insights about your tasks and projects:

```bash
# Ask about priorities
taskwerk ask "What are my high priority tasks?"

# Get project insights  
taskwerk ask "Analyze my backend tasks and suggest an order"

# Include file context
taskwerk ask "How do these tasks relate to the roadmap?" -f ROADMAP.md

# Include current tasks
taskwerk ask "What's the status of the auth feature?" -t
```

#### `taskwerk agent`
Let AI actively help manage and organize your tasks:

```bash
# Break down complex tasks
taskwerk agent "Split the database migration task into smaller steps"

# Organize your backlog
taskwerk agent "Group related tasks and add appropriate tags"

# Generate task lists from requirements
taskwerk agent "Create tasks from the requirements in spec.md" -f spec.md

# Plan your day
taskwerk agent "Create a prioritized task list for today based on deadlines"
```

#### `taskwerk llm`
Direct access to language models for general purpose use:

```bash
# Quick questions
taskwerk llm "Explain the difference between JWT and OAuth"

# Code generation
taskwerk llm "Write a Python function to validate email addresses"

# Pipe input/output
cat error.log | taskwerk llm "What's causing this error?"
taskwerk llm "Generate 10 test cases for a login API" > test-cases.md
```

### AI Tools System

Taskwerk includes tools that allow AI to interact with your tasks and files:

```bash
# List available AI tools
taskwerk aiconfig --list-tools

# Available tools include:
# - list_tasks: List and filter tasks
# - add_task: Create new tasks
# - update_task: Modify existing tasks  
# - read_file: Read file contents
# - write_file: Write files (agent mode only)
# - list_files: Browse directory contents
# - search_code: Search for patterns in code
```

### AI Chat Context (New!)

Taskwerk now maintains conversation history for AI interactions, making it easier to have ongoing discussions about your tasks and projects:

#### How Chat Context Works

- **In Projects**: When you're in a directory with initialized taskwerk (`.taskwerk` folder), conversations are automatically maintained per-project
- **Outside Projects**: Uses a general global context or named contexts
- **Context Persistence**: All conversations are stored in the SQLite database
- **No Auto-Expiry**: Conversations are kept indefinitely until manually cleared

#### Examples

```bash
# Continue a previous conversation
taskwerk ask "What did we discuss about the auth feature?"

# Use named global contexts for different topics
taskwerk ask --context work "Track this sprint planning idea"
taskwerk ask --context learning "What Python concepts should I study next?"

# Start fresh when needed
taskwerk ask --new "Let's talk about a different topic"

# Agent mode also maintains context
taskwerk agent "Continue implementing the feature we planned"
```

#### Context Display

By default, taskwerk shows which context is being used:

```
[Project: myapp] - When in a project directory
[Global: general] - Default global context
[Global: work] - Named global context
```

Use `--quiet` to hide the context display.

## 📋 Core Features

### Task Management

```bash
# Add tasks with various options
taskwerk add "Task description" \
  --priority high \
  --status in-progress \
  --tags frontend,urgent \
  --due "next friday" \
  --assigned john

# List tasks with filtering
taskwerk list --status active
taskwerk list --priority high
taskwerk list --tag backend
taskwerk list --assigned me
taskwerk list --search "auth"

# View task details
taskwerk show TASK-123

# Update tasks
taskwerk update TASK-123 --status done
taskwerk update TASK-123 --add-tag reviewed
taskwerk update TASK-123 --note "Fixed edge case with empty passwords"

# Delete tasks
taskwerk delete TASK-123
```

### Advanced Task Features

#### Task Dependencies
```bash
# Create dependent tasks
taskwerk add "Deploy to production" --depends-on TASK-100,TASK-101
```

#### Task Notes
```bash
# Add detailed notes to tasks
taskwerk update TASK-123 --note "Remember to update the documentation"
taskwerk show TASK-123 --notes
```

#### Task Search
```bash
# Full-text search across tasks
taskwerk search "authentication"
taskwerk search "bug" --status open --priority high
```

#### Task Split
```bash
# Split a large task into subtasks
taskwerk split TASK-123 \
  "Research payment providers" \
  "Implement Stripe integration" \
  "Add payment webhook handlers" \
  "Write payment tests"
```

### Import/Export

Taskwerk supports markdown-based import/export for easy sharing and backup:

```bash
# Export tasks to markdown
taskwerk export tasks.md
taskwerk export tasks.md --status active
taskwerk export tasks.md --tag sprint-42

# Import tasks from markdown
taskwerk import tasks.md
taskwerk import tasks.md --dry-run  # Preview what will be imported

# Markdown format supports:
# - Checkboxes for status
# - Tags with #hashtags
# - Priorities with !, !!, !!!
# - Metadata in YAML frontmatter
```

## 🛠️ Configuration

Taskwerk stores configuration in `~/.taskwerk/config.yml`:

```yaml
general:
  defaultPriority: medium
  defaultStatus: todo
  taskPrefix: TASK
  colors: true
  dateFormat: YYYY-MM-DD

database:
  path: ~/.taskwerk/tasks.db
  backupEnabled: true
  backupCount: 5

ai:
  defaultProvider: anthropic
  defaultModel: claude-3-5-sonnet-20241022
  providers:
    anthropic:
      api_key: ${ANTHROPIC_API_KEY}
    openai:
      api_key: ${OPENAI_API_KEY}
```

Environment variables are supported using `${VAR_NAME}` syntax.

## 📚 Advanced Usage

### Custom Workflows

Create custom task templates:

```bash
# Create a bug report template
taskwerk add "Bug: $1" --template bug \
  --priority high \
  --tags bug,needs-investigation \
  --assign qa-team
```

### Aliases and Shortcuts

```bash
# Both 'taskwerk' and 'twrk' commands are available
twrk ls          # Short for taskwerk list
twrk a "Fix bug" # Short for taskwerk add
```

### Integration with Other Tools

```bash
# Export for project management tools
taskwerk export --format json > tasks.json

# Generate reports
taskwerk list --format json | jq '.[] | select(.priority=="high")'

# Create GitHub issues
taskwerk list --tag bug --format json | \
  jq -r '.[] | "gh issue create --title \"" + .description + "\""' | sh
```

## 🏗️ Architecture

Taskwerk is built with:

- **Node.js 18+** for modern JavaScript features
- **SQLite** for fast, reliable local storage
- **Commander.js** for robust CLI parsing  
- **Chalk** for beautiful terminal output
- **Inquirer** for interactive prompts
- **Better-sqlite3** for synchronous database operations
- **YAML** for human-friendly configuration

## 🤝 Contributing

We welcome contributions! Here's how to get started:

```bash
# Clone the repository
git clone https://github.com/TaisoAI/taskwerk.git
cd taskwerk

# Install dependencies
npm install

# Run tests
npm test

# Run in development
npm run dev -- list

# Build the project
npm run build
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## 📄 License

MIT © [Taiso.ai](https://www.taiso.ai)

## 🙏 Acknowledgments

Built with ❤️ by developers, for developers. Special thanks to all contributors and the open source community.

---

**Ready to supercharge your productivity?**

```bash
npm install -g taskwerk
taskwerk init
taskwerk ask "What should I build today?"
```

Join us in making task management intelligent, efficient, and actually enjoyable. 🚀