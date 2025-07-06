/**
 * Task Add Command
 * 
 * @description Create a new task
 * @module taskwerk/cli/commands/task/add
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { TaskwerkAPI } from '../../../core/api.js';
import { initializeStorage } from '../../../storage/index.js';
import { Priority } from '../../../core/constants.js';

/**
 * Creates the task add command
 * @returns {Command} The add command
 */
export function makeAddCommand() {
  return new Command('add')
    .description('Create a new task')
    .argument('<name>', 'Task name')
    .option('-d, --description <text>', 'Task description')
    .option('-n, --note <note>', 'Initial note')
    .option('-a, --assignee <person>', 'Assign to person')
    .option('-p, --priority <level>', 'Priority: high, medium, low', 'medium')
    .option('-e, --estimate <time>', 'Time estimate')
    .option('--due <date>', 'Due date')
    .option('--parent <id>', 'Parent task ID')
    .option('--tags <tags>', 'Comma-separated tags')
    .option('--milestone', 'Mark as milestone')
    .option('--template', 'Mark as template')
    .action(async (name, options) => {
      await handleAdd(name, options);
    });
}

/**
 * Handles the task add command
 * @param {string} name - Task name
 * @param {Object} options - Command options
 */
async function handleAdd(name, options) {
  try {
    // Initialize storage and API
    const storage = await initializeStorage();
    const api = new TaskwerkAPI({ database: storage.db });

    // Prepare task data
    const taskData = {
      name,
      description: options.description || null,
      assignee: options.assignee || null,
      priority: options.priority.toLowerCase(),
      estimate: parseTimeEstimate(options.estimate),
      due_date: options.due || null,
      parent_id: options.parent || null,
      is_milestone: options.milestone || false,
      is_template: options.template || false,
      tags: options.tags ? options.tags.split(',').map(t => t.trim()) : []
    };

    // Validate priority
    if (!Object.values(Priority).includes(taskData.priority)) {
      console.error(chalk.red(`Error: Invalid priority '${options.priority}'. Use: high, medium, or low`));
      process.exit(1);
    }

    // Create task
    const task = await api.createTask(taskData);

    // Add initial note if provided
    if (options.note) {
      await api.addNote(task.string_id, options.note);
    }

    // Success message
    console.log(chalk.green(`✓ Created task ${chalk.bold(task.string_id)}: ${task.name}`));
    
    // Show additional details if provided
    if (task.assignee) {
      console.log(chalk.gray(`  Assigned to: ${task.assignee}`));
    }
    if (task.priority !== 'medium') {
      console.log(chalk.gray(`  Priority: ${task.priority}`));
    }
    if (task.tags.length > 0) {
      console.log(chalk.gray(`  Tags: ${task.tags.join(', ')}`));
    }

    // Close storage
    storage.close();
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Parse time estimate string into hours
 * @param {string} estimate - Time estimate (e.g., "2h", "30m", "1.5h")
 * @returns {number|null} Hours as decimal or null
 */
function parseTimeEstimate(estimate) {
  if (!estimate) return null;
  
  const match = estimate.match(/^(\d+(?:\.\d+)?)\s*(h|m|d)$/i);
  if (!match) {
    console.warn(chalk.yellow(`Warning: Invalid time format '${estimate}'. Use format like '2h', '30m', or '1d'`));
    return null;
  }
  
  const [, value, unit] = match;
  const num = parseFloat(value);
  
  switch (unit.toLowerCase()) {
    case 'h':
      return num;
    case 'm':
      return num / 60;
    case 'd':
      return num * 8; // Assume 8 hour work day
    default:
      return null;
  }
}