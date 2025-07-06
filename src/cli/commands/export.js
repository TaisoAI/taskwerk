/**
 * Export Command
 * 
 * @description Export tasks to various formats
 * @module taskwerk/cli/commands/export
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { TaskwerkAPI } from '../../core/api.js';
import { initializeStorage } from '../../storage/index.js';
import path from 'path';

/**
 * Creates the export command
 * @returns {Command} The export command
 */
export function makeExportCommand() {
  return new Command('export')
    .description('Export tasks to file')
    .argument('[file]', 'Output file path (format inferred from extension)')
    .option('-f, --format <format>', 'Export format: json, yaml, markdown, csv')
    .option('-s, --status <status>', 'Filter by status')
    .option('-a, --assignee <person>', 'Filter by assignee')
    .option('-t, --tags <tags>', 'Filter by tags (comma-separated)')
    .option('--include-archived', 'Include archived tasks')
    .option('--include-notes', 'Include task notes')
    .option('--include-history', 'Include task history')
    .option('--no-tags', 'Exclude tags from export')
    .option('--stdout', 'Output to stdout instead of file')
    .action(async (file, options) => {
      await handleExport(file, options);
    });
}

/**
 * Handle export command
 */
async function handleExport(file, options) {
  try {
    // Initialize storage and API
    const storage = await initializeStorage();
    const api = new TaskwerkAPI({ database: storage.db });

    // Determine format
    let format = options.format;
    if (!format && file) {
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
    } else if (!format) {
      format = 'json'; // Default format
    }

    // Build filters
    const filters = {};
    if (options.status) {
      filters.status = options.status.toLowerCase();
    }
    if (options.assignee) {
      filters.assignee = options.assignee;
    }
    if (options.includeArchived) {
      filters.include_archived = true;
    }

    // Build export options
    const exportOptions = {
      format,
      filters,
      includeNotes: options.includeNotes,
      includeHistory: options.includeHistory,
      includeTags: options.tags !== false
    };

    // Filter by tags if specified
    if (options.tags) {
      // This is a bit hacky - we'll filter after export
      // In a real implementation, we'd enhance the filter system
      exportOptions.filterTags = options.tags.split(',').map(t => t.trim());
    }

    // Export data
    let result;
    if (file && !options.stdout) {
      result = await api.importExport.exportToFile(file, exportOptions);
      console.log(chalk.green(`✓ Exported to ${result.path}`));
      console.log(chalk.gray(`  Format: ${result.format}`));
      console.log(chalk.gray(`  Size: ${formatFileSize(result.size)}`));
    } else {
      const data = await api.importExport.exportTasks(exportOptions);
      
      // Apply tag filter if needed
      if (exportOptions.filterTags && format === 'json') {
        const tasks = JSON.parse(data);
        const filtered = tasks.filter(task => 
          exportOptions.filterTags.some(tag => (task.tags || []).includes(tag))
        );
        console.log(JSON.stringify(filtered, null, 2));
      } else {
        console.log(data);
      }
    }

    // Show stats
    if (!options.stdout) {
      const stats = await getExportStats(api, exportOptions);
      console.log(chalk.gray(`  Tasks: ${stats.taskCount}`));
      if (options.includeNotes) {
        console.log(chalk.gray(`  Notes: ${stats.noteCount}`));
      }
    }

    storage.close();
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Get export statistics
 */
async function getExportStats(api, options) {
  const tasks = await api.listTasks(options.filters);
  let noteCount = 0;
  
  if (options.includeNotes) {
    for (const task of tasks) {
      const notes = await api.getTaskNotes(task.string_id);
      noteCount += notes.length;
    }
  }
  
  return {
    taskCount: tasks.length,
    noteCount
  };
}

/**
 * Format file size
 */
function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}