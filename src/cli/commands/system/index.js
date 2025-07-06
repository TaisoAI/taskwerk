/**
 * System Commands
 * 
 * @description System-level commands like init, status, config
 * @module taskwerk/cli/commands/system
 */

import { Command } from 'commander';
import { makeInitCommand } from './init.js';
import { makeStatusCommand } from './status.js';
import { makeAboutCommand } from './about.js';

/**
 * Creates the system command group
 * @returns {Command} The system command
 */
export function makeSystemCommand() {
  const cmd = new Command('system')
    .alias('sys')
    .description('System management commands');

  // Add subcommands
  cmd.addCommand(makeInitCommand());
  cmd.addCommand(makeStatusCommand());
  cmd.addCommand(makeAboutCommand());

  return cmd;
}

// Also export individual commands for direct use
export { makeInitCommand } from './init.js';
export { makeStatusCommand } from './status.js';
export { makeAboutCommand } from './about.js';