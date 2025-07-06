/**
 * Status Command
 * 
 * @description Show Taskwerk status and statistics
 * @module taskwerk/cli/commands/system/status
 */

import { Command } from 'commander';
import { existsSync } from 'fs';
import { DEFAULTS } from '../../../core/constants.js';
import chalk from 'chalk';

/**
 * Creates the status command
 * @returns {Command} The status command
 */
export function makeStatusCommand() {
  return new Command('status')
    .description('Show Taskwerk status and statistics')
    .action(async () => {
      await handleStatus();
    });
}

/**
 * Handles the status command
 */
async function handleStatus() {
  const taskwerkDir = DEFAULTS.TASKWERK_DIR;
  
  // Check if initialized
  if (!existsSync(taskwerkDir)) {
    console.error(chalk.red('Error: Taskwerk is not initialized in this directory'));
    console.error(chalk.yellow('Run "twrk init" first'));
    process.exit(1);
  }

  console.log(chalk.bold('Taskwerk Status'));
  console.log(chalk.gray('─'.repeat(40)));
  
  // For now, just show that we're initialized
  // TODO: In TASK-003, show actual task counts
  console.log(`${chalk.green('✓')} Taskwerk initialized`);
  console.log(`${chalk.gray('Directory:')} ${taskwerkDir}/`);
  console.log('');
  console.log(chalk.yellow('Note: Database not yet implemented (TASK-002)'));
}