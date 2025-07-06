/**
 * Task Update Command
 * 
 * @description Update task properties
 * @module taskwerk/cli/commands/task/update
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { TaskwerkAPI } from '../../../core/api.js';
import { initializeStorage } from '../../../storage/index.js';
import { TaskStatus, Priority } from '../../../core/constants.js';

/**
 * Creates the task update command
 * @returns {Command} The update command
 */
export function makeUpdateCommand() {
  return new Command('update')
    .description('Update a task')
    .argument('<id>', 'Task ID')
    .option('-n, --name <name>', 'Update task name')
    .option('-d, --description <text>', 'Update description')
    .option('-s, --status <status>', 'Update status')
    .option('-p, --priority <level>', 'Update priority')
    .option('-a, --assignee <person>', 'Update assignee')
    .option('-e, --estimate <time>', 'Update time estimate')
    .option('--due <date>', 'Update due date')
    .option('--parent <id>', 'Update parent task')
    .option('--tags <tags>', 'Update tags (comma-separated)')
    .option('--add-tags <tags>', 'Add tags (comma-separated)')
    .option('--remove-tags <tags>', 'Remove tags (comma-separated)')
    .option('--milestone <bool>', 'Update milestone flag (true/false)')
    .option('--add-note <note>', 'Add a note')
    .action(async (id, options) => {
      await handleUpdate(id, options);
    });
}

/**
 * Handles the task update command
 * @param {string} id - Task ID
 * @param {Object} options - Command options
 */
async function handleUpdate(id, options) {
  try {
    // Initialize storage and API
    const storage = await initializeStorage();
    const api = new TaskwerkAPI({ database: storage.db });

    // Get existing task
    const existingTask = await api.getTask(id);
    if (!existingTask) {
      console.error(chalk.red(`Error: Task '${id}' not found`));
      process.exit(1);
    }

    // Build update data
    const updates = {};
    let hasUpdates = false;

    // Simple field updates
    if (options.name !== undefined) {
      updates.name = options.name;
      hasUpdates = true;
    }
    if (options.description !== undefined) {
      updates.description = options.description;
      hasUpdates = true;
    }
    if (options.assignee !== undefined) {
      updates.assignee = options.assignee;
      hasUpdates = true;
    }
    if (options.parent !== undefined) {
      updates.parent_id = options.parent;
      hasUpdates = true;
    }
    if (options.due !== undefined) {
      updates.due_date = options.due;
      hasUpdates = true;
    }

    // Status update
    if (options.status !== undefined) {
      const status = options.status.toLowerCase();
      if (!Object.values(TaskStatus).includes(status)) {
        console.error(chalk.red(`Error: Invalid status '${options.status}'`));
        process.exit(1);
      }
      updates.status = status;
      hasUpdates = true;
    }

    // Priority update
    if (options.priority !== undefined) {
      const priority = options.priority.toLowerCase();
      if (!Object.values(Priority).includes(priority)) {
        console.error(chalk.red(`Error: Invalid priority '${options.priority}'`));
        process.exit(1);
      }
      updates.priority = priority;
      hasUpdates = true;
    }

    // Time estimate update
    if (options.estimate !== undefined) {
      updates.estimate = parseTimeEstimate(options.estimate);
      hasUpdates = true;
    }

    // Milestone flag update
    if (options.milestone !== undefined) {
      updates.is_milestone = options.milestone === 'true';
      hasUpdates = true;
    }

    // Tag management
    if (options.tags !== undefined) {
      // Replace all tags
      updates.tags = options.tags ? options.tags.split(',').map(t => t.trim()) : [];
      hasUpdates = true;
    } else {
      // Add/remove specific tags
      let tags = [...existingTask.tags];
      
      if (options.addTags) {
        const tagsToAdd = options.addTags.split(',').map(t => t.trim());
        for (const tag of tagsToAdd) {
          if (!tags.includes(tag)) {
            tags.push(tag);
          }
        }
        updates.tags = tags;
        hasUpdates = true;
      }
      
      if (options.removeTags) {
        const tagsToRemove = options.removeTags.split(',').map(t => t.trim());
        tags = tags.filter(tag => !tagsToRemove.includes(tag));
        updates.tags = tags;
        hasUpdates = true;
      }
    }

    // Apply updates if any
    if (hasUpdates) {
      await api.updateTask(id, updates);
      console.log(chalk.green(`✓ Updated task ${chalk.bold(existingTask.string_id)}`));
      
      // Show what was updated
      for (const [key, value] of Object.entries(updates)) {
        if (key === 'tags') {
          console.log(chalk.gray(`  ${key}: ${value.join(', ') || '(none)'}`));
        } else {
          console.log(chalk.gray(`  ${key}: ${value || '(cleared)'}`));
        }
      }
    }

    // Add note if provided
    if (options.addNote) {
      await api.addNote(existingTask.string_id, options.addNote);
      console.log(chalk.green(`✓ Added note to task ${chalk.bold(existingTask.string_id)}`));
    }

    if (!hasUpdates && !options.addNote) {
      console.log(chalk.yellow('No updates specified'));
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
  if (!estimate || estimate === 'none' || estimate === 'clear') return null;
  
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