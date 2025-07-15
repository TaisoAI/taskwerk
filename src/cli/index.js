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
  .action(async id => {
    const cmd = taskStatusCommand();
    await cmd.parseAsync([id, 'done'], { from: 'user' });
  });

program
  .command('start <id>')
  .description('Mark a task as in-progress')
  .action(async id => {
    const cmd = taskStatusCommand();
    await cmd.parseAsync([id, 'in-progress'], { from: 'user' });
  });

program
  .command('block <id>')
  .description('Mark a task as blocked')
  .action(async id => {
    const cmd = taskStatusCommand();
    await cmd.parseAsync([id, 'blocked'], { from: 'user' });
  });

program.parse(process.argv);
