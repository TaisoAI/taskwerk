# Taskwerk CLI Reference

## AI Commands

### `taskwerk ask [question]`

Ask the AI assistant questions about your tasks and project. The assistant has read-only access and maintains conversation history.

**Usage:**
```bash
# Ask about tasks
taskwerk ask "What are my high priority tasks?"

# Include file context
taskwerk ask "How does this relate to the spec?" -f spec.md

# Include current tasks
taskwerk ask "What's the status of the backend work?" -t

# Use named conversation
taskwerk ask --context work "What did we discuss yesterday?"

# Start a new conversation
taskwerk ask --new "Let's talk about testing strategies"
```

**Options:**
- `-f, --file <path>` - Include file content in context
- `-t, --tasks` - Include current tasks in context
- `--context <name>` - Use named global conversation
- `--new` - Start a new conversation
- `--provider <name>` - Override AI provider
- `--model <name>` - Override AI model
- `--no-tools` - Disable tool usage
- `--verbose` - Show detailed execution info
- `--quiet` - Hide context display

### `taskwerk agent [instruction]`

AI agent that can read, write files and manage tasks. Maintains separate conversation history from ask mode.

**Usage:**
```bash
# Create and manage tasks
taskwerk agent "Create tasks for the authentication feature"

# Organize existing tasks
taskwerk agent "Group related tasks and add appropriate tags"

# Generate from specifications
taskwerk agent "Create tasks from requirements.md" -f requirements.md

# Continue previous work
taskwerk agent "Continue implementing the feature we discussed"
```

**Options:**
- `-f, --file <path>` - Include file content in context
- `-t, --tasks` - Include current tasks in context
- `--context <name>` - Use named global conversation
- `--new` - Start a new conversation
- `--provider <name>` - Override AI provider
- `--model <name>` - Override AI model
- `--max-iterations <n>` - Maximum agent iterations (default: 10)
- `--yolo` - Skip permission prompts (use with caution!)
- `--verbose` - Show detailed execution info
- `--quiet` - Hide context display

### `taskwerk aiconfig`

Configure AI providers and models.

**Usage:**
```bash
# Interactive configuration
taskwerk aiconfig --choose

# Set provider and model directly
taskwerk aiconfig --provider ollama --model llama3.1:latest

# Configure API keys
taskwerk aiconfig --set anthropic.api_key=sk-ant-...
taskwerk aiconfig --set openai.api_key=sk-proj-...

# Show current configuration
taskwerk aiconfig --show

# Test connections
taskwerk aiconfig --test
```

**Options:**
- `--set <key=value>` - Set a configuration value
- `--global` - Apply to global config
- `--local` - Apply to local config (default)
- `--list-providers` - List available AI providers
- `--list-models [provider]` - List available models
- `--choose` - Interactively choose provider and model
- `--provider <name>` - Set the current provider
- `--model <name>` - Set the current model
- `--test` - Test connection to configured providers
- `--show` - Show current AI configuration
- `--show-origin` - Show config with source information

### `taskwerk llm [prompt]`

Send a prompt directly to the configured LLM.

**Usage:**
```bash
# Basic usage
taskwerk llm "What is 2+2?"

# Pipe input
echo "Explain this code" | taskwerk llm

# Read from file
taskwerk llm -f prompt.txt

# With parameter substitution
taskwerk llm "Summarize {topic}" -p topic="machine learning"
```

**Options:**
- `-f, --file <path>` - Read prompt from file
- `-p, --params <key=value...>` - Parameters for prompt substitution
- `--provider <name>` - Override provider for this request
- `--model <name>` - Override model for this request
- `-s, --system <prompt>` - System prompt
- `--temperature <num>` - Override temperature (0-2)
- `--max-tokens <num>` - Override max tokens (default: 8192)
- `--context-tasks` - Include current tasks as context
- `--no-stream` - Disable streaming output
- `--raw` - Output raw response without formatting
- `--verbose` - Show metadata (provider, model, token usage)

**Examples:**
```bash
# Simple query
taskwerk llm "What is a cat?"

# With specific model
taskwerk llm "Explain quantum computing" --provider openai --model gpt-4

# JSON output with no metadata
taskwerk llm "Return a JSON array of 3 colors" --raw

# Show token usage
taskwerk llm "Write a haiku" --verbose

# Use with other tools
taskwerk list | taskwerk llm "Summarize these tasks"
```

### `taskwerk aiconfig`

Configure AI providers and models.

**Usage:**
```bash
# Interactive provider selection
taskwerk aiconfig --choose

# Test connections
taskwerk aiconfig --test

# Set configuration
taskwerk aiconfig --set anthropic.api_key=sk-ant-...

# Show current configuration
taskwerk aiconfig --show
```

**Options:**
- `--choose` - Interactively choose provider and model
- `--test` - Test connection to configured providers
- `--show` - Show current AI configuration
- `--set <key=value>` - Set a configuration value
- `--provider <name>` - Set the current provider
- `--model <name>` - Set the current model

## Task Commands

### `taskwerk add <name>`

Create a new task.

**Options:**
- `-p, --priority <level>` - Set priority (high, medium, low)
- `-a, --assignee <name>` - Assign to someone
- `-c, --category <name>` - Set category
- `-t, --tags <tags...>` - Add tags
- `-n, --note <text>` - Add a note
- `--parent <id>` - Set parent task

### `taskwerk list`

List tasks with various filters.

**Options:**
- `-s, --status <status...>` - Filter by status
- `-p, --priority <level...>` - Filter by priority
- `-a, --assignee <name>` - Filter by assignee
- `-c, --category <name>` - Filter by category
- `-t, --tags <tags...>` - Filter by tags
- `--limit <n>` - Limit results
- `--offset <n>` - Skip first n results

### `taskwerk update <id>`

Update an existing task.

**Options:**
- `-n, --name <name>` - Update name
- `-s, --status <status>` - Update status
- `-p, --priority <level>` - Update priority
- `-a, --assignee <name>` - Update assignee
- `-c, --category <name>` - Update category
- `--add-tags <tags...>` - Add tags
- `--remove-tags <tags...>` - Remove tags
- `--note <text>` - Add a note

### `taskwerk show <id>`

Show detailed information about a task.

### `taskwerk delete <id>`

Delete a task.

### `taskwerk search <query>`

Search tasks by text.

**Options:**
- `--fields <fields...>` - Fields to search in
- All list command filters apply

### `taskwerk split <id>`

Split a task into subtasks.

**Options:**
- `-s, --subtasks <names...>` - Names for subtasks
- `-i, --interactive` - Interactive mode

## Data Commands

### `taskwerk export`

Export tasks to markdown.

**Options:**
- `-o, --output <file>` - Output file (default: stdout)
- `-f, --format <format>` - Export format (markdown)
- All list command filters apply

### `taskwerk import <file>`

Import tasks from markdown.

**Options:**
- `--dry-run` - Preview without importing
- `--merge` - Merge with existing tasks

## Git Commands

### `taskwerk branch`

Create a branch for a task.

**Options:**
- `-t, --task <id>` - Task ID
- `-n, --name <name>` - Branch name

### `taskwerk commit`

Create a commit with task context.

**Options:**
- `-t, --task <id>` - Related task ID
- `-m, --message <msg>` - Commit message

## Context Management Commands

### `taskwerk context`

Manage chat conversations (contexts) for ask and agent modes.

### `taskwerk context list`

List all your chat conversations.

**Usage:**
```bash
# List all active conversations
taskwerk context list

# Show only global conversations
taskwerk context list --global

# Show only project conversations
taskwerk context list --project

# Include older/inactive conversations
taskwerk context list --all

# Filter by type
taskwerk context list --type ask
```

**Options:**
- `-g, --global` - Show only global conversations
- `-p, --project` - Show only project conversations
- `-t, --type <type>` - Filter by type (ask/agent)
- `--all` - Include inactive conversations

### `taskwerk context show [id]`

Show conversation history. If no ID provided, shows current conversation.

**Usage:**
```bash
# Show current conversation
taskwerk context show

# Show specific conversation by ID or name
taskwerk context show CHAT-001
taskwerk context show work

# Limit messages shown
taskwerk context show --limit 10

# Show entire history
taskwerk context show --all
```

**Options:**
- `-n, --limit <number>` - Number of messages to show (default: 20)
- `--all` - Show entire conversation history

### `taskwerk context switch <name>`

Switch to a different conversation (provides instructions on how to use it).

**Usage:**
```bash
taskwerk context switch work
taskwerk context switch CHAT-003
```

### `taskwerk context rename <id> <new-name>`

Rename a conversation.

**Usage:**
```bash
taskwerk context rename CHAT-001 "sprint-planning"
taskwerk context rename general "daily-standup"
```

### `taskwerk context delete <id>`

Delete a conversation and its history.

**Usage:**
```bash
# Delete with confirmation
taskwerk context delete old-discussion

# Delete without confirmation
taskwerk context delete CHAT-005 --force
```

**Options:**
- `-f, --force` - Skip confirmation prompt

## Other Commands

### `taskwerk init`

Initialize a new Taskwerk project.

### `taskwerk status`

Show project status summary.

### `taskwerk config`

Manage configuration.

**Options:**
- `--get <key>` - Get a config value
- `--set <key=value>` - Set a config value
- `--list` - List all config

### `taskwerk about`

Show version and system information.