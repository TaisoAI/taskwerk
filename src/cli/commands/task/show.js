/**
 * Task Show Command
 * 
 * @description Display detailed information about a task
 * @module taskwerk/cli/commands/task/show
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { TaskwerkAPI } from '../../../core/api.js';
import { initializeStorage } from '../../../storage/index.js';

/**
 * Creates the task show command
 * @returns {Command} The show command
 */
export function makeShowCommand() {
  return new Command('show')
    .description('Show detailed task information')
    .argument('<id>', 'Task ID')
    .option('--format <format>', 'Output format: text (default), json', 'text')
    .action(async (id, options) => {
      await handleShow(id, options);
    });
}

/**
 * Handles the task show command
 * @param {string} id - Task ID
 * @param {Object} options - Command options
 */
async function handleShow(id, options) {
  try {
    // Initialize storage and API
    const storage = await initializeStorage();
    const api = new TaskwerkAPI({ database: storage.db });

    // Get task
    const task = await api.getTask(id);

    if (!task) {
      console.error(chalk.red(`Error: Task '${id}' not found`));
      process.exit(1);
    }

    // Display task
    if (options.format === 'json') {
      console.log(JSON.stringify(task, null, 2));
    } else {
      displayTask(task);
    }

    // Close storage
    storage.close();
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Display task in text format
 * @param {Object} task - Task to display
 */
function displayTask(task) {
  // Header
  console.log(chalk.bold.white(`Task ${task.string_id}: ${task.name}`));
  console.log(chalk.gray('─'.repeat(60)));

  // Basic info
  console.log(`${chalk.gray('Status:')}     ${formatStatus(task.status)}`);
  console.log(`${chalk.gray('Priority:')}   ${formatPriority(task.priority)}`);
  console.log(`${chalk.gray('Created:')}    ${formatDate(task.created_at)}`);
  console.log(`${chalk.gray('Updated:')}    ${formatDate(task.updated_at)}`);

  // Optional fields
  if (task.assignee) {
    console.log(`${chalk.gray('Assignee:')}   ${task.assignee}`);
  }
  if (task.description) {
    console.log(`${chalk.gray('Description:')} ${task.description}`);
  }
  if (task.blocked_reason) {
    console.log(`${chalk.gray('Blocked:')}    ${chalk.red(task.blocked_reason)}`);
  }
  if (task.estimate) {
    console.log(`${chalk.gray('Estimate:')}   ${formatEstimate(task.estimate)}`);
  }
  if (task.due_date) {
    console.log(`${chalk.gray('Due date:')}   ${formatDate(task.due_date)}`);
  }
  if (task.parent_id) {
    console.log(`${chalk.gray('Parent:')}     ${task.parent_string_id || task.parent_id}`);
  }

  // Tags
  if (task.tags && task.tags.length > 0) {
    console.log(`${chalk.gray('Tags:')}       ${task.tags.join(', ')}`);
  }

  // Flags
  if (task.is_milestone) {
    console.log(`${chalk.gray('Type:')}       🏁 Milestone`);
  }
  if (task.is_template) {
    console.log(`${chalk.gray('Type:')}       📋 Template`);
  }

  // Notes
  if (task.notes) {
    console.log(chalk.gray('\nNotes:'));
    console.log(chalk.gray('─'.repeat(60)));
    console.log(task.notes.trim());
  }

  // History summary
  if (task.history_count) {
    console.log(chalk.gray(`\nHistory: ${task.history_count} change${task.history_count !== 1 ? 's' : ''}`));
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

/**
 * Format date for display
 * @param {string} date - ISO date string
 * @returns {string} Formatted date
 */
function formatDate(date) {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleString();
}

/**
 * Format time estimate
 * @param {number} hours - Hours as decimal
 * @returns {string} Formatted estimate
 */
function formatEstimate(hours) {
  if (!hours) return '-';
  
  if (hours < 1) {
    return `${Math.round(hours * 60)}m`;
  } else if (hours >= 8) {
    const days = hours / 8;
    return days % 1 === 0 ? `${days}d` : `${days.toFixed(1)}d`;
  } else {
    return hours % 1 === 0 ? `${hours}h` : `${hours.toFixed(1)}h`;
  }
}