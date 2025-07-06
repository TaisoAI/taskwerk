/**
 * Task List Command
 * 
 * @description List and filter tasks
 * @module taskwerk/cli/commands/task/list
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { TaskwerkAPI } from '../../../core/api.js';
import { initializeStorage } from '../../../storage/index.js';
import { TaskStatus, Priority } from '../../../core/constants.js';

/**
 * Creates the task list command
 * @returns {Command} The list command
 */
export function makeListCommand() {
  return new Command('list')
    .description('List tasks with filters')
    .option('-s, --status <status>', 'Filter by status')
    .option('-a, --assignee <person>', 'Filter by assignee')
    .option('-p, --priority <level>', 'Filter by priority')
    .option('-t, --tags <tags>', 'Filter by tags (comma-separated)')
    .option('--parent <id>', 'Show children of task')
    .option('--no-parent', 'Show only root tasks')
    .option('--milestones', 'Show only milestones')
    .option('--include-archived', 'Include archived tasks')
    .option('--format <format>', 'Output format: table (default), json, csv', 'table')
    .option('--sort <field>', 'Sort by field: created, updated, priority, status', 'created')
    .option('--reverse', 'Reverse sort order')
    .action(async (options) => {
      await handleList(options);
    });
}

/**
 * Handles the task list command
 * @param {Object} options - Command options
 */
async function handleList(options) {
  try {
    // Initialize storage and API
    const storage = await initializeStorage();
    const api = new TaskwerkAPI({ database: storage.db });

    // Build filters
    const filters = {};
    
    if (options.status) {
      filters.status = options.status.toLowerCase();
      if (!Object.values(TaskStatus).includes(filters.status)) {
        console.error(chalk.red(`Error: Invalid status '${options.status}'`));
        process.exit(1);
      }
    }
    
    if (options.assignee) {
      filters.assignee = options.assignee;
    }
    
    if (options.priority) {
      filters.priority = options.priority.toLowerCase();
      if (!Object.values(Priority).includes(filters.priority)) {
        console.error(chalk.red(`Error: Invalid priority '${options.priority}'`));
        process.exit(1);
      }
    }
    
    if (options.parent) {
      // TODO: Need to look up parent task ID
      filters.parent_id = options.parent;
    } else if (options.noParent) {
      filters.parent_id = null;
    }
    
    if (options.milestones) {
      filters.is_milestone = true;
    }
    
    if (options.includeArchived) {
      filters.include_archived = true;
    }

    // Get tasks
    let tasks = await api.listTasks(filters);

    // Filter by tags if specified
    if (options.tags) {
      const requiredTags = options.tags.split(',').map(t => t.trim());
      tasks = tasks.filter(task => 
        requiredTags.some(tag => task.tags.includes(tag))
      );
    }

    // Sort tasks
    tasks = sortTasks(tasks, options.sort, options.reverse);

    // Display results
    if (tasks.length === 0) {
      console.log(chalk.gray('No tasks found'));
    } else {
      switch (options.format) {
        case 'json':
          console.log(JSON.stringify(tasks, null, 2));
          break;
        case 'csv':
          displayCsv(tasks);
          break;
        default:
          displayTable(tasks);
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
 * Sort tasks by field
 * @param {Array} tasks - Tasks to sort
 * @param {string} field - Sort field
 * @param {boolean} reverse - Reverse order
 * @returns {Array} Sorted tasks
 */
function sortTasks(tasks, field, reverse) {
  const sorted = [...tasks].sort((a, b) => {
    let aVal, bVal;
    
    switch (field) {
      case 'priority':
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        aVal = priorityOrder[a.priority];
        bVal = priorityOrder[b.priority];
        break;
      case 'status':
        const statusOrder = { 
          active: 0, blocked: 1, todo: 2, 
          paused: 3, completed: 4, archived: 5 
        };
        aVal = statusOrder[a.status];
        bVal = statusOrder[b.status];
        break;
      case 'updated':
        aVal = new Date(a.updated_at);
        bVal = new Date(b.updated_at);
        break;
      case 'created':
      default:
        aVal = new Date(a.created_at);
        bVal = new Date(b.created_at);
        break;
    }
    
    if (aVal < bVal) return -1;
    if (aVal > bVal) return 1;
    return 0;
  });
  
  return reverse ? sorted.reverse() : sorted;
}

/**
 * Display tasks as a table
 * @param {Array} tasks - Tasks to display
 */
function displayTable(tasks) {
  // Header
  console.log(
    chalk.bold.gray(
      'ID'.padEnd(10) +
      'Status'.padEnd(12) +
      'Priority'.padEnd(10) +
      'Assignee'.padEnd(12) +
      'Task'
    )
  );
  console.log(chalk.gray('─'.repeat(80)));

  // Tasks
  for (const task of tasks) {
    const status = formatStatus(task.status);
    const priority = formatPriority(task.priority);
    const assignee = task.assignee || '-';
    
    let name = task.name;
    if (task.is_milestone) {
      name = `🏁 ${name}`;
    }
    if (task.parent_id) {
      name = `  └─ ${name}`;
    }
    
    console.log(
      chalk.bold(task.string_id.padEnd(10)) +
      status.padEnd(12) +
      priority.padEnd(10) +
      assignee.padEnd(12) +
      name
    );
    
    // Show tags if any
    if (task.tags.length > 0) {
      console.log(
        ' '.repeat(44) +
        chalk.gray(`[${task.tags.join(', ')}]`)
      );
    }
  }
  
  // Summary
  console.log(chalk.gray('─'.repeat(80)));
  console.log(chalk.gray(`${tasks.length} task${tasks.length !== 1 ? 's' : ''}`));
}

/**
 * Display tasks as CSV
 * @param {Array} tasks - Tasks to display
 */
function displayCsv(tasks) {
  // Header
  console.log('ID,Status,Priority,Assignee,Name,Tags,Created,Updated');
  
  // Tasks
  for (const task of tasks) {
    const row = [
      task.string_id,
      task.status,
      task.priority,
      task.assignee || '',
      `"${task.name.replace(/"/g, '""')}"`,
      `"${task.tags.join(', ')}"`,
      task.created_at,
      task.updated_at
    ];
    console.log(row.join(','));
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

/**
 * Format priority with color
 * @param {string} priority - Task priority
 * @returns {string} Formatted priority
 */
function formatPriority(priority) {
  switch (priority) {
    case 'high':
      return chalk.red(priority);
    case 'low':
      return chalk.gray(priority);
    default:
      return priority;
  }
}