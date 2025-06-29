#!/usr/bin/env node

import { Command } from 'commander';
import { addCommand } from './commands/add.js';
import { listCommand } from './commands/list.js';
import { startCommand } from './commands/start.js';
import { completeCommand } from './commands/complete.js';
import { pauseCommand } from './commands/pause.js';
import { statusCommand } from './commands/status.js';
import { contextCommand } from './commands/context.js';
import { branchCommand } from './commands/branch.js';
import { searchCommand } from './commands/search.js';
import { statsCommand } from './commands/stats.js';
import { recentCommand } from './commands/recent.js';
import { commitCommand } from './commands/commit.js';
import { stageCommand } from './commands/stage.js';
import { syncCommand } from './commands/sync.js';
import { rulesCommand } from './commands/rules.js';
import { initCommand } from './commands/init.js';
import { askCommand } from './commands/ask.js';
import { agentCommand } from './commands/agent.js';
import { llmConfigCommand } from './commands/llmconfig.js';
import { aboutCommand } from './commands/about.js';

const program = new Command();

program
  .name('taskwerk')
  .description('A lightweight CLI task manager optimized for human-AI collaboration workflows')
  .version('0.1.5')
  .addHelpText(
    'after',
    `

🚀 Quick Start:
  $ taskwerk init                    # Set up TaskWerk in your project
  $ taskwerk add "My first task"     # Add a new task
  $ taskwerk list                    # View your tasks
  $ taskwerk start TASK-001          # Begin working on a task

🤖 AI Features:
  $ taskwerk llmconfig               # Check AI setup status and configure models
  $ taskwerk ask "show my tasks"     # Ask questions (no actions taken)
  $ taskwerk agent "add a new task"  # Perform actions via AI agent

📚 More Help:
  $ taskwerk <command> --help        # Detailed help for any command
  $ taskwerk llmconfig --list-models # See available AI models
  
Note: AI features require either an OpenAI API key or local models (Ollama/LM Studio).`
  );

// Initialize command
program
  .command('init')
  .description('Initialize TaskWerk in the current project')
  .argument('[path]', 'Path to initialize tasks (default: tasks)', 'tasks')
  .addHelpText(
    'after',
    `

Sets up TaskWerk for your project by creating:
  - tasks/ directory with tasks.md and tasks-completed.md files
  - Basic project structure and configuration

Run this once per project to get started.

Examples:
  $ taskwerk init           # Initialize in ./tasks/
  $ taskwerk init docs      # Initialize in ./docs/`
  )
  .action(initCommand);

// Task management commands
program
  .command('add')
  .description('Add a new task to the task list')
  .argument('<description>', 'Task description')
  .option('-p, --priority <level>', 'Priority level (high|medium|low)', 'medium')
  .option('-c, --category <category>', 'Task category (bugs, features, docs, etc.)')
  .addHelpText(
    'after',
    `

Creates a new task with auto-generated ID (TASK-001, TASK-002, etc.)
Tasks are added to the tasks.md file and organized by priority.

Examples:
  $ taskwerk add "Fix login bug"                    # Medium priority task
  $ taskwerk add "Add dark mode" -p high            # High priority task
  $ taskwerk add "Update README" -c docs -p low     # Categorized task`
  )
  .action(addCommand);

program
  .command('list')
  .description('List and filter tasks')
  .option('-p, --priority <level>', 'Filter by priority (high|medium|low)')
  .option('-c, --category <category>', 'Filter by category (partial match)')
  .option('--completed', 'Show completed tasks instead of active ones')
  .option('--current', 'Show current session info and active task')
  .addHelpText(
    'after',
    `

By default shows all active (non-completed) tasks organized by priority.
Use filters to narrow down the list or see completed work.

Examples:
  $ taskwerk list                    # Show all active tasks
  $ taskwerk list -p high            # Show only high priority tasks
  $ taskwerk list -c bug             # Show tasks with 'bug' in category
  $ taskwerk list --completed        # Show completed tasks
  $ taskwerk list --current          # Show session info and current task`
  )
  .action(listCommand);

program
  .command('start')
  .description('Start working on a task (mark as in-progress)')
  .argument('<taskId>', 'Task ID (e.g., TASK-001)')
  .addHelpText(
    'after',
    `

Marks a task as in-progress and sets it as your current active task.
This enables task context for commits and other features.
Only one task can be active at a time.

Examples:
  $ taskwerk start TASK-001    # Start working on TASK-001
  $ taskwerk start task-042    # Case insensitive task IDs`
  )
  .action(startCommand);

program
  .command('complete')
  .description('Mark a task as completed with detailed tracking')
  .argument('<taskId>', 'Task ID (e.g., TASK-001)')
  .option('-n, --note <note>', 'Add a completion note or summary')
  .option('-l, --level <level>', 'Detail level: basic, standard, detailed', 'standard')
  .option('--files <files>', 'Comma-separated list of files changed')
  .option('--version-impact <impact>', 'Version impact: patch, minor, major, none')
  .option('--side-effects <effects>', 'Comma-separated list of side effects')
  .option('--force', 'Force completion even if workflow validation fails')
  .option('--auto-stage', 'Force auto-staging of files after completion')
  .option('--auto-commit', 'Force auto-commit after completion')
  .addHelpText(
    'after',
    `

Moves a task from active to completed status and captures completion details.
Completed tasks are moved to tasks-completed.md file with metadata.
This information is used to generate intelligent commit messages.

Detail levels:
  - basic: Just completion timestamp
  - standard: Files changed and basic notes (default)
  - detailed: Full file analysis, side effects, version impact

Examples:
  $ taskwerk complete TASK-001                           # Standard completion
  $ taskwerk complete TASK-001 -n "Fixed login bug"     # With note
  $ taskwerk complete TASK-001 -l detailed              # Detailed tracking
  $ taskwerk complete TASK-001 --files "src/auth.js,package.json" # Specify files
  $ taskwerk complete TASK-001 --version-impact minor   # Track version impact
  $ taskwerk complete TASK-001 --force                  # Force completion despite validation failures
  $ taskwerk complete TASK-001 --auto-stage --auto-commit # Auto-stage and commit
  $ taskwerk complete TASK-001 --version-impact patch --auto-commit # Bump version and commit

Workflow Automation:
  - AI mode: Automatically bumps version and can auto-stage/commit based on rules
  - Human mode: Manual control over version bumping and commits
  - Use 'taskwerk rules' to configure automation behavior
  - Use '--auto-stage' and '--auto-commit' to force automation regardless of mode`
  )
  .action(completeCommand);

program
  .command('pause')
  .description('Pause an in-progress task (return to todo state)')
  .argument('<taskId>', 'Task ID (e.g., TASK-001)')
  .addHelpText(
    'after',
    `

Changes a task status from in-progress back to todo.
Useful when you need to switch tasks or take a break.

Examples:
  $ taskwerk pause TASK-001    # Pause current work on TASK-001`
  )
  .action(pauseCommand);

// Status and context commands
program
  .command('status')
  .description('Show current session status and active task')
  .addHelpText(
    'after',
    `

Displays:
  - Current active task (if any)
  - Session information (start time, branch, etc.)
  - Recent activity and modified files
  - Task progress summary

Example:
  $ taskwerk status    # Show current session details`
  )
  .action(statusCommand);

program
  .command('context')
  .description('Show detailed information about a specific task')
  .argument('<taskId>', 'Task ID (e.g., TASK-001)')
  .addHelpText(
    'after',
    `

Shows comprehensive task information:
  - Task description, priority, and status
  - Creation and modification dates
  - Related files and changes
  - Associated Git branches (if any)

Examples:
  $ taskwerk context TASK-001    # Show details for TASK-001`
  )
  .action(contextCommand);

program
  .command('branch')
  .description('Create or switch to a feature branch for a task')
  .argument('<taskId>', 'Task ID (e.g., TASK-001)')
  .addHelpText(
    'after',
    `

Creates a Git feature branch named after the task:
  format: feature/task-001-description

If the branch already exists, switches to it.
Helps organize work by task for better Git history.

Examples:
  $ taskwerk branch TASK-001    # Creates: feature/task-001-fix-login-bug`
  )
  .action(branchCommand);

// Search and statistics commands
program
  .command('search')
  .description('Search task descriptions and content')
  .argument('<query>', 'Search query (case-insensitive)')
  .addHelpText(
    'after',
    `

Searches through all task descriptions, both active and completed.
Uses case-insensitive partial matching.

Examples:
  $ taskwerk search "login"     # Find tasks mentioning "login"
  $ taskwerk search "bug fix"   # Find bug-related tasks`
  )
  .action(searchCommand);

program
  .command('stats')
  .description('Show task statistics and productivity metrics')
  .option('--format <type>', 'Output format (markdown, plain)', 'markdown')
  .addHelpText(
    'after',
    `

Displays comprehensive statistics:
  - Total tasks by status (todo, in-progress, completed)
  - Task breakdown by priority and category
  - Completion trends and productivity metrics
  - Recent activity summary

Examples:
  $ taskwerk stats                 # Show stats in markdown format
  $ taskwerk stats --format plain # Plain text output for scripts`
  )
  .action(statsCommand);

program
  .command('recent')
  .description('Show recently completed tasks')
  .addHelpText(
    'after',
    `

Displays the most recently completed tasks with:
  - Completion dates and times
  - Task descriptions and priorities
  - Completion notes (if any)

Useful for reviewing recent progress and accomplishments.

Example:
  $ taskwerk recent    # Show recent completions`
  )
  .action(recentCommand);

// Git integration commands
program
  .command('stage')
  .description('Review completed tasks and stage files for commit')
  .option('--auto', 'Automatically stage all changed files')
  .option('--preview', 'Show commit message preview only (default)')
  .option('--review', 'Interactive file staging (coming soon)')
  .addHelpText(
    'after',
    `

What this command does:
  - Shows all tasks completed since the last commit
  - Lists changed files that need to be staged
  - Generates a preview of the commit message
  - Optionally stages files for the next commit

This is the first step in the TaskWerk git workflow:
  1. Complete tasks: taskwerk complete TASK-XXX
  2. Stage changes: taskwerk stage --auto
  3. Create commit: taskwerk commit --auto

Examples:
  $ taskwerk stage              # Preview commit message and show options
  $ taskwerk stage --auto       # Stage all files automatically
  $ taskwerk stage --preview    # Show commit preview only`
  )
  .action(stageCommand);

program
  .command('commit')
  .description('Create intelligent Git commits from completed tasks')
  .option('--auto', 'Commit without review')
  .option('--review', 'Show commit message preview (default)')
  .option('-m, --message <msg>', 'Use custom commit message')
  .option('--version-bump <type>', 'Bump version (patch|minor|major)')
  .option('--allow-empty', 'Allow commit even if no completed tasks found')
  .addHelpText(
    'after',
    `

🔧 What this command does:
  TaskWerk commit creates intelligent Git commits by analyzing your completed tasks
  and generating conventional commit messages that document what work was done.

📋 Prerequisites:
  • Must be in a Git repository (git init if needed)
  • Need staged files for commit (use 'taskwerk stage --auto' or 'git add')
  • Have completed tasks since last commit (optional with --allow-empty)

🔄 How it works:
  1. Checks for staged files in Git working directory
  2. Finds tasks completed since your last Git commit
  3. Generates conventional commit message (feat:, fix:, docs:, etc.)
  4. Shows preview by default, commits with --auto flag
  5. Can optionally bump version numbers in package.json

📊 TaskWerk Git Workflow (Recommended):
  Step 1: Work on tasks
    $ taskwerk add "Fix login bug"
    $ taskwerk start TASK-001
    [... do your work ...]
    $ taskwerk complete TASK-001

  Step 2: Stage changes
    $ taskwerk stage --auto        # Stage files related to completed tasks
    # OR manually: git add src/auth.js

  Step 3: Review and commit
    $ taskwerk commit              # Shows preview, prompts for confirmation
    $ taskwerk commit --auto       # Commits immediately

📝 Generated commit message format:
  feat: Complete 2 tasks (or fix:, docs:, etc. based on task content)
  
  Tasks completed since last commit:
  - TASK-001: Fix login validation bug
  - TASK-002: Add user authentication
  
  Files modified:
  - src/auth.js
  - src/components/Login.tsx
  - tests/auth.test.js

🚀 Common usage patterns:
  $ taskwerk commit                        # Review message then commit (safest)
  $ taskwerk commit --auto                 # Skip preview, commit immediately
  $ taskwerk commit --review               # Force preview mode (default behavior)
  $ taskwerk commit -m "Custom message"    # Override with custom message
  $ taskwerk commit --version-bump patch   # Commit + bump patch version
  $ taskwerk commit --allow-empty          # Commit even with no completed tasks

⚠️  Troubleshooting:
  "No files staged": Run 'taskwerk stage --auto' or 'git add <files>' first
  "No completed tasks": Complete tasks with 'taskwerk complete TASK-XXX'
  "Not a git repository": Run 'git init' in your project directory
  "No changes to commit": All changes already committed, check 'git status'

💡 Pro tips:
  • Use 'taskwerk stage' to automatically stage files related to completed tasks
  • The --auto flag is great for scripting and CI/CD pipelines
  • Version bumping follows semantic versioning (patch/minor/major)
  • Custom messages with -m bypass task-based message generation
  • Commit messages follow conventional commit format for better tooling integration`
  )
  .action(commitCommand);

program
  .command('sync')
  .description('Sync tasks and commits to GitHub (future feature)')
  .addHelpText('after', '\n\nNote: This feature is not yet implemented.')
  .action(syncCommand);

program
  .command('rules')
  .description('Manage workflow rules and development hygiene enforcement')
  .option('--init', 'Initialize workflow rules system')
  .option('--status', 'Show detailed rules status')
  .option('--mode', 'Show current workflow mode (AI vs human)')
  .option('--validate <taskId>', 'Validate specific task against rules')
  .addHelpText(
    'after',
    `

What this command does:
  - Manages workflow rules for AI vs human task processing
  - Enforces development hygiene (tests, docs, quality gates)
  - Distinguishes between AI-driven and manual workflows
  - Configures quality gates and commit requirements

Workflow modes:
  - AI mode: Enforces comprehensive development workflow
  - Human mode: Minimal enforcement for manual task management

The rules system automatically detects:
  - Claude Code, Cursor, GitHub Copilot environments
  - AI agent task initiation patterns
  - Manual vs automated task processing

Examples:
  $ taskwerk rules                    # Show rules overview
  $ taskwerk rules --init             # Initialize rules system
  $ taskwerk rules --status           # Show detailed status
  $ taskwerk rules --mode             # Show current workflow mode
  $ taskwerk rules --validate TASK-001  # Validate specific task

Configuration:
  - tasks/taskwerk-rules.md   Workflow rules and documentation
  - .taskrc.json              TaskWerk configuration with rule settings`
  )
  .action(rulesCommand);

// LLM integration commands
program
  .command('llmconfig')
  .description('Manage LLM configuration and models')
  .option('--list-models', 'List all available models')
  .option('--model-info <model>', 'Show detailed model information')
  .option('--set-default <model>', 'Set default model for TaskWerk')
  .option('--model <model>', 'Set default model (alias for --set-default)')
  .option('--pull <model>', 'Download model from Ollama')
  .option('--choose', 'Interactive model selection')
  .option('--add-key <provider>', 'Add API key for provider (openai, anthropic)')
  .option('--remove-key <provider>', 'Remove API key for provider')
  .option('--list-keys', 'List configured API keys (without revealing values)')
  .option('--test-key <provider>', 'Test API key for provider')
  .addHelpText(
    'after',
    `

Examples:
  $ taskwerk llmconfig                      # Show current LLM status and setup guide
  $ taskwerk llmconfig --list-models        # List all available models
  $ taskwerk llmconfig --choose             # Interactively choose and set a model
  $ taskwerk llmconfig --model llama3.2:1b  # Set llama3.2:1b as default model
  $ taskwerk llmconfig --set-default gpt-4  # Set GPT-4 as default model
  $ taskwerk llmconfig --pull llama3.2      # Download llama3.2 from Ollama

API Key Management:
  $ taskwerk llmconfig --add-key openai     # Add OpenAI API key
  $ taskwerk llmconfig --add-key anthropic  # Add Anthropic/Claude API key
  $ taskwerk llmconfig --list-keys          # Show configured API keys
  $ taskwerk llmconfig --test-key openai    # Test OpenAI API key
  $ taskwerk llmconfig --remove-key openai  # Remove OpenAI API key

LLM Commands:
  $ taskwerk ask "what is my status?"     # Ask questions (no actions taken)
  $ taskwerk agent "show me my tasks"     # Perform actions via AI agent

Quick Setup:
  1. For cloud AI: taskwerk llmconfig --add-key openai (or --add-key anthropic)
  2. For local models: Install Ollama (https://ollama.ai) or LM Studio (https://lmstudio.ai)
  3. Run: taskwerk llmconfig --choose`
  )
  .action(llmConfigCommand);

program
  .command('ask')
  .description('Ask the AI assistant a question (no actions taken)')
  .argument('<query>', 'Your question')
  .option('--model <model>', 'LLM model to use')
  .option('--verbose', 'Show token usage information')
  .action(askCommand);

program
  .command('agent')
  .description('AI agent that can perform task management actions')
  .argument('<query>', 'Your request for actions')
  .option('--model <model>', 'LLM model to use')
  .option('--verbose', 'Show token usage information')
  .action(agentCommand);

program
  .command('about')
  .description('Show TaskWerk information, version, and project links')
  .addHelpText(
    'after',
    `

Displays comprehensive information about TaskWerk:
  - ASCII banner and version information
  - Package details and description
  - GitHub repository and npm package links
  - Author and contributor information
  - License and supported features
  - Quick start guide and help resources

Example:
  $ taskwerk about    # Show all information about TaskWerk`
  )
  .action(aboutCommand);

// Parse command line arguments
program.parse();
