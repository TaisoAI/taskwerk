/**
 * TaskWerk v3 List Command
 *
 * Lists and filters tasks with various display options
 */

import { BaseCommand } from '../cli/base-command.js';
import { TaskManager } from '../core/task-manager.js';
import { loadConfig } from '../utils/config.js';
import { formatTaskList } from '../utils/formatter.js';
import chalk from 'chalk';

/**
 * List command implementation for v3
 */
export class ListCommand extends BaseCommand {
  constructor() {
    super('list', 'List and filter tasks');

    // Set category
    this.category = 'Task Management';

    // Define options
    this.option('-p, --priority <level>', 'Filter by priority (high|medium|low)')
      .option('-c, --category <category>', 'Filter by category (partial match)')
      .option('-s, --status <status>', 'Filter by status (todo|in_progress|completed)')
      .option('-a, --assignee <assignee>', 'Filter by assignee')
      .option('--completed', 'Show completed tasks instead of active ones')
      .option('--archived', 'Show archived tasks instead of active ones')
      .option('--all-closed', 'Show both completed and archived tasks')
      .option('--current', 'Show current session info and active task')
      .option('--limit <number>', 'Limit number of results', '50');
  }

  /**
   * Execute list command
   */
  async execute(args, options) {
    try {
      // Handle current session display
      if (options.current) {
        await this.showCurrentSession();
        return;
      }

      // Build filter criteria
      const filters = {};

      if (options.priority) {
        if (!['high', 'medium', 'low'].includes(options.priority)) {
          throw new Error('Priority must be one of: high, medium, low');
        }
        filters.priority = options.priority;
      }

      if (options.status) {
        if (!['todo', 'in_progress', 'completed'].includes(options.status)) {
          throw new Error('Status must be one of: todo, in_progress, completed');
        }
        filters.status = options.status;
      }

      if (options.category) {
        filters.category = options.category;
      }

      if (options.assignee) {
        filters.assignee = options.assignee;
      }

      // Handle status filtering
      if (options.completed) {
        filters.status = 'completed';
      } else if (options.archived) {
        filters.status = 'archived';
      } else if (options.allClosed) {
        // For now, we'll need to make multiple calls since API doesn't support arrays
        // TODO: Enhance API to support array filters
        filters.status = 'completed'; // We'll handle this separately
      } else if (!options.status) {
        // Default to showing active tasks only (we'll filter out completed)
        // For now, don't set status filter and we'll filter client-side
      }

      // Parse limit
      const limit = parseInt(options.limit);
      if (isNaN(limit) || limit <= 0) {
        throw new Error('Limit must be a positive number');
      }

      this.info('Fetching tasks...');

      // Get tasks using v3 API
      const result = await this.apis.task.listTasks({ ...filters, limit });
      let tasks = result.tasks;

      // Add string_id formatting for tasks that don't have it
      tasks = tasks.map(task => ({
        ...task,
        string_id: task.string_id || `TASK-${task.id.toString().padStart(3, '0')}`,
      }));

      // Client-side filtering for cases the API doesn't handle
      if (!options.completed && !options.archived && !options.allClosed && !options.status) {
        // Default to showing only active tasks (todo and in_progress)
        tasks = tasks.filter(task => task.status === 'todo' || task.status === 'in_progress');
      } else if (options.allClosed) {
        // Need to get both completed and archived - for now just show completed
        // TODO: Make additional API call for archived tasks
      }

      if (tasks.length === 0) {
        this.info('No tasks found matching the criteria.');
        return;
      }

      // Display tasks
      this.displayTasks(tasks, options);

      // Show summary
      this.info(`\nShowing ${tasks.length} task${tasks.length === 1 ? '' : 's'}`);

      return tasks;
    } catch (error) {
      throw new Error(`Failed to list tasks: ${error.message}`);
    }
  }

  /**
   * Display tasks in a formatted table
   */
  displayTasks(tasks, _options) {
    console.log();

    // Group tasks by priority for better organization
    const priorityOrder = ['high', 'medium', 'low'];
    const tasksByPriority = {};

    for (const priority of priorityOrder) {
      tasksByPriority[priority] = tasks.filter(task => task.priority === priority);
    }

    for (const priority of priorityOrder) {
      const priorityTasks = tasksByPriority[priority];
      if (priorityTasks.length === 0) {
        continue;
      }

      // Priority header
      const priorityColor =
        priority === 'high' ? 'red' : priority === 'medium' ? 'yellow' : 'green';
      console.log(
        chalk[priorityColor].bold(`\n${priority.toUpperCase()} PRIORITY (${priorityTasks.length})`)
      );
      console.log(''.padEnd(50, '─'));

      for (const task of priorityTasks) {
        this.displayTask(task);
      }
    }
  }

  /**
   * Display a single task
   */
  displayTask(task) {
    // Status icon
    const statusIcon =
      {
        todo: '○',
        in_progress: '●',
        completed: '✓',
        archived: '✗',
      }[task.status] || '?';

    // Status color
    const statusColor =
      {
        todo: 'white',
        in_progress: 'blue',
        completed: 'green',
        archived: 'gray',
      }[task.status] || 'white';

    // Format the task line
    let taskLine = chalk[statusColor](`${statusIcon} ${task.string_id}`);
    taskLine += ` ${task.name}`;

    if (task.category) {
      taskLine += chalk.gray(` [${task.category}]`);
    }

    if (task.assignee) {
      taskLine += chalk.cyan(` @${task.assignee}`);
    }

    if (task.estimated) {
      taskLine += chalk.magenta(` (${task.estimated}h)`);
    }

    if (task.progress > 0) {
      taskLine += chalk.blue(` ${task.progress}%`);
    }

    console.log(`  ${taskLine}`);

    // Show description if it differs from name
    if (task.description && task.description !== task.name) {
      console.log(`    ${chalk.gray(task.description)}`);
    }

    // Show dates
    const dates = [];
    if (task.created_at) {
      dates.push(`Created: ${new Date(task.created_at).toLocaleDateString()}`);
    }
    if (task.completed_at) {
      dates.push(`Completed: ${new Date(task.completed_at).toLocaleDateString()}`);
    }
    if (dates.length > 0) {
      console.log(`    ${chalk.gray(dates.join(' | '))}`);
    }

    console.log();
  }

  /**
   * Show current session information
   */
  async showCurrentSession() {
    this.info('Current session information:');

    // TODO: Implement session management in v3
    this.warn('Session management is not yet implemented in v3');

    // For now, show active tasks
    const activeTasks = await this.apis.task.listTasks({ status: 'in_progress' });

    if (activeTasks.length === 0) {
      this.info('No tasks currently in progress.');
    } else {
      console.log('\nTasks in progress:');
      for (const task of activeTasks) {
        this.displayTask(task);
      }
    }
  }
}

// Export as default for auto-discovery
export default ListCommand;

// Export legacy function for v2 CLI compatibility
export async function listCommand(options) {
  try {
    const config = await loadConfig();
    const taskManager = new TaskManager(config);

    if (options.current) {
      const session = await taskManager.getCurrentSession();
      console.log(formatTaskList([], { session }));
      return;
    }

    const tasks = await taskManager.getTasks({
      priority: options.priority,
      category: options.category,
      completed: options.completed,
      archived: options.archived,
      allClosed: options.allClosed,
    });

    console.log(
      formatTaskList(tasks, {
        showCompleted: options.completed || options.archived || options.allClosed,
        priority: options.priority,
        category: options.category,
      })
    );
  } catch (error) {
    console.error('❌ Failed to list tasks:', error.message);
    process.exit(1);
  }
}
