import { Command } from 'commander';
import { createRequire } from 'module';
import { aboutCommand } from '../commands/about.js';
import { taskCommand } from '../commands/task/index.js';
import { initCommand } from '../commands/init.js';
import { statusCommand } from '../commands/status.js';
import { configCommand } from '../commands/config.js';
import { exportCommand } from '../commands/export.js';
import { importCommand } from '../commands/import.js';
import { gitCommand } from '../commands/git/index.js';
import { aiconfigCommand } from '../commands/aiconfig.js';
import { llmCommand } from '../commands/llm.js';
import { ErrorHandler } from '../errors/index.js';

const require = createRequire(import.meta.url);
const packageJson = require('../../package.json');

const program = new Command();

program
  .name('taskwerk')
  .description(packageJson.description)
  .version(packageJson.version)
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
program.addCommand(taskCommand());
program.addCommand(initCommand());
program.addCommand(statusCommand());
program.addCommand(configCommand());
program.addCommand(exportCommand());
program.addCommand(importCommand());
program.addCommand(gitCommand());
program.addCommand(aiconfigCommand());
program.addCommand(llmCommand());

program.parse(process.argv);
