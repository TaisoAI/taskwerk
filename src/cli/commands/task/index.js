/**
 * Task Commands
 * 
 * @description Task management subcommands
 * @module taskwerk/cli/commands/task
 */

import { Command } from 'commander';
import { makeAddCommand } from './add.js';
import { makeListCommand } from './list.js';
import { makeShowCommand } from './show.js';
import { makeUpdateCommand } from './update.js';
import { makeDeleteCommand } from './delete.js';
import { makeStatusCommand } from './status.js';

/**
 * Creates the task command with all subcommands
 * @returns {Command} The task command
 */
export function makeTaskCommand() {
  const taskCommand = new Command('task')
    .description('Manage tasks');

  // Add subcommands
  taskCommand.addCommand(makeAddCommand());
  taskCommand.addCommand(makeListCommand());
  taskCommand.addCommand(makeShowCommand());
  taskCommand.addCommand(makeUpdateCommand());
  taskCommand.addCommand(makeDeleteCommand());
  taskCommand.addCommand(makeStatusCommand());

  return taskCommand;
}

// Export individual commands for direct use
export {
  makeAddCommand,
  makeListCommand,
  makeShowCommand,
  makeUpdateCommand,
  makeDeleteCommand,
  makeStatusCommand
};