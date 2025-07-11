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

const require = createRequire(import.meta.url);
const packageJson = require('../../package.json');

const program = new Command();

program
  .name('taskwerk')
  .description(packageJson.description)
  .version(packageJson.version)
  .helpOption('-h, --help', 'Display help for command')
  .addHelpCommand('help [command]', 'Display help for command');

// Add all commands
program.addCommand(aboutCommand());
program.addCommand(taskCommand());
program.addCommand(initCommand());
program.addCommand(statusCommand());
program.addCommand(configCommand());
program.addCommand(exportCommand());
program.addCommand(importCommand());
program.addCommand(gitCommand());

program.parse(process.argv);
