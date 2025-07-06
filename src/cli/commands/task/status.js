/**
 * Task Status Command
 * 
 * @description Change task status with validation
 * @module taskwerk/cli/commands/task/status
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { TaskwerkAPI } from '../../../core/api.js';
import { initializeStorage } from '../../../storage/index.js';
import { TaskStatus } from '../../../core/constants.js';

/**
 * Creates the task status command
 * @returns {Command} The status command
 */
export function makeStatusCommand() {
  return new Command('status')
    .description('Change task status')
    .argument('<id>', 'Task ID')
    .argument('<status>', 'New status (todo, active, paused, blocked, completed, archived)')
    .option('-r, --reason <reason>', 'Reason for status change (required for blocked)')
    .option('-c, --cascade', 'Cascade status change to child tasks')
    .action(async (id, status, options) => {
      await handleStatus(id, status, options);
    });
}

/**
 * Handles the task status command
 * @param {string} id - Task ID
 * @param {string} status - New status
 * @param {Object} options - Command options
 */
async function handleStatus(id, status, options) {
  try {
    // Initialize storage and API
    const storage = await initializeStorage();
    const api = new TaskwerkAPI({ database: storage.db });

    // Normalize status
    status = status.toLowerCase();
    
    // Validate status
    if (!Object.values(TaskStatus).includes(status)) {
      console.error(chalk.red(`Error: Invalid status '${status}'`));
      console.error(chalk.gray(`Valid statuses: ${Object.values(TaskStatus).join(', ')}`));
      process.exit(1);
    }

    // Get current task to show transition
    const currentTask = await api.getTask(id);
    if (!currentTask) {
      console.error(chalk.red(`Error: Task '${id}' not found`));
      process.exit(1);
    }

    // Check if blocked and needs reason
    if (status === TaskStatus.BLOCKED && !options.reason) {
      console.error(chalk.red('Error: Blocked reason is required'));
      console.error(chalk.gray('Use: taskwerk task status <id> blocked --reason "waiting for..."'));
      process.exit(1);
    }

    // Change status
    const result = await api.changeTaskStatus(id, status, {
      reason: options.reason,
      cascade: options.cascade
    });

    // Show success message
    console.log(chalk.green(
      `✓ Changed task ${chalk.bold(currentTask.string_id)} status: ` +
      `${formatStatus(currentTask.status)} → ${formatStatus(status)}`
    ));

    // Show reason if blocked
    if (status === TaskStatus.BLOCKED && options.reason) {
      console.log(chalk.gray(`  Blocked reason: ${options.reason}`));
    }

    // Show cascade effects if any
    if (result.transition.sideEffects && result.transition.sideEffects.length > 0) {
      console.log(chalk.yellow('\nCascade effects:'));
      for (const effect of result.transition.sideEffects) {
        if (effect.type === 'child_transition') {
          console.log(chalk.yellow(
            `  - ${effect.childStringId}: ${effect.oldStatus} → ${effect.newStatus}`
          ));
        }
      }
    }

    // Close storage
    storage.close();
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Format status with color
 * @param {string} status - Task status
 * @returns {string} Formatted status
 */
function formatStatus(status) {
  switch (status) {
    case 'active':
      return chalk.green(status);
    case 'blocked':
      return chalk.red(status);
    case 'completed':
      return chalk.gray(status);
    case 'archived':
      return chalk.gray.strikethrough(status);
    case 'paused':
      return chalk.yellow(status);
    default:
      return chalk.blue(status);
  }
}