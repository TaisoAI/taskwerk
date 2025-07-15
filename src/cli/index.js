import { Command } from 'commander';
import { aboutCommand } from '../commands/about.js';
import { initCommand } from '../commands/init.js';
import { statusCommand } from '../commands/status.js';
import { configCommand } from '../commands/config.js';
import { exportCommand } from '../commands/export.js';
import { importCommand } from '../commands/import.js';
import { aiconfigCommand } from '../commands/aiconfig.js';
import { llmCommand } from '../commands/llm.js';
import { askCommand } from '../commands/ask.js';
import { agentCommand } from '../commands/agent.js';
// Import individual task commands directly
import { taskAddCommand } from '../commands/task/add.js';
import { taskListCommand } from '../commands/task/list.js';
import { taskShowCommand } from '../commands/task/show.js';
import { taskUpdateCommand } from '../commands/task/update.js';
import { taskDeleteCommand } from '../commands/task/delete.js';
import { taskStatusCommand } from '../commands/task/status.js';
import { taskSplitCommand } from '../commands/task/split.js';
import { ErrorHandler } from '../errors/index.js';
import packageInfo from '../version.js';

const program = new Command();

program
  .name(packageInfo.name)
  .description(packageInfo.description)
  .version(packageInfo.version)
  .helpOption('-h, --help', 'Display help for command')
  .addHelpCommand('help [command]', 'Display help for command')
  .option('--verbose-error', 'Output detailed error information in JSON format for automation')
  .addHelpText(
    'after',
    `
Quick Start:
  $ twrk init                              # Initialize taskwerk in current directory
  $ twrk addtask "Fix login bug"           # Create your first task
  $ twrk listtask                          # View all tasks
  $ twrk showtask 1                        # Show details for task 1

Common Workflows:
  Task Management:
    $ twrk addtask "New feature" -p high -a @john
    $ twrk updatetask 1 -s in-progress
    $ twrk done 1                          # Mark task as done
    
  AI/LLM Integration:
    $ twrk export -t 1 2 3 --stdout | pbcopy      # Copy tasks to clipboard
    $ twrk updatetask 1 -a @ai-agent              # Assign to AI
    $ twrk export -a @ai-agent -o ai-tasks.md     # Export AI's tasks
    
  Bulk Operations:
    $ twrk export -s todo                          # Export all todo tasks
    $ twrk listtask -s blocked --format json       # List blocked tasks as JSON

Key Features:
  • Fuzzy ID matching: Use '1' instead of 'TASK-001'
  • Case-insensitive: 'task-1', 'TASK-1', 'Task-1' all work
  • Rich markdown export perfect for LLMs
  • Subtask support with parent-child relationships
  • Comprehensive tagging and filtering

For more help:
  $ twrk <command> --help                  # Detailed help for any command
  $ twrk about                             # Learn more about taskwerk

Tip: Task IDs support fuzzy matching - just use the number!`
  )
  .hook('preAction', thisCommand => {
    // Set up error handling before any command executes
    process.on('uncaughtException', error => {
      ErrorHandler.handle(error, thisCommand.name());
    });
    process.on('unhandledRejection', error => {
      ErrorHandler.handle(error, thisCommand.name());
    });
  });

// Add all commands
program.addCommand(aboutCommand());
program.addCommand(initCommand());
program.addCommand(statusCommand());
program.addCommand(configCommand());
program.addCommand(exportCommand());
program.addCommand(importCommand());
program.addCommand(aiconfigCommand());
program.addCommand(llmCommand());
program.addCommand(askCommand());
program.addCommand(agentCommand());

// Add task commands as root-level commands with 'task' suffix
const addTask = taskAddCommand();
addTask.name('addtask');
program.addCommand(addTask);

const listTask = taskListCommand();
listTask.name('listtask');
program.addCommand(listTask);

const showTask = taskShowCommand();
showTask.name('showtask');
program.addCommand(showTask);

const updateTask = taskUpdateCommand();
updateTask.name('updatetask');
program.addCommand(updateTask);

const deleteTask = taskDeleteCommand();
deleteTask.name('deletetask');
program.addCommand(deleteTask);

const statusTask = taskStatusCommand();
statusTask.name('statustask');
program.addCommand(statusTask);

const splitTask = taskSplitCommand();
splitTask.name('splittask');
program.addCommand(splitTask);

// Add quick status commands
program
  .command('done <id>')
  .description('Mark a task as done')
  .addHelpText(
    'after',
    `
Examples:
  $ twrk done 1                    # Mark task 1 as done
  $ twrk done TASK-001             # Use full ID
  $ twrk done task-5               # Case-insensitive
  
This is a shortcut for: twrk statustask <id> done`
  )
  .action(async id => {
    const cmd = taskStatusCommand();
    await cmd.parseAsync([id, 'done'], { from: 'user' });
  });

program
  .command('start <id>')
  .description('Mark a task as in-progress')
  .addHelpText(
    'after',
    `
Examples:
  $ twrk start 1                   # Start working on task 1
  $ twrk start TASK-001            # Use full ID
  $ twrk start 5                   # Fuzzy matching works
  
This is a shortcut for: twrk statustask <id> in-progress`
  )
  .action(async id => {
    const cmd = taskStatusCommand();
    await cmd.parseAsync([id, 'in-progress'], { from: 'user' });
  });

program
  .command('block <id>')
  .description('Mark a task as blocked')
  .addHelpText(
    'after',
    `
Examples:
  $ twrk block 1                   # Mark task 1 as blocked
  $ twrk block TASK-001            # Use full ID
  $ twrk block 3                   # Quick blocking
  
This is a shortcut for: twrk statustask <id> blocked
Tip: Use 'twrk statustask <id> blocked --note "reason"' to add context`
  )
  .action(async id => {
    const cmd = taskStatusCommand();
    await cmd.parseAsync([id, 'blocked'], { from: 'user' });
  });

program.parse(process.argv);
