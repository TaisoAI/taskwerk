import { Command } from 'commander';
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
import { askCommand } from '../commands/ask.js';
import { agentCommand } from '../commands/agent.js';
import { ErrorHandler } from '../errors/index.js';

// These constants are injected during build via global variables
const packageJson = {
  version: global.__PACKAGE_VERSION__ || '0.6.5.1',
  description: global.__PACKAGE_DESCRIPTION__ || 'A task management CLI for developers and AI agents working together',
  name: global.__PACKAGE_NAME__ || 'taskwerk'
};

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
program.addCommand(askCommand());
program.addCommand(agentCommand());

program.parse(process.argv);
