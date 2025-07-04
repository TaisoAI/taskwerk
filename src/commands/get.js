/**
 * TaskWerk v3 Get Command
 *
 * Shows detailed information about a specific task
 */

import { BaseCommand } from '../cli/base-command.js';
import chalk from 'chalk';

/**
 * Get command implementation for v3
 */
export class GetCommand extends BaseCommand {
  constructor() {
    super('get', 'Show detailed information about a specific task');

    // Set category
    this.category = 'Task Management';

    // Define arguments
    this.argument('taskId', 'Task ID (e.g., TASK-001 or 1)');

    // Define options
    this.option('--notes', 'Include task notes and timeline')
      .option('--dependencies', 'Include task dependencies')
      .option('--files', 'Include associated files')
      .option('--all', 'Include all additional information');
  }

  /**
   * Execute get command
   */
  async execute(args, options) {
    const taskId = args[0];

    if (!taskId) {
      throw new Error('Task ID is required');
    }

    this.info(`Fetching task: ${taskId}...`);

    try {
      // Get the task using v3 API
      const task = await this.apis.task.getTask(taskId);

      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }

      // Display basic task information
      this.displayTaskDetails(task);

      // Display additional information based on options
      if (options.notes || options.all) {
        await this.displayTaskNotes(task.id);
      }

      if (options.dependencies || options.all) {
        this.displayTaskDependencies(task);
      }

      if (options.files || options.all) {
        await this.displayTaskFiles(task.id);
      }

      return task;
    } catch (error) {
      throw new Error(`Failed to get task: ${error.message}`);
    }
  }

  /**
   * Display detailed task information
   */
  displayTaskDetails(task) {
    console.log();
    console.log(chalk.bold.blue(`${task.string_id}: ${task.name}`));
    console.log(''.padEnd(60, '═'));

    // Status with color coding
    const statusColor =
      {
        todo: 'white',
        in_progress: 'blue',
        completed: 'green',
        archived: 'gray',
      }[task.status] || 'white';

    const statusIcon =
      {
        todo: '○',
        in_progress: '●',
        completed: '✓',
        archived: '✗',
      }[task.status] || '?';

    console.log(`Status:      ${chalk[statusColor](statusIcon + ' ' + task.status)}`);

    // Priority with color coding
    const priorityColor =
      task.priority === 'high' ? 'red' : task.priority === 'medium' ? 'yellow' : 'green';
    console.log(`Priority:    ${chalk[priorityColor](task.priority)}`);

    if (task.category) {
      console.log(`Category:    ${chalk.cyan(task.category)}`);
    }

    if (task.assignee) {
      console.log(`Assignee:    ${chalk.cyan('@' + task.assignee)}`);
    }

    if (task.estimated) {
      console.log(`Estimate:    ${chalk.magenta(task.estimated + ' hours')}`);
    }

    if (task.progress > 0) {
      const progressBar =
        '█'.repeat(Math.floor(task.progress / 10)) +
        '░'.repeat(10 - Math.floor(task.progress / 10));
      console.log(`Progress:    ${chalk.blue(progressBar)} ${task.progress}%`);
    }

    console.log();

    // Description
    if (task.description && task.description !== task.name) {
      console.log(chalk.bold('Description:'));
      console.log(task.description);
      console.log();
    }

    // Dates
    if (task.created_at) {
      console.log(`Created:     ${chalk.gray(new Date(task.created_at).toLocaleString())}`);
    }

    if (task.updated_at && task.updated_at !== task.created_at) {
      console.log(`Updated:     ${chalk.gray(new Date(task.updated_at).toLocaleString())}`);
    }

    if (task.completed_at) {
      console.log(`Completed:   ${chalk.green(new Date(task.completed_at).toLocaleString())}`);
    }

    console.log();
  }

  /**
   * Display task dependencies
   */
  displayTaskDependencies(task) {
    if (task.dependencies && task.dependencies.length > 0) {
      console.log(chalk.bold('Dependencies:'));
      for (const dep of task.dependencies) {
        console.log(
          `  → ${dep.depends_on_name} (TASK-${dep.depends_on_id.toString().padStart(3, '0')})`
        );
      }
      console.log();
    }

    if (task.dependents && task.dependents.length > 0) {
      console.log(chalk.bold('Dependents (tasks that depend on this):'));
      for (const dep of task.dependents) {
        console.log(`  ← ${dep.dependent_name} (TASK-${dep.task_id.toString().padStart(3, '0')})`);
      }
      console.log();
    }

    if (
      (!task.dependencies || task.dependencies.length === 0) &&
      (!task.dependents || task.dependents.length === 0)
    ) {
      console.log(chalk.gray('No dependencies'));
      console.log();
    }
  }

  /**
   * Display task notes and timeline
   */
  async displayTaskNotes(taskId) {
    try {
      const result = await this.apis.notes.getNotes(taskId);
      const notes = result.notes;

      if (notes.length === 0) {
        console.log(chalk.gray('No notes'));
        console.log();
        return;
      }

      console.log(chalk.bold('Notes & Timeline:'));
      console.log(''.padEnd(40, '─'));

      for (const note of notes.slice(-10)) {
        // Show last 10 notes
        const date = new Date(note.created_at).toLocaleString();
        const noteType = note.note_type || 'comment';

        const typeIcon =
          {
            comment: '💬',
            system: '⚙️ ',
            status: '📊',
            error: '❌',
          }[noteType] || '📝';

        console.log(`${chalk.gray(date)} ${typeIcon} ${note.note}`);
        if (note.author && note.author !== 'system') {
          console.log(`  ${chalk.cyan('by ' + note.author)}`);
        }
        console.log();
      }
    } catch (error) {
      console.log(chalk.red(`Failed to load notes: ${error.message}`));
      console.log();
    }
  }

  /**
   * Display associated files
   */
  async displayTaskFiles(_taskId) {
    try {
      // TODO: Implement file associations in v3 API
      console.log(chalk.gray('File associations not yet implemented in v3'));
      console.log();
    } catch (error) {
      console.log(chalk.red(`Failed to load files: ${error.message}`));
      console.log();
    }
  }
}

// Export as default for auto-discovery
export default GetCommand;
