import { Command } from 'commander';
import { TaskwerkAPI } from '../api/taskwerk-api.js';
import { Logger } from '../logging/logger.js';
import fs from 'fs/promises';

export function exportCommand() {
  const exp = new Command('export');

  exp
    .description('Export tasks to a file')
    .option('-f, --format <format>', 'Export format (json, markdown, csv)', 'markdown')
    .option('-o, --output <file>', 'Output file path (auto-generated if not specified)')
    .option('-s, --status <status>', 'Filter by status')
    .option('-a, --assignee <name>', 'Filter by assignee')
    .option('-t, --tasks <ids...>', 'Export specific tasks by ID')
    .option('--all', 'Include completed and cancelled tasks')
    .option('--with-subtasks', 'Include subtasks of exported tasks')
    .option('--with-metadata', 'Include YAML frontmatter metadata (markdown only)')
    .option('--stdout', 'Output to stdout instead of file')
    .addHelpText(
      'after',
      `
Examples:
  Basic exports:
    $ twrk export                                # Export active tasks to dated file
    $ twrk export -o mytasks.md                  # Export to specific filename
    $ twrk export --stdout                       # Output to terminal (pipe-friendly)
    $ twrk export --all                          # Include completed/cancelled tasks
    
  Export specific tasks:
    $ twrk export -t 1 2 3                       # Export tasks 1, 2, and 3
    $ twrk export -t TASK-001 TASK-002           # Use full IDs
    $ twrk export -t 1 --with-subtasks           # Include all subtasks
    
  Filter exports:
    $ twrk export -s todo                        # Only todo tasks
    $ twrk export -s in-progress -a @john        # John's active tasks
    $ twrk export -a @ai-agent                   # Tasks for AI to work on
    
  Different formats:
    $ twrk export -f json                        # JSON for programmatic use
    $ twrk export -f csv                         # CSV for spreadsheets
    $ twrk export -f markdown --with-metadata    # Markdown with YAML frontmatter
    
  AI/LLM workflows:
    $ twrk export -t 1 2 3 --stdout | pbcopy     # Copy to clipboard (macOS)
    $ twrk export -a @ai-agent -o ai-tasks.md    # Export AI's assigned tasks
    $ twrk export -s todo --stdout | llm         # Pipe directly to LLM CLI
    
  Advanced examples:
    $ twrk export -t $(twrk listtask -s blocked --format json | jq -r '.[].id')
    $ twrk export --all -f json | jq '.[] | select(.priority=="high")'
    $ twrk export -s todo --stdout | grep -A5 "Priority: high"
    
Note: 
  - Default format is Markdown, perfect for LLMs
  - Files are saved as 'tasks-export-YYYY-MM-DD.{ext}'
  - Use --stdout to pipe to other commands`
    )
    .action(async options => {
      const logger = new Logger('export');

      try {
        const api = new TaskwerkAPI();

        // Build query options
        const queryOptions = {};
        if (options.status) {
          queryOptions.status = options.status;
        }
        if (options.assignee) {
          queryOptions.assignee = options.assignee;
        }

        // Get tasks
        let tasks;

        if (options.tasks && options.tasks.length > 0) {
          // Export specific tasks by ID
          tasks = [];
          for (const taskId of options.tasks) {
            try {
              const task = api.getTask(taskId);
              tasks.push(task);

              // Include subtasks if requested
              if (options.withSubtasks) {
                const subtasks = api.getSubtasks(task.id);
                tasks.push(...subtasks);
              }
            } catch (error) {
              logger.warn(`Failed to get task ${taskId}: ${error.message}`);
              console.warn(`⚠️  Skipping ${taskId}: ${error.message}`);
            }
          }
        } else {
          // Export filtered tasks
          tasks = api.listTasks(queryOptions);

          // Filter out completed and cancelled tasks unless --all is specified
          if (!options.all) {
            tasks = tasks.filter(
              task => task.status !== 'completed' && task.status !== 'cancelled'
            );
          }
        }

        if (tasks.length === 0) {
          console.log('No tasks found matching the criteria.');
          return;
        }

        // Format output based on format option
        let output;
        switch (options.format) {
          case 'markdown':
            output = await formatAsMarkdown(tasks, api, options.withMetadata);
            break;
          case 'json':
            output = formatAsJson(tasks);
            break;
          case 'csv':
            output = formatAsCsv(tasks);
            break;
          default:
            throw new Error(`Unsupported format: ${options.format}`);
        }

        // Write output
        if (options.stdout) {
          // Output to stdout (old behavior)
          console.log(output);
        } else {
          // Save to file (new default behavior)
          let filename = options.output;
          if (!filename) {
            // Generate filename based on date and format
            const date = new Date().toISOString().split('T')[0];
            const extension =
              options.format === 'json' ? 'json' : options.format === 'csv' ? 'csv' : 'md';
            filename = `tasks-export-${date}.${extension}`;
          }

          await fs.writeFile(filename, output, 'utf8');
          console.log(`✅ Exported ${tasks.length} tasks to ${filename}`);
        }
      } catch (error) {
        logger.error('Export failed', error);
        console.error('❌ Export failed:', error.message);
        process.exit(1);
      }
    });

  return exp;
}

async function formatAsMarkdown(tasks, api, includeMetadata = false) {
  const date = new Date().toISOString().split('T')[0];
  let output = '';

  if (includeMetadata) {
    output += '---\n';
    output += `title: Tasks Export\n`;
    output += `date: ${date}\n`;
    output += `taskCount: ${tasks.length}\n`;
    output += '---\n\n';
  }

  output += `# Tasks Export - ${date}\n\n`;

  // Add LLM-friendly instructions
  output += `> The following tasks are exported from the Taskwerk task management system. Each task includes its ID, name, status, priority, and other relevant details.\n\n`;

  for (const task of tasks) {
    output += `## ${task.id}: ${task.name}\n`;
    output += `- Status: ${task.status}\n`;
    output += `- Priority: ${task.priority}\n`;

    if (task.assignee) {
      output += `- Assignee: ${task.assignee}\n`;
    }

    if (task.estimate) {
      output += `- Estimate: ${task.estimate} hours\n`;
    }

    if (task.due_date) {
      output += `- Due: ${task.due_date}\n`;
    }

    // Get and display tags
    const tags = api.getTaskTags(task.id);
    if (tags.length > 0) {
      output += `- Tags: ${tags.join(', ')}\n`;
    }

    if (task.category) {
      output += `- Category: ${task.category}\n`;
    }

    output += `- Created: ${new Date(task.created_at).toLocaleString()}\n`;

    if (task.updated_at) {
      output += `- Updated: ${new Date(task.updated_at).toLocaleString()}\n`;
    }

    if (task.description) {
      output += `\n${task.description}\n`;
    }

    if (task.content) {
      output += `\n### Details\n${task.content}\n`;
    }

    // Get and display notes
    const notes = api.getTaskNotes(task.id);
    if (notes.length > 0) {
      output += `\n### Notes\n`;
      for (const note of notes) {
        const noteDate = new Date(note.created_at).toLocaleString();
        output += `- [${noteDate}] @${note.user}: ${note.note}\n`;
        if (note.content) {
          const indentedContent = note.content
            .split('\n')
            .map(line => `  ${line}`)
            .join('\n');
          output += `${indentedContent}\n`;
        }
      }
    }

    // Get dependencies
    const dependencies = api.getTaskDependencies(task.id);
    if (dependencies.length > 0) {
      output += `\n### Dependencies\n`;
      for (const dep of dependencies) {
        output += `- ${dep.id}: ${dep.name}\n`;
      }
    }

    output += '\n---\n\n';
  }

  return output.trim() + '\n';
}

function formatAsJson(tasks) {
  return JSON.stringify(tasks, null, 2) + '\n';
}

function formatAsCsv(tasks) {
  const headers = [
    'ID',
    'Name',
    'Description',
    'Status',
    'Priority',
    'Assignee',
    'Category',
    'Estimate',
    'Due Date',
    'Created At',
    'Updated At',
    'Created By',
    'Updated By',
  ];

  let output = headers.join(',') + '\n';

  for (const task of tasks) {
    const row = [
      task.id,
      escapeCSV(task.name),
      escapeCSV(task.description || ''),
      task.status,
      task.priority,
      task.assignee || '',
      task.category || '',
      task.estimate || '',
      task.due_date || '',
      task.created_at,
      task.updated_at || '',
      task.created_by || '',
      task.updated_by || '',
    ];

    output += row.join(',') + '\n';
  }

  return output;
}

function escapeCSV(value) {
  if (typeof value !== 'string') {
    return value;
  }

  // If value contains comma, newline, or double quote, wrap in quotes
  if (value.includes(',') || value.includes('\n') || value.includes('"')) {
    // Escape double quotes by doubling them
    value = value.replace(/"/g, '""');
    return `"${value}"`;
  }

  return value;
}
