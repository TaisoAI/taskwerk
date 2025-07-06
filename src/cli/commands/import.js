/**
 * Import Command
 * 
 * @description Import tasks from various formats
 * @module taskwerk/cli/commands/import
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { TaskwerkAPI } from '../../core/api.js';
import { initializeStorage } from '../../storage/index.js';
import path from 'path';
import fs from 'fs/promises';
import readline from 'readline';

/**
 * Creates the import command
 * @returns {Command} The import command
 */
export function makeImportCommand() {
  return new Command('import')
    .description('Import tasks from file')
    .argument('<file>', 'Input file path')
    .option('-f, --format <format>', 'Import format: json, yaml, markdown, csv')
    .option('-m, --mode <mode>', 'Import mode: merge, replace, skip', 'merge')
    .option('--preserve-ids', 'Preserve task IDs from import file')
    .option('--dry-run', 'Preview import without making changes')
    .option('-y, --yes', 'Skip confirmation prompt')
    .option('--defaults <json>', 'Default values for imported tasks (JSON)')
    .action(async (file, options) => {
      await handleImport(file, options);
    });
}

/**
 * Handle import command
 */
async function handleImport(file, options) {
  try {
    // Check if file exists
    try {
      await fs.access(file);
    } catch {
      console.error(chalk.red(`Error: File not found: ${file}`));
      process.exit(1);
    }

    // Initialize storage and API
    const storage = await initializeStorage();
    const api = new TaskwerkAPI({ database: storage.db });

    // Determine format
    let format = options.format;
    if (!format) {
      const ext = path.extname(file).toLowerCase();
      switch (ext) {
        case '.json':
          format = 'json';
          break;
        case '.yaml':
        case '.yml':
          format = 'yaml';
          break;
        case '.md':
        case '.markdown':
          format = 'markdown';
          break;
        case '.csv':
          format = 'csv';
          break;
        default:
          console.error(chalk.red(`Error: Cannot determine format from extension: ${ext}`));
          console.error(chalk.gray('Use --format option to specify format'));
          process.exit(1);
      }
    }

    // Read file
    const data = await fs.readFile(file, 'utf8');

    // Parse defaults if provided
    let defaults = {};
    if (options.defaults) {
      try {
        defaults = JSON.parse(options.defaults);
      } catch (err) {
        console.error(chalk.red('Error: Invalid JSON for defaults'));
        process.exit(1);
      }
    }

    // Build import options
    const importOptions = {
      format,
      mode: options.mode,
      preserveIds: options.preserveIds,
      defaults
    };

    // Preview if dry run
    if (options.dryRun) {
      await previewImport(api, data, importOptions);
      storage.close();
      return;
    }

    // Get current stats for comparison
    const beforeStats = await getTaskStats(api);

    // Show what will be imported
    console.log(chalk.bold('Import Summary:'));
    console.log(`  File: ${file}`);
    console.log(`  Format: ${format}`);
    console.log(`  Mode: ${options.mode}`);
    console.log(`  Current tasks: ${beforeStats.total}`);

    // Confirm unless --yes
    if (!options.yes) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const confirmed = await new Promise((resolve) => {
        rl.question('\nProceed with import? (y/N) ', (answer) => {
          rl.close();
          resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
      });

      if (!confirmed) {
        console.log('Import cancelled');
        storage.close();
        process.exit(0);
      }
    }

    // Perform import
    console.log(chalk.gray('\nImporting...'));
    const result = await api.importExport.importTasks(data, importOptions);

    // Show results
    console.log(chalk.green('\n✓ Import completed'));
    console.log(chalk.gray(`  Imported: ${result.imported} task(s)`));
    console.log(chalk.gray(`  Skipped: ${result.skipped} task(s)`));
    
    if (result.errors.length > 0) {
      console.log(chalk.red(`  Errors: ${result.errors.length}`));
      for (const error of result.errors) {
        console.log(chalk.red(`    - ${error.task}: ${error.error}`));
      }
    }

    // Show final stats
    const afterStats = await getTaskStats(api);
    console.log(chalk.gray(`  Total tasks: ${afterStats.total} (+${afterStats.total - beforeStats.total})`));

    storage.close();
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Preview import without making changes
 */
async function previewImport(api, data, options) {
  try {
    // Parse data to preview
    let tasks;
    switch (options.format) {
      case 'json':
        tasks = JSON.parse(data);
        break;
      case 'yaml':
        const yaml = await import('yaml');
        tasks = yaml.default.parse(data);
        break;
      case 'csv':
        // Simple preview for CSV
        const lines = data.split('\n').filter(l => l.trim());
        console.log(chalk.bold('\nCSV Preview:'));
        console.log(chalk.gray(`  Headers: ${lines[0]}`));
        console.log(chalk.gray(`  Rows: ${lines.length - 1}`));
        return;
      case 'markdown':
        // Count tasks in markdown
        const taskCount = (data.match(/^##\s+/gm) || []).length;
        console.log(chalk.bold('\nMarkdown Preview:'));
        console.log(chalk.gray(`  Tasks found: ${taskCount}`));
        return;
    }

    // Ensure tasks is an array
    if (!Array.isArray(tasks)) {
      tasks = [tasks];
    }

    console.log(chalk.bold('\nImport Preview:'));
    console.log(chalk.gray(`  Tasks to import: ${tasks.length}`));
    
    // Show first few tasks
    const preview = tasks.slice(0, 5);
    for (const task of preview) {
      console.log(`\n  ${task.string_id || '(new)'}: ${task.name}`);
      if (task.status) console.log(chalk.gray(`    Status: ${task.status}`));
      if (task.assignee) console.log(chalk.gray(`    Assignee: ${task.assignee}`));
      if (task.tags?.length > 0) console.log(chalk.gray(`    Tags: ${task.tags.join(', ')}`));
    }
    
    if (tasks.length > 5) {
      console.log(chalk.gray(`\n  ... and ${tasks.length - 5} more`));
    }

    // Check for conflicts
    if (options.preserveIds) {
      const conflicts = await checkConflicts(api, tasks);
      if (conflicts.length > 0) {
        console.log(chalk.yellow(`\n  Conflicts: ${conflicts.length} task(s) with existing IDs`));
        console.log(chalk.gray(`  Mode '${options.mode}' will be applied to conflicts`));
      }
    }
  } catch (err) {
    console.error(chalk.red(`Preview error: ${err.message}`));
  }
}

/**
 * Check for ID conflicts
 */
async function checkConflicts(api, tasks) {
  const conflicts = [];
  
  for (const task of tasks) {
    if (task.string_id) {
      try {
        const existing = await api.getTask(task.string_id);
        if (existing) {
          conflicts.push(task.string_id);
        }
      } catch {
        // Task doesn't exist, no conflict
      }
    }
  }
  
  return conflicts;
}

/**
 * Get task statistics
 */
async function getTaskStats(api) {
  const allTasks = await api.listTasks({ include_archived: true });
  const activeTasks = allTasks.filter(t => t.status !== 'archived');
  
  return {
    total: allTasks.length,
    active: activeTasks.length,
    archived: allTasks.length - activeTasks.length
  };
}