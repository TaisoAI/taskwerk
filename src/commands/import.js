import { Command } from 'commander';
import { TaskwerkAPI } from '../api/taskwerk-api.js';
import { Logger } from '../logging/logger.js';
import fs from 'fs/promises';
import path from 'path';

export function importCommand() {
  const imp = new Command('import');

  imp
    .description('Import tasks from a file')
    .argument('<file>', 'File to import')
    .option('-f, --format <format>', 'Import format (markdown, json, csv)', 'markdown')
    .option('--update', 'Update existing tasks by ID')
    .option('--prefix <prefix>', 'Add prefix to imported task IDs')
    .option('--dry-run', 'Preview import without making changes')
    .action(async (file, options) => {
      const logger = new Logger('import');

      try {
        // Check if file exists
        const filePath = path.resolve(file);
        try {
          await fs.access(filePath);
        } catch (error) {
          throw new Error(`File not found: ${filePath}`);
        }

        // Read file content
        const content = await fs.readFile(filePath, 'utf8');

        if (content.trim().length === 0) {
          console.log('❌ File is empty');
          return;
        }

        // Parse content based on format
        let tasks;
        switch (options.format) {
          case 'markdown':
            tasks = parseMarkdown(content);
            break;
          case 'json':
            tasks = parseJson(content);
            break;
          case 'csv':
            tasks = parseCsv(content);
            break;
          default:
            throw new Error(`Unsupported format: ${options.format}`);
        }

        if (tasks.length === 0) {
          console.log('❌ No tasks found in file');
          return;
        }

        // Process tasks for import
        const processedTasks = processTasks(tasks, options);

        // Preview mode
        if (options.dryRun) {
          console.log(`\n📋 Import Preview (${processedTasks.length} tasks):`);
          processedTasks.forEach((task, index) => {
            console.log(`${index + 1}. ${task.id}: ${task.name}`);
            if (task.status) {
              console.log(`   Status: ${task.status}`);
            }
            if (task.priority) {
              console.log(`   Priority: ${task.priority}`);
            }
            if (task.assignee) {
              console.log(`   Assignee: ${task.assignee}`);
            }
          });
          console.log('\nUse --dry-run=false to actually import these tasks.');
          return;
        }

        // Import tasks
        const api = new TaskwerkAPI();
        const results = await importTasks(api, processedTasks, options);

        // Report results
        console.log(`\n📊 Import Summary:`);
        console.log(`   Tasks processed: ${processedTasks.length}`);
        console.log(`   Successfully imported: ${results.imported}`);
        if (results.updated > 0) {
          console.log(`   Updated: ${results.updated}`);
        }
        if (results.skipped > 0) {
          console.log(`   Skipped (already exist): ${results.skipped}`);
        }
        if (results.errors > 0) {
          console.log(`   Errors: ${results.errors}`);
        }
      } catch (error) {
        logger.error('Import failed', error);
        console.error('❌ Import failed:', error.message);
        process.exit(1);
      }
    });

  return imp;
}

function parseMarkdown(content) {
  const tasks = [];
  const lines = content.split('\n');
  let currentTask = null;
  let inYamlFrontmatter = false;
  let inNotesSection = false;
  let inDetailsSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Handle YAML frontmatter
    if (line === '---') {
      if (i === 0) {
        inYamlFrontmatter = true;
        continue;
      } else if (inYamlFrontmatter) {
        inYamlFrontmatter = false;
        // Parse YAML frontmatter if needed
        continue;
      }
    }

    if (inYamlFrontmatter) {
      continue;
    }

    // Task headers (## TASK-XXX: Name or ## Name)
    if (line.startsWith('## ')) {
      // Save previous task
      if (currentTask) {
        tasks.push(currentTask);
      }

      // Parse new task
      const headerMatch = line.match(/^## (?:(TASK-\d+|[A-Z]+-\d+):\s*)?(.+)$/);
      if (headerMatch) {
        currentTask = {
          id: headerMatch[1] || null,
          name: headerMatch[2].trim(),
          description: '',
          status: 'todo',
          priority: 'medium',
          notes: [],
          tags: [],
        };
        inNotesSection = false;
        inDetailsSection = false;
      }
      continue;
    }

    if (!currentTask) {
      continue;
    }

    // Section headers
    if (line.startsWith('### ')) {
      const section = line.substring(4).toLowerCase();
      inNotesSection = section === 'notes';
      inDetailsSection = section === 'details';
      continue;
    }

    // Metadata lines (- Key: Value)
    if (line.startsWith('- ') && !inNotesSection && !inDetailsSection) {
      const metaMatch = line.match(/^- ([^:]+):\s*(.+)$/);
      if (metaMatch) {
        const key = metaMatch[1].toLowerCase().trim();
        const value = metaMatch[2].trim();

        switch (key) {
          case 'status':
            currentTask.status = value;
            break;
          case 'priority':
            currentTask.priority = value;
            break;
          case 'assignee':
            currentTask.assignee = value;
            break;
          case 'estimate': {
            const estimateMatch = value.match(/^(\d+)/);
            if (estimateMatch) {
              currentTask.estimate = parseInt(estimateMatch[1]);
            }
            break;
          }
          case 'due':
          case 'due date':
            currentTask.due_date = value;
            break;
          case 'tags':
            currentTask.tags = value.split(',').map(tag => tag.trim());
            break;
          case 'category':
            currentTask.category = value;
            break;
        }
      }
      continue;
    }

    // Notes section
    if (inNotesSection && line.startsWith('- ')) {
      const noteMatch = line.match(/^- \[([^\]]+)\] @([^:]+):\s*(.+)$/);
      if (noteMatch) {
        currentTask.notes.push({
          timestamp: noteMatch[1],
          user: noteMatch[2],
          note: noteMatch[3],
        });
      }
      continue;
    }

    // Task description/content
    if (line && !line.startsWith('#') && !line.startsWith('---') && !inNotesSection) {
      if (inDetailsSection) {
        currentTask.content = (currentTask.content || '') + line + '\n';
      } else if (!currentTask.description) {
        currentTask.description = line;
      } else {
        currentTask.description += '\n' + line;
      }
    }
  }

  // Save last task
  if (currentTask) {
    tasks.push(currentTask);
  }

  return tasks;
}

function parseJson(content) {
  try {
    const data = JSON.parse(content);
    return Array.isArray(data) ? data : [data];
  } catch (error) {
    throw new Error(`Invalid JSON format: ${error.message}`);
  }
}

function parseCsv(content) {
  const lines = content.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV must have at least a header row and one data row');
  }

  const headers = parseCsvLine(lines[0]);
  const tasks = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length === 0) {
      continue;
    }

    const task = {};
    headers.forEach((header, index) => {
      const value = values[index] || '';
      const key = header.toLowerCase().replace(/\s+/g, '_');

      if (value) {
        switch (key) {
          case 'estimate':
            task.estimate = parseInt(value) || null;
            break;
          case 'priority':
            task.priority = value.toLowerCase();
            break;
          case 'status':
            task.status = value.toLowerCase().replace(/[-\s]/g, '_');
            break;
          default:
            task[key] = value;
        }
      }
    });

    if (task.name || task.id) {
      tasks.push(task);
    }
  }

  return tasks;
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"' && (i === 0 || line[i - 1] === ',')) {
      inQuotes = true;
    } else if (char === '"' && inQuotes && (i === line.length - 1 || line[i + 1] === ',')) {
      inQuotes = false;
    } else if (char === '"' && inQuotes && line[i + 1] === '"') {
      current += '"';
      i++; // Skip next quote
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function processTasks(tasks, options) {
  const processed = [];
  let idCounter = 1;

  for (const task of tasks) {
    const processedTask = { ...task };

    // Generate ID if missing
    if (!processedTask.id) {
      processedTask.id = `TASK-${String(idCounter).padStart(3, '0')}`;
      idCounter++;
    }

    // Add prefix if specified
    if (options.prefix) {
      // Extract the number part and replace prefix
      const numberMatch = processedTask.id.match(/(\d+)$/);
      if (numberMatch) {
        processedTask.id = options.prefix + numberMatch[1];
      }
    }

    // Ensure required fields
    if (!processedTask.name) {
      processedTask.name = 'Imported Task';
    }

    // Clean up description
    if (processedTask.description) {
      processedTask.description = processedTask.description.trim();
    }

    // Clean up content
    if (processedTask.content) {
      processedTask.content = processedTask.content.trim();
    }

    processed.push(processedTask);
  }

  return processed;
}

async function importTasks(api, tasks, options) {
  const results = {
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  };

  for (const task of tasks) {
    try {
      // Check if task exists
      let existingTask = null;
      try {
        existingTask = api.getTask(task.id);
      } catch (error) {
        // Task doesn't exist, which is fine
      }

      if (existingTask) {
        if (options.update) {
          // Update existing task
          const updateData = { ...task };
          delete updateData.id; // Don't update ID
          delete updateData.notes; // Handle notes separately
          delete updateData.tags; // Handle tags separately

          await api.updateTask(task.id, updateData, 'import');

          // Update tags if specified
          if (task.tags && task.tags.length > 0) {
            // Remove existing tags and add new ones
            const existingTags = api.getTaskTags(task.id);
            if (existingTags.length > 0) {
              await api.removeTaskTags(task.id, existingTags, 'import');
            }
            await api.addTaskTags(task.id, task.tags, 'import');
          }

          console.log(`✅ Updated: ${task.id} - ${task.name}`);
          results.updated++;
        } else {
          console.log(`⏭️  Skipped: ${task.id} - ${task.name} (already exists)`);
          results.skipped++;
        }
      } else {
        // Create new task
        const createdTask = await api.createTask({
          ...task,
          created_by: 'import',
        });

        // Add tags if any
        if (task.tags && task.tags.length > 0) {
          await api.addTaskTags(createdTask.id, task.tags, 'import');
        }

        // Add notes if any
        if (task.notes && task.notes.length > 0) {
          for (const note of task.notes) {
            await api.addTaskNote(createdTask.id, note.note, note.user || 'import');
          }
        }

        console.log(`✅ Imported: ${createdTask.id} - ${createdTask.name}`);
        results.imported++;
      }
    } catch (error) {
      console.error(`❌ Error importing ${task.id || 'unnamed task'}: ${error.message}`);
      results.errors++;
    }
  }

  return results;
}
