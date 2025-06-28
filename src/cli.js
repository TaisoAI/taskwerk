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
import { syncCommand } from './commands/sync.js';
import { initCommand } from './commands/init.js';
import { askCommand } from './commands/ask.js';
import { llmConfigCommand } from './commands/llmconfig.js';

const program = new Command();

program
  .name('taskwerk')
  .description('A lightweight CLI task manager optimized for human-AI collaboration workflows')
  .version('0.1.0');

// Initialize command
program
  .command('init')
  .description('Initialize taskwerk in the current project')
  .argument('[path]', 'Path to initialize tasks (default: tasks)', 'tasks')
  .action(initCommand);

// Task management commands
program
  .command('add')
  .description('Add a new task')
  .argument('<description>', 'Task description')
  .option('-p, --priority <level>', 'Priority level (high|medium|low)', 'medium')
  .option('-c, --category <category>', 'Task category')
  .action(addCommand);

program
  .command('list')
  .description('List tasks')
  .option('-p, --priority <level>', 'Filter by priority')
  .option('-c, --category <category>', 'Filter by category (partial match)')
  .option('--completed', 'Show completed tasks')
  .option('--current', 'Show current session info')
  .action(listCommand);

program
  .command('start')
  .description('Start working on a task (mark in-progress)')
  .argument('<taskId>', 'Task ID (e.g., TASK-001)')
  .action(startCommand);

program
  .command('complete')
  .description('Mark task as completed')
  .argument('<taskId>', 'Task ID (e.g., TASK-001)')
  .option('-n, --note <note>', 'Completion note')
  .action(completeCommand);

program
  .command('pause')
  .description('Pause task (return to todo state)')
  .argument('<taskId>', 'Task ID (e.g., TASK-001)')
  .action(pauseCommand);

// Status and context commands
program.command('status').description('Show current session status').action(statusCommand);

program
  .command('context')
  .description('Show task details and related files')
  .argument('<taskId>', 'Task ID (e.g., TASK-001)')
  .action(contextCommand);

program
  .command('branch')
  .description('Create/switch to feature branch for task')
  .argument('<taskId>', 'Task ID (e.g., TASK-001)')
  .action(branchCommand);

// Search and statistics commands
program
  .command('search')
  .description('Search task descriptions')
  .argument('<query>', 'Search query')
  .action(searchCommand);

program
  .command('stats')
  .description('Show task statistics')
  .option('--format <type>', 'Output format (markdown, plain)', 'markdown')
  .action(statsCommand);

program.command('recent').description('Show recently completed tasks').action(recentCommand);

// Git integration commands
program.command('commit').description('Make commit with task context').action(commitCommand);

program.command('sync').description('Sync to GitHub (future feature)').action(syncCommand);

// LLM integration commands
program
  .command('llmconfig')
  .description('Manage LLM configuration and models')
  .option('--list-models', 'List all available models')
  .option('--model-info <model>', 'Show detailed model information')
  .option('--set-default <model>', 'Set default model for TaskWerk')
  .option('--pull <model>', 'Download model from Ollama')
  .option('--choose', 'Interactive model selection')
  .addHelpText(
    'after',
    `

Examples:
  $ taskwerk llmconfig                    # Show current LLM status and setup guide
  $ taskwerk llmconfig --list-models      # List all available models
  $ taskwerk llmconfig --choose           # Interactively choose and set a model
  $ taskwerk llmconfig --pull llama3.2    # Download llama3.2 from Ollama
  $ taskwerk llmconfig --set-default gpt-4 # Set GPT-4 as default model

Quick Setup:
  1. For OpenAI: export OPENAI_API_KEY="your-key-here"
  2. For local models: Install Ollama (https://ollama.ai) or LM Studio (https://lmstudio.ai)
  3. Run: taskwerk llmconfig --choose`
  )
  .action(llmConfigCommand);

program
  .command('ask')
  .description('Ask the AI assistant a question')
  .argument('<query>', 'Your question or request')
  .option('--model <model>', 'LLM model to use')
  .option('--verbose', 'Show token usage information')
  .action(askCommand);

// Parse command line arguments
program.parse();
