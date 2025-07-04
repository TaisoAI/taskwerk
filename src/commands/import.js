/**
 * TaskWerk v3 Import Command
 *
 * Imports tasks from various formats (v2 TaskWerk, YAML, JSON, Markdown)
 */

import { BaseCommand } from '../cli/base-command.js';
import { readFile, access } from 'fs/promises';
import { constants } from 'fs';
import { extname } from 'path';
import yaml from 'js-yaml';
import chalk from 'chalk';

/**
 * Import command implementation for v3
 */
export class ImportCommand extends BaseCommand {
  constructor() {
    super('import', 'Import tasks from various formats');

    // Set category
    this.category = 'Data Management';

    // Define arguments
    this.argument('file', 'File path to import from');

    // Define options
    this.option('-f, --format <format>', 'Source format (auto|v2|yaml|json|markdown)', 'auto')
      .option('--dry-run', 'Preview import without making changes')
      .option('--overwrite', 'Overwrite existing tasks with same ID')
      .option('--category <category>', 'Add category to all imported tasks')
      .option('--assignee <assignee>', 'Assign all imported tasks to assignee')
      .option('--priority <priority>', 'Override priority for all imported tasks');
  }

  /**
   * Execute import command
   */
  async execute(args, options) {
    const filePath = args[0];

    if (!filePath) {
      throw new Error('File path is required');
    }

    // Check if file exists
    try {
      await access(filePath, constants.F_OK);
    } catch (error) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Detect format if auto
    let format = options.format;
    if (format === 'auto') {
      format = this.detectFormat(filePath);
    }

    // Validate format
    if (!['v2', 'yaml', 'json', 'markdown'].includes(format)) {
      throw new Error('Format must be one of: v2, yaml, json, markdown');
    }

    this.info(`Importing from ${filePath} (format: ${format})`);

    try {
      // Read and parse file
      const content = await readFile(filePath, 'utf-8');
      const tasks = await this.parseContent(content, format);

      if (tasks.length === 0) {
        this.warn('No tasks found in the file');
        return;
      }

      // Apply global options
      const processedTasks = this.processTasksWithOptions(tasks, options);

      // Preview mode
      if (options.dryRun) {
        this.previewImport(processedTasks);
        return;
      }

      // Import tasks
      const imported = await this.importTasks(processedTasks, options);

      this.success(`Successfully imported ${imported.length} tasks`);

      // Show summary
      this.showImportSummary(imported);

      return imported;
    } catch (error) {
      throw new Error(`Failed to import tasks: ${error.message}`);
    }
  }

  /**
   * Detect file format based on extension and content
   */
  detectFormat(filePath) {
    const ext = extname(filePath).toLowerCase();

    switch (ext) {
      case '.yaml':
      case '.yml':
        return 'yaml';
      case '.json':
        return 'json';
      case '.md':
      case '.markdown':
        return 'markdown';
      default:
        // Check if it's a v2 TaskWerk file
        if (filePath.includes('tasks.md') || filePath.includes('completed.md')) {
          return 'v2';
        }
        return 'json'; // Default fallback
    }
  }

  /**
   * Parse content based on format
   */
  async parseContent(content, format) {
    switch (format) {
      case 'v2':
        return this.parseV2Format(content);
      case 'yaml':
        return this.parseYamlFormat(content);
      case 'json':
        return this.parseJsonFormat(content);
      case 'markdown':
        return this.parseMarkdownFormat(content);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Parse v2 TaskWerk format (markdown)
   */
  parseV2Format(content) {
    const tasks = [];
    const lines = content.split('\n');
    let currentTask = null;
    let inTask = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Task header: ## TASK-001: Task Name
      const taskMatch = trimmed.match(/^##\s+TASK-(\d+):\s*(.+)$/);
      if (taskMatch) {
        if (currentTask) {
          tasks.push(currentTask);
        }

        currentTask = {
          string_id: `TASK-${taskMatch[1]}`,
          name: taskMatch[2],
          description: taskMatch[2],
          priority: 'medium',
          status: 'todo',
          category: null,
          assignee: null,
          estimated: null,
          progress: 0,
        };
        inTask = true;
        continue;
      }

      if (!inTask || !currentTask) {
        continue;
      }

      // Parse metadata
      if (trimmed.startsWith('- **Priority:**')) {
        const priority = trimmed.replace('- **Priority:**', '').trim().toLowerCase();
        if (['high', 'medium', 'low'].includes(priority)) {
          currentTask.priority = priority;
        }
      } else if (trimmed.startsWith('- **Category:**')) {
        currentTask.category = trimmed.replace('- **Category:**', '').trim();
      } else if (trimmed.startsWith('- **Assignee:**')) {
        currentTask.assignee = trimmed.replace('- **Assignee:**', '').trim();
      } else if (trimmed.startsWith('- **Status:**')) {
        const status = trimmed.replace('- **Status:**', '').trim().toLowerCase();
        if (['todo', 'in_progress', 'completed'].includes(status)) {
          currentTask.status = status;
        }
      } else if (trimmed.startsWith('- **Estimated:**')) {
        const estimate = parseFloat(
          trimmed.replace('- **Estimated:**', '').replace('h', '').trim()
        );
        if (!isNaN(estimate)) {
          currentTask.estimated = estimate;
        }
      } else if (trimmed.startsWith('- **Progress:**')) {
        const progress = parseInt(trimmed.replace('- **Progress:**', '').replace('%', '').trim());
        if (!isNaN(progress)) {
          currentTask.progress = progress;
        }
      }

      // End of task (empty line or start of next section)
      if (trimmed === '' || trimmed.startsWith('##')) {
        if (currentTask && trimmed.startsWith('##')) {
          // This is the start of the next task, don't add current task yet
          continue;
        }
      }
    }

    // Add the last task
    if (currentTask) {
      tasks.push(currentTask);
    }

    return tasks;
  }

  /**
   * Parse YAML format
   */
  parseYamlFormat(content) {
    try {
      const data = yaml.load(content);

      if (!data || !Array.isArray(data.tasks)) {
        throw new Error('YAML file must contain a "tasks" array');
      }

      return data.tasks.map(task => ({
        string_id: task.id || task.string_id,
        name: task.name || task.title,
        description: task.description || task.name || task.title,
        priority: task.priority || 'medium',
        status: task.status || 'todo',
        category: task.category || null,
        assignee: task.assignee || null,
        estimated: task.estimated || task.estimate || null,
        progress: task.progress || 0,
      }));
    } catch (error) {
      throw new Error(`Invalid YAML format: ${error.message}`);
    }
  }

  /**
   * Parse JSON format
   */
  parseJsonFormat(content) {
    try {
      const data = JSON.parse(content);

      if (!data || !Array.isArray(data.tasks)) {
        throw new Error('JSON file must contain a "tasks" array');
      }

      return data.tasks.map(task => ({
        string_id: task.id || task.string_id,
        name: task.name || task.title,
        description: task.description || task.name || task.title,
        priority: task.priority || 'medium',
        status: task.status || 'todo',
        category: task.category || null,
        assignee: task.assignee || null,
        estimated: task.estimated || task.estimate || null,
        progress: task.progress || 0,
      }));
    } catch (error) {
      throw new Error(`Invalid JSON format: ${error.message}`);
    }
  }

  /**
   * Parse Markdown format (generic checklist)
   */
  parseMarkdownFormat(content) {
    const tasks = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Match markdown checkboxes: - [ ] Task name or - [x] Task name
      const taskMatch = trimmed.match(/^-\s+\[([ x])\]\s+(.+)$/);
      if (taskMatch) {
        const completed = taskMatch[1] === 'x';
        const name = taskMatch[2];

        tasks.push({
          string_id: null, // Will be generated
          name: name,
          description: name,
          priority: 'medium',
          status: completed ? 'completed' : 'todo',
          category: null,
          assignee: null,
          estimated: null,
          progress: completed ? 100 : 0,
        });
      }
    }

    return tasks;
  }

  /**
   * Apply global options to tasks
   */
  processTasksWithOptions(tasks, options) {
    return tasks.map(task => {
      const processed = { ...task };

      // Apply global overrides
      if (options.category) {
        processed.category = options.category;
      }
      if (options.assignee) {
        processed.assignee = options.assignee;
      }
      if (options.priority) {
        processed.priority = options.priority;
      }

      return processed;
    });
  }

  /**
   * Preview import without making changes
   */
  previewImport(tasks) {
    console.log(chalk.bold('\n📋 Import Preview'));
    console.log(''.padEnd(50, '─'));

    console.log(`\n${chalk.bold('Tasks to import:')} ${tasks.length}`);

    for (const task of tasks) {
      const statusIcon =
        task.status === 'completed' ? '✓' : task.status === 'in_progress' ? '●' : '○';
      const priorityColor =
        task.priority === 'high' ? 'red' : task.priority === 'medium' ? 'yellow' : 'green';

      console.log(`  ${statusIcon} ${task.string_id || 'NEW'} - ${task.name}`);
      console.log(`    Priority: ${chalk[priorityColor](task.priority)} | Status: ${task.status}`);
      if (task.category) {
        console.log(`    Category: ${chalk.cyan(task.category)}`);
      }
      if (task.assignee) {
        console.log(`    Assignee: ${chalk.cyan('@' + task.assignee)}`);
      }
      console.log();
    }

    console.log(
      chalk.yellow('\n⚠️  This is a preview only. Use --dry-run=false to actually import.')
    );
  }

  /**
   * Import tasks into the database
   */
  async importTasks(tasks, options) {
    const imported = [];
    const skipped = [];

    for (const task of tasks) {
      try {
        // Check if task already exists
        if (task.string_id) {
          try {
            const existing = await this.apis.task.getTask(task.string_id);
            if (existing && !options.overwrite) {
              skipped.push({ task, reason: 'already exists' });
              continue;
            }
          } catch (error) {
            // Task doesn't exist, continue with import
          }
        }

        // Create the task
        const createdTask = await this.apis.task.createTask(task);
        imported.push(createdTask);
      } catch (error) {
        skipped.push({ task, reason: error.message });
      }
    }

    if (skipped.length > 0) {
      console.log(chalk.yellow(`\n⚠️  Skipped ${skipped.length} tasks:`));
      for (const { task, reason } of skipped) {
        console.log(`  - ${task.name}: ${reason}`);
      }
    }

    return imported;
  }

  /**
   * Show import summary
   */
  showImportSummary(tasks) {
    console.log(chalk.bold('\n📊 Import Summary'));
    console.log(''.padEnd(30, '─'));

    const byStatus = {};
    const byPriority = {};
    const byCategory = {};

    for (const task of tasks) {
      byStatus[task.status] = (byStatus[task.status] || 0) + 1;
      byPriority[task.priority] = (byPriority[task.priority] || 0) + 1;
      if (task.category) {
        byCategory[task.category] = (byCategory[task.category] || 0) + 1;
      }
    }

    console.log(`\n${chalk.bold('By Status:')}`);
    for (const [status, count] of Object.entries(byStatus)) {
      console.log(`  ${status}: ${count}`);
    }

    console.log(`\n${chalk.bold('By Priority:')}`);
    for (const [priority, count] of Object.entries(byPriority)) {
      const color = priority === 'high' ? 'red' : priority === 'medium' ? 'yellow' : 'green';
      console.log(`  ${chalk[color](priority)}: ${count}`);
    }

    if (Object.keys(byCategory).length > 0) {
      console.log(`\n${chalk.bold('By Category:')}`);
      for (const [category, count] of Object.entries(byCategory)) {
        console.log(`  ${chalk.cyan(category)}: ${count}`);
      }
    }
  }
}

// Export as default for auto-discovery
export default ImportCommand;
