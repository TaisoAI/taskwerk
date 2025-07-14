# Taskwerk CLI Reference

## AI Commands

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