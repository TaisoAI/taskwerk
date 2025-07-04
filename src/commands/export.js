/**
 * TaskWerk v3 Export Command
 *
 * Exports tasks to various formats (YAML, JSON, Markdown, v2 format)
 */

import { BaseCommand } from '../cli/base-command.js';
import { writeFile } from 'fs/promises';
import { extname } from 'path';
import yaml from 'js-yaml';

/**
 * Export command implementation for v3
 */
export class ExportCommand extends BaseCommand {
  constructor() {
    super('export', 'Export tasks to various formats');

    // Set category
    this.category = 'Data Management';

    // Define arguments
    this.argument('[file]', 'Output file path (optional, defaults to stdout)');

    // Define options
    this.option('-f, --format <format>', 'Output format (yaml|json|markdown|v2)', 'yaml')
      .option('-s, --status <status>', 'Filter by status (todo|in_progress|completed|all)', 'all')
      .option('-p, --priority <priority>', 'Filter by priority (high|medium|low)')
      .option('-c, --category <category>', 'Filter by category')
      .option('-a, --assignee <assignee>', 'Filter by assignee')
      .option('--completed', 'Include completed tasks')
      .option('--archived', 'Include archived tasks')
      .option('--pretty', 'Pretty-print output (JSON only)')
      .option('--template <template>', 'Use custom template file');
  }

  /**
   * Execute export command
   */
  async execute(args, options) {
    const outputFile = args[0];
    let format = options.format;

    // Auto-detect format from file extension
    if (outputFile && !options.format) {
      format = this.detectFormat(outputFile);
    }

    // Validate format
    if (!['yaml', 'json', 'markdown', 'v2'].includes(format)) {
      throw new Error('Format must be one of: yaml, json, markdown, v2');
    }

    this.info(`Exporting tasks (format: ${format})`);

    try {
      // Build filter criteria
      const filters = this.buildFilters(options);

      // Get tasks
      const result = await this.apis.task.listTasks(filters);
      let tasks = result.tasks;

      // Apply additional filtering
      tasks = this.applyFilters(tasks, options);

      if (tasks.length === 0) {
        this.warn('No tasks found matching the criteria');
        return;
      }

      // Export to specified format
      const output = await this.exportTasks(tasks, format, options);

      // Write to file or stdout
      if (outputFile) {
        await writeFile(outputFile, output, 'utf-8');
        this.success(`Exported ${tasks.length} tasks to ${outputFile}`);
      } else {
        console.log(output);
      }

      return { tasks, output };
    } catch (error) {
      throw new Error(`Failed to export tasks: ${error.message}`);
    }
  }

  /**
   * Detect format from file extension
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
        return 'yaml';
    }
  }

  /**
   * Build API filter criteria
   */
  buildFilters(options) {
    const filters = {};

    if (options.status && options.status !== 'all') {
      filters.status = options.status;
    }

    if (options.priority) {
      filters.priority = options.priority;
    }

    if (options.category) {
      filters.category = options.category;
    }

    if (options.assignee) {
      filters.assignee = options.assignee;
    }

    return filters;
  }

  /**
   * Apply additional client-side filtering
   */
  applyFilters(tasks, options) {
    let filtered = tasks;

    // Handle status filtering
    if (options.status === 'all') {
      // Include all tasks
    } else if (options.completed) {
      filtered = filtered.filter(task => task.status === 'completed');
    } else if (options.archived) {
      filtered = filtered.filter(task => task.status === 'archived');
    } else if (!options.status) {
      // Default to active tasks only
      filtered = filtered.filter(task => task.status === 'todo' || task.status === 'in_progress');
    }

    return filtered;
  }

  /**
   * Export tasks to specified format
   */
  async exportTasks(tasks, format, options) {
    switch (format) {
      case 'yaml':
        return this.exportToYaml(tasks, options);
      case 'json':
        return this.exportToJson(tasks, options);
      case 'markdown':
        return this.exportToMarkdown(tasks, options);
      case 'v2':
        return this.exportToV2Format(tasks, options);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Export to YAML format
   */
  exportToYaml(tasks, _options) {
    const data = {
      version: '3.0.0',
      exported_at: new Date().toISOString(),
      tasks: tasks.map(task => ({
        id: task.string_id,
        name: task.name,
        description: task.description,
        priority: task.priority,
        status: task.status,
        category: task.category,
        assignee: task.assignee,
        estimated: task.estimated,
        progress: task.progress,
        created_at: task.created_at,
        updated_at: task.updated_at,
        completed_at: task.completed_at,
      })),
    };

    return yaml.dump(data, {
      indent: 2,
      lineWidth: 120,
      noRefs: true,
    });
  }

  /**
   * Export to JSON format
   */
  exportToJson(tasks, options) {
    const data = {
      version: '3.0.0',
      exported_at: new Date().toISOString(),
      tasks: tasks.map(task => ({
        id: task.string_id,
        name: task.name,
        description: task.description,
        priority: task.priority,
        status: task.status,
        category: task.category,
        assignee: task.assignee,
        estimated: task.estimated,
        progress: task.progress,
        created_at: task.created_at,
        updated_at: task.updated_at,
        completed_at: task.completed_at,
      })),
    };

    return JSON.stringify(data, null, options.pretty ? 2 : 0);
  }

  /**
   * Export to Markdown format
   */
  exportToMarkdown(tasks, _options) {
    const lines = [];

    lines.push('# TaskWerk Export');
    lines.push('');
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push(`Tasks: ${tasks.length}`);
    lines.push('');

    // Group by status
    const statusGroups = {
      todo: tasks.filter(t => t.status === 'todo'),
      in_progress: tasks.filter(t => t.status === 'in_progress'),
      completed: tasks.filter(t => t.status === 'completed'),
      archived: tasks.filter(t => t.status === 'archived'),
    };

    for (const [status, statusTasks] of Object.entries(statusGroups)) {
      if (statusTasks.length === 0) {
        continue;
      }

      lines.push(`## ${status.replace('_', ' ').toUpperCase()}`);
      lines.push('');

      for (const task of statusTasks) {
        const checkbox = task.status === 'completed' ? '[x]' : '[ ]';
        lines.push(`- ${checkbox} **${task.string_id}**: ${task.name}`);

        if (task.description && task.description !== task.name) {
          lines.push(`  - ${task.description}`);
        }

        const metadata = [];
        if (task.priority !== 'medium') {
          metadata.push(`Priority: ${task.priority}`);
        }
        if (task.category) {
          metadata.push(`Category: ${task.category}`);
        }
        if (task.assignee) {
          metadata.push(`Assignee: @${task.assignee}`);
        }
        if (task.estimated) {
          metadata.push(`Estimate: ${task.estimated}h`);
        }
        if (task.progress > 0) {
          metadata.push(`Progress: ${task.progress}%`);
        }

        if (metadata.length > 0) {
          lines.push(`  - ${metadata.join(' | ')}`);
        }

        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Export to v2 TaskWerk format
   */
  exportToV2Format(tasks, _options) {
    const lines = [];

    lines.push('# TaskWerk Tasks (v2 Format)');
    lines.push('');
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push('');

    // Group by status, but format as v2
    const activeTasks = tasks.filter(t => t.status === 'todo' || t.status === 'in_progress');
    const completedTasks = tasks.filter(t => t.status === 'completed');

    // Active tasks
    if (activeTasks.length > 0) {
      lines.push('## Active Tasks');
      lines.push('');

      for (const task of activeTasks) {
        lines.push(`## ${task.string_id}: ${task.name}`);
        lines.push('');

        if (task.description && task.description !== task.name) {
          lines.push(task.description);
          lines.push('');
        }

        lines.push(`- **Priority:** ${task.priority}`);
        lines.push(`- **Status:** ${task.status}`);

        if (task.category) {
          lines.push(`- **Category:** ${task.category}`);
        }
        if (task.assignee) {
          lines.push(`- **Assignee:** ${task.assignee}`);
        }
        if (task.estimated) {
          lines.push(`- **Estimated:** ${task.estimated}h`);
        }
        if (task.progress > 0) {
          lines.push(`- **Progress:** ${task.progress}%`);
        }
        if (task.created_at) {
          lines.push(`- **Created:** ${new Date(task.created_at).toLocaleString()}`);
        }

        lines.push('');
        lines.push('---');
        lines.push('');
      }
    }

    // Completed tasks
    if (completedTasks.length > 0) {
      lines.push('## Completed Tasks');
      lines.push('');

      for (const task of completedTasks) {
        lines.push(`## ${task.string_id}: ${task.name}`);
        lines.push('');

        if (task.description && task.description !== task.name) {
          lines.push(task.description);
          lines.push('');
        }

        lines.push(`- **Priority:** ${task.priority}`);
        lines.push(`- **Status:** completed`);

        if (task.category) {
          lines.push(`- **Category:** ${task.category}`);
        }
        if (task.assignee) {
          lines.push(`- **Assignee:** ${task.assignee}`);
        }
        if (task.estimated) {
          lines.push(`- **Estimated:** ${task.estimated}h`);
        }
        if (task.completed_at) {
          lines.push(`- **Completed:** ${new Date(task.completed_at).toLocaleString()}`);
        }

        lines.push('');
        lines.push('---');
        lines.push('');
      }
    }

    return lines.join('\n');
  }
}

// Export as default for auto-discovery
export default ExportCommand;
