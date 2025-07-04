/**
 * TaskWerk v3 Pause Command
 *
 * Pause work on a task with reason tracking
 */

import { BaseCommand } from '../cli/base-command.js';
import { WorkflowManager } from '../core/workflow-manager.js';
import { TaskWerkError } from '../cli/error-handler.js';
import { TaskManager } from '../core/task-manager.js';
import { loadConfig } from '../utils/config.js';
import chalk from 'chalk';

/**
 * Pause command implementation for v3
 */
export class PauseCommand extends BaseCommand {
  constructor() {
    super('pause', 'Pause work on a task');

    // Set category
    this.category = 'Workflow';

    // Define arguments
    this.argument('taskId', 'Task ID to pause (e.g., TASK-001)');

    // Define options
    this.option('-r, --reason <reason>', 'Reason for pausing the task')
      .option('--time', 'Show time spent on task');
  }

  /**
   * Execute pause command
   */
  async execute(args, options) {
    const taskId = args[0];

    if (!taskId) {
      throw new TaskWerkError('MISSING_REQUIRED_ARG', {
        message: 'Task ID is required',
        argument: 'taskId',
      });
    }

    // Create workflow manager
    const workflow = new WorkflowManager(this.config.databasePath);
    await workflow.initialize();

    try {
      // Get current time spent
      const timeSpent = workflow.calculateTimeSpent();

      // Pause the task
      const task = await workflow.pauseTask(taskId, {
        reason: options.reason,
      });

      // Display success message
      this.success(`Paused task: ${task.string_id} - ${task.name}`);

      // Show pause details
      console.log();
      console.log(chalk.bold('Pause Details:'));
      if (options.reason) {
        console.log(`  Reason: ${chalk.gray(options.reason)}`);
      }
      console.log(`  Status: ${chalk.yellow('⏸ paused')}`);
      console.log(`  Paused at: ${chalk.gray(new Date().toLocaleString())}`);

      // Show time spent
      if (options.time || timeSpent > 0) {
        console.log();
        console.log(chalk.bold('Session Summary:'));
        console.log(`  Time spent: ${chalk.cyan(this.formatTime(timeSpent))}`);
        if (task.estimated) {
          const percentComplete = Math.round((task.progress || 0));
          console.log(`  Progress: ${chalk.cyan(percentComplete + '%')}`);
        }
      }

      // Show next steps
      console.log();
      console.log(chalk.bold('Next steps:'));
      console.log(
        `  - Run ${chalk.cyan('taskwerk resume ' + task.string_id)} to continue`
      );
      console.log(
        `  - Run ${chalk.cyan('taskwerk start [other-task]')} to work on another task`
      );

      return task;
    } finally {
      workflow.close();
    }
  }

  /**
   * Format time in minutes to human-readable string
   */
  formatTime(minutes) {
    if (minutes < 60) {
      return `${minutes} minutes`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }
}

// Export as default for auto-discovery
export default PauseCommand;

// Export legacy function for v2 CLI compatibility
export async function pauseCommand(taskId) {
  try {
    const config = await loadConfig();
    const taskManager = new TaskManager(config);

    const task = await taskManager.pauseTask(taskId);

    console.log(`⏸️  Paused task: ${task.id} - ${task.description}`);
  } catch (error) {
    console.error('❌ Failed to pause task:', error.message);
    process.exit(1);
  }
}