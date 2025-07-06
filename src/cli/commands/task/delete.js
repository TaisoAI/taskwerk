/**
 * Task Delete Command
 * 
 * @description Delete or archive a task
 * @module taskwerk/cli/commands/task/delete
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { TaskwerkAPI } from '../../../core/api.js';
import { initializeStorage } from '../../../storage/index.js';

/**
 * Creates the task delete command
 * @returns {Command} The delete command
 */
export function makeDeleteCommand() {
  return new Command('delete')
    .description('Delete or archive a task')
    .argument('<id>', 'Task ID')
    .option('-f, --force', 'Force permanent deletion instead of archiving')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (id, options) => {
      await handleDelete(id, options);
    });
}

/**
 * Handles the task delete command
 * @param {string} id - Task ID
 * @param {Object} options - Command options
 */
async function handleDelete(id, options) {
  try {
    // Initialize storage and API
    const storage = await initializeStorage();
    const api = new TaskwerkAPI({ database: storage.db });

    // Get task to confirm it exists
    const task = await api.getTask(id);
    if (!task) {
      console.error(chalk.red(`Error: Task '${id}' not found`));
      process.exit(1);
    }

    // Show what will be deleted
    const action = options.force ? 'permanently delete' : 'archive';
    console.log(`About to ${action} task ${chalk.bold(task.string_id)}: ${task.name}`);

    // Check for child tasks
    const children = await getChildTasks(storage.db, task.id);
    if (children.length > 0) {
      console.log(chalk.yellow(`\nWarning: This task has ${children.length} child task(s):`));
      for (const child of children) {
        console.log(chalk.yellow(`  - ${child.string_id}: ${child.name}`));
      }
      console.log(chalk.yellow(`These will also be ${options.force ? 'deleted' : 'archived'}.`));
    }

    // Confirm unless --yes flag is set
    if (!options.yes) {
      const readline = await import('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const confirmed = await new Promise((resolve) => {
        rl.question(`\nAre you sure? (y/N) `, (answer) => {
          rl.close();
          resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
      });

      if (!confirmed) {
        console.log('Cancelled');
        storage.close();
        process.exit(0);
      }
    }

    // Delete/archive the task
    if (options.force) {
      await api.deleteTask(id, true);
      console.log(chalk.green(`✓ Permanently deleted task ${chalk.bold(task.string_id)}`));
    } else {
      // Archive the task by updating its status
      await api.updateTask(id, { status: 'archived' });
      console.log(chalk.green(`✓ Archived task ${chalk.bold(task.string_id)}`));
      console.log(chalk.gray(`  To view archived tasks, use: taskwerk task list --include-archived`));
      console.log(chalk.gray(`  To permanently delete, use: taskwerk task delete ${task.string_id} --force`));
    }

    // Close storage
    storage.close();
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Get child tasks
 * @param {Database} db - Database connection
 * @param {number} parentId - Parent task ID
 * @returns {Array} Child tasks
 */
function getChildTasks(db, parentId) {
  const stmt = db.prepare(`
    SELECT id, string_id, name
    FROM tasks
    WHERE parent_id = @parentId
    ORDER BY created_at
  `);
  
  return stmt.all({ parentId });
}