/**
 * TaskWerk v3 Start Command
 *
 * Start working on a task with workflow validation
 */

import { BaseCommand } from '../cli/base-command.js';
import { WorkflowManager } from '../core/workflow-manager.js';
import { TaskWerkError } from '../cli/error-handler.js';
import { TaskManager } from '../core/task-manager.js';
import { loadConfig } from '../utils/config.js';
import chalk from 'chalk';

/**
 * Start command implementation for v3
 */
export class StartCommand extends BaseCommand {
  constructor() {
    super('start', 'Start working on a task');

    // Set category
    this.category = 'Workflow';

    // Define arguments
    this.argument('taskId', 'Task ID to start (e.g., TASK-001)');

    // Define options
    this.option('-f, --force', 'Force start even if another task is in progress')
      .option('--no-validate', 'Skip dependency validation')
      .option('-r, --reason <reason>', 'Reason for starting this task')
      .option('--git', 'Create a Git branch for this task');
  }

  /**
   * Execute start command
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
      // Start the task
      const task = await workflow.startTask(taskId, {
        force: options.force,
        reason: options.reason,
        validateDependencies: options.validate !== false,
      });

      // Create Git branch if requested
      if (options.git) {
        await this.createGitBranch(task);
      }

      // Display success message
      this.success(`Started working on: ${task.string_id} - ${task.name}`);

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
      if (task.estimated) {
        console.log(`  Estimate: ${chalk.magenta(task.estimated + ' hours')}`);
      }

      // Show workflow info
      console.log();
      console.log(chalk.bold('Workflow:'));
      console.log(`  Status: ${chalk.blue('● in_progress')}`);
      console.log(`  Started: ${chalk.gray(new Date().toLocaleString())}`);

      // Check for dependencies
      const blockers = await workflow.checkBlockingDependencies(task.id);
      if (blockers.length > 0 && options.validate === false) {
        console.log();
        console.log(chalk.yellow('⚠  Warning: Task has incomplete dependencies:'));
        blockers.forEach(blocker => {
          console.log(`    - ${blocker.string_id}: ${blocker.name} (${blocker.status})`);
        });
      }

      // Show next steps
      console.log();
      console.log(chalk.bold('Next steps:'));
      console.log(`  - Work on the task`);
      console.log(`  - Run ${chalk.cyan('taskwerk pause ' + task.string_id)} to pause`);
      console.log(`  - Run ${chalk.cyan('taskwerk complete ' + task.string_id)} when done`);

      return task;
    } catch (error) {
      // Enhance error messages
      if (error.message.includes('already in progress')) {
        const stats = await workflow.getWorkflowStats();
        if (stats.activeTask) {
          error.suggestion = `Complete or pause ${stats.activeTask.string_id} first, or use --force to switch tasks`;
        }
      }
      throw error;
    } finally {
      workflow.close();
    }
  }

  /**
   * Create a Git branch for the task
   */
  async createGitBranch(task) {
    try {
      const branchName = this.generateBranchName(task);

      // Check if we're in a git repo
      const { spawn } = await import('child_process');
      const { promisify } = await import('util');
      const exec = promisify(spawn);

      // Create and checkout branch
      await exec('git', ['checkout', '-b', branchName]);

      this.success(`Created Git branch: ${branchName}`);
    } catch (error) {
      this.warn(`Failed to create Git branch: ${error.message}`);
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
}

// Export as default for auto-discovery
export default StartCommand;

// Export legacy function for v2 CLI compatibility
export async function startCommand(taskId) {
  try {
    const config = await loadConfig();
    const taskManager = new TaskManager(config);

    const task = await taskManager.startTask(taskId);

    console.log(`🚀 Started task: ${task.id} - ${task.description}`);

    const session = await taskManager.getCurrentSession();
    if (session.branch) {
      console.log(`📝 Session: ${session.agent || 'Unknown'} on ${session.branch}`);
    }
  } catch (error) {
    console.error('❌ Failed to start task:', error.message);
    process.exit(1);
  }
}
