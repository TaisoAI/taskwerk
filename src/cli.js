#!/usr/bin/env node

/**
 * TaskWerk CLI Entry Point (Transitional)
 *
 * This file provides backward compatibility while transitioning to the new v3 CLI framework.
 * It detects which CLI mode to use based on command and environment.
 */

import { registry } from './cli/command-registry.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Legacy CLI imports (for backward compatibility)
import { Command } from 'commander';
import { addCommand } from './commands/add.js';
import { listCommand } from './commands/list.js';
import { startCommand } from './commands/start.js';
import { completeCommand } from './commands/complete.js';
import { pauseCommand } from './commands/pause.js';
import { archiveCommand } from './commands/archive.js';
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

const __dirname = dirname(fileURLToPath(import.meta.url));

const program = new Command();

program
  .name('taskwerk')
  .description('A lightweight CLI task manager optimized for human-AI collaboration workflows')
  .version('0.2.0')
  .addHelpText(
    'after',
    `

🚀 Quick Start:
  $ taskwerk init                    # Set up taskwerk in your project
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
  .description('Initialize taskwerk in the current project')
  .argument('[path]', 'Path to initialize tasks (default: tasks)', 'tasks')
  .addHelpText(
    'after',
    `

Sets up taskwerk for your project by creating:
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
  .option('--archived', 'Show archived tasks instead of active ones')
  .option('--all-closed', 'Show both completed and archived tasks')
  .option('--current', 'Show current session info and active task')
  .addHelpText(
    'after',
    `

By default shows all active (non-completed) tasks organized by priority.
Use filters to narrow down the list or see completed/archived work.

Examples:
  $ taskwerk list                    # Show all active tasks
  $ taskwerk list -p high            # Show only high priority tasks
  $ taskwerk list -c bug             # Show tasks with 'bug' in category
  $ taskwerk list --completed        # Show completed tasks only
  $ taskwerk list --archived         # Show archived tasks only
  $ taskwerk list --all-closed       # Show both completed and archived tasks
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

program
  .command('archive')
  .description('Archive a task with a reason (moves to completed tasks as archived)')
  .argument('<taskId>', 'Task ID (e.g., TASK-001)')
  .option('-r, --reason <reason>', 'Required: Reason for archiving the task')
  .option('-s, --superseded-by <taskId>', 'Task ID that supersedes this one')
  .option('-n, --note <note>', 'Additional note about the archival')
  .addHelpText(
    'after',
    `

Archives a task when it's no longer needed, rather than completing it.
Archived tasks are moved to tasks_completed.md with [~] status and detailed reason.
This maintains a complete audit trail while removing clutter from active tasks.

Common use cases:
  - Requirements changed and task is no longer needed
  - Task was duplicate of another task
  - Task was superseded by a different approach
  - Task became obsolete due to external changes

Examples:
  $ taskwerk archive TASK-001 --reason "Requirements changed after client meeting"
  $ taskwerk archive TASK-001 --reason "Duplicate of TASK-042" --superseded-by TASK-042
  $ taskwerk archive TASK-001 --reason "Feature removed from scope" --note "May revisit in Q3"
  $ taskwerk archive TASK-001 -r "No longer needed" -s TASK-050

Archive vs Complete:
  - Complete: Task was successfully finished (use 'taskwerk complete')
  - Archive: Task was cancelled/obsolete (use 'taskwerk archive')

Archived tasks are searchable and maintain full history in the completed tasks file.`
  )
  .action(archiveCommand);

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
  - Complete task description (full text, no truncation)
  - Priority, status, and category information
  - Creation and modification dates
  - Related files and changes
  - Associated Git branches (if any)
  - Current session information

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

⚠️  WARNING: This command creates/switches Git branches automatically!

🔧 What this command does:
  1. Creates a new Git branch named: feature/task-{id}-{description}
  2. If the branch already exists, switches to it
  3. Updates your current working directory to that branch

📋 Prerequisites:
  • Must be in a Git repository
  • Recommended: commit or stash current changes first

⚠️  Branch Management Warnings:
  • Each task creates a separate branch - you may end up with many branches
  • Be aware of which branch you're on when making commits
  • Consider if you really need separate branches for each task
  • Use 'git branch' to see all branches and 'git status' to see current branch

🔄 Recommended workflow if using branches:
  Step 1: Check your current state
    $ git status                    # See current branch and changes
    $ git commit -am "save work"    # Commit current work if needed

  Step 2: Create task branch
    $ taskwerk branch TASK-001      # Creates: feature/task-001-fix-login-bug

  Step 3: Work on the task
    $ taskwerk start TASK-001
    [... do your work ...]
    $ taskwerk complete TASK-001

  Step 4: Commit and merge
    $ git add .
    $ taskwerk commit --auto
    $ git checkout main             # Switch back to main
    $ git merge feature/task-001-fix-login-bug

🚀 Examples:
  $ taskwerk branch TASK-001      # Creates: feature/task-001-fix-login-bug
  $ taskwerk branch TASK-002      # Creates: feature/task-002-add-dark-mode

💡 Alternative (simpler) workflow:
  Many users prefer to work on main branch and use taskwerk for task tracking
  without creating separate Git branches. Consider if you really need branches
  for each task, as it can complicate your Git workflow.

  Simple approach:
    $ taskwerk add "Fix login bug"
    $ taskwerk start TASK-001
    [... work on main branch ...]
    $ taskwerk complete TASK-001
    $ git add . && taskwerk commit --auto`
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
Uses case-insensitive partial matching across full task descriptions.
Searches complete text content without truncation.

Examples:
  $ taskwerk search "login"       # Find tasks mentioning "login"
  $ taskwerk search "bug fix"     # Find bug-related tasks
  $ taskwerk search "instead of"  # Matches anywhere in description text`
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

This is the first step in the taskwerk git workflow:
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
  .description('Generate intelligent Git commit messages from completed tasks')
  .option('--auto', 'Actually execute git commit after showing preview')
  .option('--review', 'Show commit message preview only (default)')
  .option('-m, --message <msg>', 'Use custom commit message instead of generating one')
  .option('--version-bump <type>', 'Bump version in package.json (patch|minor|major)')
  .option('--allow-empty', 'Allow commit even if no completed tasks found')
  .addHelpText(
    'after',
    `

⚠️  IMPORTANT: By default, this command ONLY shows a preview - it does NOT commit!

🔧 What this command does:
  1. Analyzes your completed tasks since the last Git commit
  2. Generates an intelligent conventional commit message
  3. Shows you a preview of the message
  4. STOPS without committing (unless you use --auto)

📋 Prerequisites:
  • Must be in a Git repository (run 'git init' if needed)
  • Files must be staged first (run 'git add <files>' before this command)
  • Have completed tasks since last commit (or use --allow-empty)

🔄 Safe workflow:
  Step 1: Do your work and complete tasks
    $ taskwerk add "Fix login bug"
    $ taskwerk start TASK-001
    [... do your development work ...]
    $ taskwerk complete TASK-001 --note "Fixed session timeout logic"

  Step 2: Stage your changes manually
    $ git add src/auth.js tests/auth.test.js

  Step 3: Generate and review commit message
    $ taskwerk commit              # Shows preview, does NOT commit

  Step 4: Commit if you approve
    $ taskwerk commit --auto       # Actually executes git commit
    # OR use regular git: git commit -m "your own message"

📝 Generated message format:
  feat: Fix login bug (or fix:, docs:, etc. based on task content)
  
  Tasks completed since last commit:
  - TASK-001: Fix login bug
  
  Files modified:
  - src/auth.js
  - tests/auth.test.js

🚀 Usage patterns:
  $ taskwerk commit                        # Preview only (SAFE - no commit)
  $ taskwerk commit --auto                 # Preview + actually commit
  $ taskwerk commit -m "Custom message"    # Use custom message + commit
  $ taskwerk commit --version-bump patch   # Bump version + commit
  $ taskwerk commit --allow-empty          # Commit even with no completed tasks

⚠️  Git Safety:
  • This command never stages files for you - always use 'git add' first
  • Default behavior is preview-only - your code won't be committed unexpectedly
  • Use --auto when you're confident in the generated message
  • You can always use regular 'git commit -m "message"' instead

💡 Pro tips:
  • Run 'git status' first to see what files will be committed
  • Use the preview to understand what taskwerk detected as changes
  • Custom messages with -m skip the task-based generation entirely
  • Version bumping updates package.json before committing`
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
  - .taskrc.json              taskwerk configuration with rule settings`
  )
  .action(rulesCommand);

// LLM integration commands
program
  .command('llmconfig')
  .description('Manage LLM configuration and models')
  .option('--list-models', 'List all available models')
  .option('--model-info <model>', 'Show detailed model information')
  .option('--set-default <model>', 'Set default model for taskwerk')
  .option('--model <model>', 'Set default model (alias for --set-default)')
  .option('--pull <model>', 'Download model from Ollama')
  .option('--choose', 'Interactive model selection')
  .option('--add-key <provider>', 'Add API key for provider. Specify: openai OR anthropic')
  .option('--remove-key <provider>', 'Remove API key for provider. Specify: openai OR anthropic')
  .option('--list-keys', 'List configured API keys (without revealing values)')
  .option('--test-key <provider>', 'Test API key for provider. Specify: openai OR anthropic')
  .addHelpText(
    'after',
    `

🔧 Configuration Examples:
  $ taskwerk llmconfig                      # Show current LLM status and setup guide
  $ taskwerk llmconfig --list-models        # List all available models
  $ taskwerk llmconfig --choose             # Interactively choose and set a model
  $ taskwerk llmconfig --model llama3.2:1b  # Set llama3.2:1b as default model
  $ taskwerk llmconfig --set-default gpt-4  # Set GPT-4 as default model
  $ taskwerk llmconfig --pull llama3.2      # Download llama3.2 from Ollama

🔑 API Key Management:
To use cloud AI models (GPT-4, Claude), you need to store API keys securely.
You MUST specify the provider (openai or anthropic) when managing keys:

  $ taskwerk llmconfig --add-key openai     # Will prompt: "Enter your OpenAI API key:"
  $ taskwerk llmconfig --add-key anthropic  # Will prompt: "Enter your Anthropic API key:"
  $ taskwerk llmconfig --list-keys          # Show which keys are configured (masked)
  $ taskwerk llmconfig --test-key openai    # Test if OpenAI key works
  $ taskwerk llmconfig --remove-key openai  # Remove stored OpenAI key

⚠️  Provider must be specified: 'openai' for GPT models, 'anthropic' for Claude models

Keys are stored securely in ~/.taskwerk/keys.json and take priority over environment variables.

🚀 Quick Setup:
  1. For GPT-4/OpenAI: Get API key from https://platform.openai.com/api-keys
                       Run: taskwerk llmconfig --add-key openai
  2. For Claude:       Get API key from https://console.anthropic.com/
                       Run: taskwerk llmconfig --add-key anthropic
  3. For local models: Install Ollama (https://ollama.ai) or LM Studio (https://lmstudio.ai)
  4. Run: taskwerk llmconfig --choose      # Select your preferred model`
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
  .description('Show taskwerk information, version, and project links')
  .addHelpText(
    'after',
    `

Displays comprehensive information about taskwerk:
  - ASCII banner and version information
  - Package details and description
  - GitHub repository and npm package links
  - Author and contributor information
  - License and supported features
  - Quick start guide and help resources

Example:
  $ taskwerk about    # Show all information about taskwerk`
  )
  .action(aboutCommand);

/**
 * Determine if we should use the new v3 CLI framework
 */
function shouldUseV3CLI(args) {
  // Commands that have been converted to v3 framework
  const v3Commands = ['init', 'add', 'list', 'get', 'import', 'export'];

  // Check if first argument is a v3 command
  if (args.length > 0 && v3Commands.includes(args[0])) {
    return true;
  }

  // Check environment variable for forcing v3 mode
  if (process.env.TASKWERK_CLI_V3 === 'true') {
    return true;
  }

  // Default to legacy CLI for now
  return false;
}

/**
 * Configure global options for v3 CLI
 */
function configureV3GlobalOptions() {
  registry
    .globalOption('-h, --help', 'Show help information')
    .globalOption('-v, --version', 'Show version information')
    .globalOption('-f, --format <format>', 'Output format (pretty, plain, json)', 'pretty')
    .globalOption('-q, --quiet', 'Suppress non-essential output')
    .globalOption('--verbose', 'Show detailed output')
    .globalOption('--debug', 'Show debug information')
    .globalOption('--no-color', 'Disable colored output')
    .globalOption('--config <path>', 'Path to configuration file');
}

/**
 * Run the v3 CLI framework
 */
async function runV3CLI(args) {
  try {
    // Configure global options
    configureV3GlobalOptions();

    // Load all commands from the commands directory
    const commandsDir = join(__dirname, 'commands');
    await registry.loadCommandsFromDirectory(commandsDir);

    // Handle no-color option early
    if (args.includes('--no-color')) {
      process.env.FORCE_COLOR = '0';
    }

    // Execute the command
    const exitCode = await registry.execute(args);
    process.exit(exitCode);
  } catch (error) {
    console.error('Fatal error:', error.message);
    if (process.env.DEBUG || args.includes('--debug')) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

/**
 * Run the legacy CLI
 */
function runLegacyCLI() {
  program.parse();
}

/**
 * Main CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);

  if (shouldUseV3CLI(args)) {
    await runV3CLI(args);
  } else {
    runLegacyCLI();
  }
}

// Handle uncaught errors
process.on('uncaughtException', error => {
  console.error('Uncaught exception:', error.message);
  if (process.env.DEBUG) {
    console.error(error.stack);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled promise rejection:', reason);
  if (process.env.DEBUG) {
    console.error('Promise:', promise);
  }
  process.exit(1);
});

// Run the CLI
main().catch(error => {
  console.error('CLI initialization failed:', error.message);
  process.exit(1);
});
