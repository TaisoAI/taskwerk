/**
 * TaskWerk v3 Resume Command
 *
 * Resume work on a paused task
 */

import { BaseCommand } from '../cli/base-command.js';
import { WorkflowManager } from '../core/workflow-manager.js';
import { TaskWerkError } from '../cli/error-handler.js';
import { TaskManager } from '../core/task-manager.js';
import { loadConfig } from '../utils/config.js';
import chalk from 'chalk';

/**
 * Resume command implementation for v3
 */
export class ResumeCommand extends BaseCommand {
  constructor() {
    super('resume', 'Resume work on a paused task');

    // Set category
    this.category = 'Workflow';

    // Define arguments
    this.argument('taskId', 'Task ID to resume (e.g., TASK-001)');

    // Define options
    this.option('-f, --force', 'Force resume even if another task is in progress')
      .option('-r, --reason <reason>', 'Reason for resuming the task')
      .option('--git', 'Create/switch to Git branch for this task');
  }

  /**
   * Execute resume command
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
      // Resume the task
      const task = await workflow.resumeTask(taskId, {
        force: options.force,
        reason: options.reason,
      });

      // Create/switch Git branch if requested
      if (options.git) {
        await this.switchToGitBranch(task);
      }

      // Display success message
      this.success(`Resumed task: ${task.string_id} - ${task.name}`);

      // Show task details
      console.log();
      console.log(chalk.bold('Task Details:'));
      console.log(`  Priority: ${this.getPriorityColor(task.priority)(task.priority)}`);
      if (task.category) {
        console.log(`  Category: ${chalk.cyan(task.category)}`);
      }
      if (task.assignee) {
        console.log(`  Assignee: ${chalk.cyan('@' + task.assignee)}`);
      }

      // Show progress info
      if (task.estimated || task.progress) {
        console.log();
        console.log(chalk.bold('Progress:'));
        if (task.progress) {
          console.log(`  Completion: ${chalk.cyan(task.progress + '%')}`);
        }
        if (task.estimated) {
          console.log(`  Estimated: ${chalk.magenta(task.estimated + ' hours')}`);
        }
        if (task.actual_hours) {
          const variance = Math.round(
            ((task.actual_hours - task.estimated) / task.estimated) * 100
          );
          console.log(
            `  Actual: ${chalk.magenta(task.actual_hours + ' hours')} (${variance >= 0 ? '+' : ''}${variance}%)`
          );
        }
      }

      // Show workflow info
      console.log();
      console.log(chalk.bold('Workflow:'));
      console.log(`  Status: ${chalk.blue('● in_progress')}`);
      console.log(`  Resumed: ${chalk.gray(new Date().toLocaleString())}`);
      if (task.paused_at) {
        const pausedDate = new Date(task.paused_at);
        const pauseDuration = Math.round((new Date() - pausedDate) / 60000);
        console.log(`  Paused for: ${chalk.gray(this.formatTime(pauseDuration))}`);
      }

      // Show next steps
      console.log();
      console.log(chalk.bold('Next steps:'));
      console.log(`  - Continue working on the task`);
      console.log(`  - Run ${chalk.cyan('taskwerk pause ' + task.string_id)} to pause again`);
      console.log(`  - Run ${chalk.cyan('taskwerk complete ' + task.string_id)} when done`);

      return task;
    } finally {
      workflow.close();
    }
  }

  /**
   * Switch to Git branch for the task
   */
  async switchToGitBranch(task) {
    try {
      const branchName = this.generateBranchName(task);

      // Check if we're in a git repo
      const { spawn } = await import('child_process');
      const { promisify } = await import('util');
      const exec = promisify(spawn);

      // Check if branch exists
      try {
        await exec('git', ['rev-parse', '--verify', branchName]);
        // Branch exists, just checkout
        await exec('git', ['checkout', branchName]);
        this.success(`Switched to existing branch: ${branchName}`);
      } catch {
        // Branch doesn't exist, create it
        await exec('git', ['checkout', '-b', branchName]);
        this.success(`Created and switched to branch: ${branchName}`);
      }
    } catch (error) {
      this.warn(`Failed to manage Git branch: ${error.message}`);
    }
  }

  /**
   * Generate Git branch name from task
   */
  generateBranchName(task) {
    const prefix = this.config.git?.branchPrefix || 'task/';
    const id = task.string_id.toLowerCase();
    const name = task.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);

    return `${prefix}${id}-${name}`;
  }

  /**
   * Get color function for priority
   */
  getPriorityColor(priority) {
    switch (priority) {
      case 'high':
        return chalk.red;
      case 'medium':
        return chalk.yellow;
      case 'low':
        return chalk.green;
      default:
        return chalk.white;
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
export default ResumeCommand;

// Export legacy function for v2 CLI compatibility
export async function resumeCommand(taskId) {
  try {
    const config = await loadConfig();
    const taskManager = new TaskManager(config);

    // In v2, resume is essentially the same as start
    const task = await taskManager.startTask(taskId);

    console.log(`▶️  Resumed task: ${task.id} - ${task.description}`);
  } catch (error) {
    console.error('❌ Failed to resume task:', error.message);
    process.exit(1);
  }
}
