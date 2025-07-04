/**
 * TaskWerk v3 Unblock Command
 *
 * Unblock a previously blocked task
 */

import { BaseCommand } from '../cli/base-command.js';
import { WorkflowManager } from '../core/workflow-manager.js';
import { TaskWerkError } from '../cli/error-handler.js';
import { TaskManager } from '../core/task-manager.js';
import { loadConfig } from '../utils/config.js';
import chalk from 'chalk';

/**
 * Unblock command implementation for v3
 */
export class UnblockCommand extends BaseCommand {
  constructor() {
    super('unblock', 'Unblock a previously blocked task');

    // Set category
    this.category = 'Workflow';

    // Define arguments
    this.argument('taskId', 'Task ID to unblock (e.g., TASK-001)');

    // Define options
    this.option('-r, --reason <reason>', 'Reason for unblocking the task')
      .option('--resume', 'Resume work on the task immediately after unblocking')
      .option('--force', 'Force unblock even if blocking issue may not be resolved');
  }

  /**
   * Execute unblock command
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
      // Get task details before unblocking
      const blockedTask = await workflow.taskApi.getTask(taskId);
      if (!blockedTask) {
        throw new TaskWerkError('TASK_NOT_FOUND', {
          message: `Task ${taskId} not found`,
          taskId,
        });
      }

      if (blockedTask.status !== 'blocked') {
        throw new TaskWerkError('INVALID_STATE', {
          message: `Task is not blocked (current status: ${blockedTask.status})`,
          currentState: blockedTask.status,
          expectedState: 'blocked',
        });
      }

      // Check if blocking task is resolved (if applicable)
      if (blockedTask.blocked_by && !options.force) {
        const blockingTask = await workflow.taskApi.getTask(blockedTask.blocked_by);
        if (blockingTask && blockingTask.status !== 'completed') {
          this.warn(
            `Warning: Blocking task ${blockingTask.string_id} is not completed (status: ${blockingTask.status})`
          );
          console.log('Use --force to unblock anyway');
          
          if (!options.force) {
            throw new TaskWerkError('BLOCKING_TASK_NOT_RESOLVED', {
              message: `Blocking task ${blockingTask.string_id} must be completed first`,
              blockingTask: blockingTask.string_id,
              blockingStatus: blockingTask.status,
            });
          }
        }
      }

      // Unblock the task
      const task = await workflow.unblockTask(taskId, {
        reason: options.reason,
        resume: options.resume,
      });

      // Display success message
      const action = options.resume ? 'Unblocked and resumed' : 'Unblocked';
      this.success(`${action} task: ${task.string_id} - ${task.name}`);

      // Show unblock details
      console.log();
      console.log(chalk.bold('Unblock Details:'));
      console.log(`  Previous: ${chalk.red('⛔ blocked')}`);
      console.log(`  Current: ${task.status === 'in_progress' ? chalk.blue('● in_progress') : chalk.gray('○ todo')}`);
      console.log(`  Unblocked at: ${chalk.gray(new Date().toLocaleString())}`);
      
      if (options.reason) {
        console.log(`  Reason: ${chalk.gray(options.reason)}`);
      }

      // Calculate blocked duration
      if (blockedTask.blocked_at) {
        const blockedDate = new Date(blockedTask.blocked_at);
        const blockedDuration = Math.round((new Date() - blockedDate) / 60000);
        console.log(`  Blocked for: ${chalk.gray(this.formatTime(blockedDuration))}`);
      }

      // Check for dependent tasks that can now proceed
      const dependents = await workflow.taskApi.listTasks({
        dependsOn: task.id,
        status: 'todo',
        limit: 5,
      });

      if (dependents.tasks && dependents.tasks.length > 0) {
        console.log();
        console.log(chalk.bold('Unblocked Dependencies:'));
        console.log(
          chalk.green(`  ✓ ${dependents.total} dependent task(s) can now proceed:`)
        );
        dependents.tasks.forEach(dep => {
          console.log(`    - ${dep.string_id}: ${dep.name}`);
        });
        if (dependents.total > 5) {
          console.log(`    ... and ${dependents.total - 5} more`);
        }
      }

      // Show next steps
      console.log();
      console.log(chalk.bold('Next steps:'));
      
      if (options.resume) {
        console.log(`  - Continue working on the task`);
        console.log(`  - Run ${chalk.cyan('taskwerk pause ' + task.string_id)} to pause`);
        console.log(
          `  - Run ${chalk.cyan('taskwerk complete ' + task.string_id)} when done`
        );
      } else {
        console.log(
          `  - Run ${chalk.cyan('taskwerk start ' + task.string_id)} to begin work`
        );
        console.log(`  - Run ${chalk.cyan('taskwerk list')} to see all tasks`);
      }

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
export default UnblockCommand;

// Export legacy function for v2 CLI compatibility
export async function unblockCommand(taskId, options = {}) {
  try {
    const config = await loadConfig();
    const taskManager = new TaskManager(config);

    // In v2, we don't have explicit unblock functionality
    // We'll simulate it by adding a note
    const task = await taskManager.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Add a note about the unblock
    const unblockNote = `[UNBLOCKED] ${options.reason || 'Task is no longer blocked'}`;
    await taskManager.addNote(taskId, unblockNote);

    console.log(`✅ Unblocked task: ${task.id} - ${task.description}`);
    if (options.reason) {
      console.log(`📝 Reason: ${options.reason}`);
    }
  } catch (error) {
    console.error('❌ Failed to unblock task:', error.message);
    process.exit(1);
  }
}