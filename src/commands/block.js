/**
 * TaskWerk v3 Block Command
 *
 * Block a task with reason tracking
 */

import { BaseCommand } from '../cli/base-command.js';
import { WorkflowManager } from '../core/workflow-manager.js';
import { TaskWerkError } from '../cli/error-handler.js';
import { TaskManager } from '../core/task-manager.js';
import { loadConfig } from '../utils/config.js';
import chalk from 'chalk';

/**
 * Block command implementation for v3
 */
export class BlockCommand extends BaseCommand {
  constructor() {
    super('block', 'Block a task with a reason');

    // Set category
    this.category = 'Workflow';

    // Define arguments
    this.argument('taskId', 'Task ID to block (e.g., TASK-001)');

    // Define options
    this.option('-r, --reason <reason>', 'Required: Reason for blocking the task')
      .option('-b, --blocked-by <taskId>', 'Task ID that is blocking this one')
      .option('--dependency', 'Mark as blocked by dependency')
      .option('--external', 'Mark as blocked by external factor');
  }

  /**
   * Execute block command
   */
  async execute(args, options) {
    const taskId = args[0];

    if (!taskId) {
      throw new TaskWerkError('MISSING_REQUIRED_ARG', {
        message: 'Task ID is required',
        argument: 'taskId',
      });
    }

    if (!options.reason && !options.blockedBy && !options.dependency && !options.external) {
      throw new TaskWerkError('MISSING_REQUIRED_ARG', {
        message: 'You must provide a reason for blocking the task (use --reason, --blocked-by, --dependency, or --external)',
        argument: 'reason',
      });
    }

    // Build reason from options
    let blockReason = options.reason;
    if (!blockReason) {
      if (options.dependency) {
        blockReason = 'Blocked by unresolved dependencies';
      } else if (options.external) {
        blockReason = 'Blocked by external factors';
      } else if (options.blockedBy) {
        blockReason = `Blocked by task ${options.blockedBy}`;
      }
    }

    // Create workflow manager
    const workflow = new WorkflowManager(this.config.databasePath);
    await workflow.initialize();

    try {
      // Block the task
      const task = await workflow.blockTask(taskId, {
        reason: blockReason,
        blockedBy: options.blockedBy,
      });

      // Display success message
      this.success(`Blocked task: ${task.string_id} - ${task.name}`);

      // Show block details
      console.log();
      console.log(chalk.bold('Block Details:'));
      console.log(`  Status: ${chalk.red('⛔ blocked')}`);
      console.log(`  Reason: ${chalk.gray(blockReason)}`);
      console.log(`  Blocked at: ${chalk.gray(new Date().toLocaleString())}`);
      
      if (options.blockedBy) {
        console.log(`  Blocked by: ${chalk.cyan(options.blockedBy)}`);
      }

      // Show affected information
      if (task.assignee) {
        console.log();
        console.log(chalk.bold('Affected:'));
        console.log(`  Assignee: ${chalk.cyan('@' + task.assignee)}`);
        if (task.priority === 'high') {
          console.log(`  Priority: ${chalk.red('HIGH PRIORITY TASK BLOCKED')}`);
        }
      }

      // Check for dependent tasks
      const dependents = await workflow.taskApi.listTasks({
        dependsOn: task.id,
        limit: 5,
      });

      if (dependents.tasks && dependents.tasks.length > 0) {
        console.log();
        console.log(chalk.bold('Impact:'));
        console.log(
          chalk.yellow(`  ⚠  This blocks ${dependents.total} dependent task(s):`)
        );
        dependents.tasks.forEach(dep => {
          console.log(
            `    - ${dep.string_id}: ${dep.name} (${dep.status})`
          );
        });
        if (dependents.total > 5) {
          console.log(`    ... and ${dependents.total - 5} more`);
        }
      }

      // Show next steps
      console.log();
      console.log(chalk.bold('Next steps:'));
      console.log(
        `  - Resolve the blocking issue: ${chalk.gray(blockReason)}`
      );
      if (options.blockedBy) {
        console.log(
          `  - Complete blocking task: ${chalk.cyan('taskwerk complete ' + options.blockedBy)}`
        );
      }
      console.log(
        `  - Run ${chalk.cyan('taskwerk unblock ' + task.string_id)} when resolved`
      );
      console.log(
        `  - Run ${chalk.cyan('taskwerk status')} to see all blocked tasks`
      );

      return task;
    } finally {
      workflow.close();
    }
  }
}

// Export as default for auto-discovery
export default BlockCommand;

// Export legacy function for v2 CLI compatibility
export async function blockCommand(taskId, options = {}) {
  try {
    const config = await loadConfig();
    const taskManager = new TaskManager(config);

    // In v2, we don't have explicit block functionality
    // We'll simulate it by adding a note and changing status
    const task = await taskManager.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Add a note about the block
    const blockNote = `[BLOCKED] ${options.reason || 'Task is blocked'}`;
    await taskManager.addNote(taskId, blockNote);

    console.log(`⛔ Blocked task: ${task.id} - ${task.description}`);
    if (options.reason) {
      console.log(`📝 Reason: ${options.reason}`);
    }
  } catch (error) {
    console.error('❌ Failed to block task:', error.message);
    process.exit(1);
  }
}