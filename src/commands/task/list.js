import { Command } from 'commander';
import { TaskwerkAPI } from '../../api/taskwerk-api.js';
import { Logger } from '../../logging/logger.js';

function formatTableRow(task, widths) {
  const statusEmoji = {
    'todo': '⏳ Todo',
    'in-progress': '🔄 Prog',
    'in_progress': '🔄 Prog',
    'blocked': '🚫 Block',
    'done': '✅ Done',
    'completed': '✅ Done',
    'cancelled': '❌ Canc',
  };

  const priorityEmoji = {
    low: '🔵 Low',
    medium: '🟡 Med',
    high: '🔴 High',
    critical: '🚨 Crit',
  };

  const cols = [
    task.id.padEnd(widths.id),
    (statusEmoji[task.status] || '⏳ Todo').padEnd(widths.status),
    (priorityEmoji[task.priority] || '🟡 Med').padEnd(widths.priority),
    task.name.slice(0, widths.name).padEnd(widths.name),
    new Date(task.created_at).toLocaleDateString().padEnd(widths.created),
    (task.assignee || '').padEnd(widths.assignee)
  ];
  
  return cols.join(' ');
}

function calculateColumnWidths(tasks) {
  const widths = {
    id: 9,        // TASK-001
    status: 8,    // 🔄 Prog
    priority: 8,  // 🚨 Crit
    name: 35,     // Task name
    created: 10,  // MM/DD/YYYY
    assignee: 10  // @username
  };

  // Adjust name width based on terminal width
  const terminalWidth = process.stdout.columns || 80;
  const fixedWidth = widths.id + widths.status + widths.priority + widths.created + widths.assignee + 5; // spaces
  const availableWidth = terminalWidth - fixedWidth;
  widths.name = Math.max(20, Math.min(50, availableWidth));

  return widths;
}

export function taskListCommand() {
  const list = new Command('list');

  list
    .description('List tasks')
    .option('-s, --status <status>', 'Filter by status')
    .option('-a, --assignee <name>', 'Filter by assignee')
    .option('-p, --priority <level>', 'Filter by priority')
    .option('-t, --tags <tags...>', 'Filter by tags')
    .option('--search <term>', 'Search in task name, description, and content')
    .option('--sort <field>', 'Sort by field (created, updated, priority)', 'created')
    .option('--format <format>', 'Output format (table, json, csv)', 'table')
    .option('--limit <number>', 'Limit number of results', '50')
    .option('--all', 'Show all tasks including completed/archived')
    .addHelpText('after', `
Examples:
  $ twrk listtask                          # List active tasks
  $ twrk listtask --all                    # List all tasks including done
  $ twrk listtask -s todo                  # List only todo tasks  
  $ twrk listtask -a @john                 # List tasks assigned to john
  $ twrk listtask -p high                  # List high priority tasks
  $ twrk listtask -t bug                   # List tasks tagged with 'bug'
  $ twrk listtask --search "login"         # Search for tasks mentioning login
  $ twrk listtask --sort priority --limit 10  # Top 10 tasks by priority`)
    .action(async options => {
      const logger = new Logger('task-list');

      try {
        const api = new TaskwerkAPI();

        // Build query options
        const queryOptions = {};

        if (options.status) {
          queryOptions.status = options.status;
        }
        if (options.priority) {
          queryOptions.priority = options.priority;
        }
        if (options.assignee) {
          queryOptions.assignee = options.assignee;
        }
        if (options.tags) {
          queryOptions.tags = options.tags;
        }

        if (!options.all) {
          queryOptions.limit = parseInt(options.limit) || 50;
        }

        // Map sort options
        const sortField =
          options.sort === 'created'
            ? 'created_at'
            : options.sort === 'updated'
              ? 'updated_at'
              : options.sort === 'priority'
                ? 'priority'
                : 'created_at';
        queryOptions.order_by = sortField;
        queryOptions.order_dir = 'DESC';

        // Get tasks - use search if search term provided
        const tasks = options.search
          ? api.searchTasks(options.search, queryOptions)
          : api.listTasks(queryOptions);

        if (tasks.length === 0) {
          console.log('📝 No tasks found');
          console.log('\nTry creating a task first:');
          console.log('  taskwerk task add "My task"');
          return;
        }

        // Handle different output formats
        if (options.format === 'json') {
          console.log(JSON.stringify(tasks, null, 2));
          return;
        }

        if (options.format === 'csv') {
          console.log('ID,Name,Status,Priority,Assignee,Created');
          tasks.forEach(task => {
            console.log(
              `${task.id},"${task.name}",${task.status},${task.priority},${task.assignee || ''},${task.created_at}`
            );
          });
          return;
        }

        // Default table format
        let header = `📋 Tasks`;
        if (options.search) {
          header = `🔍 Search results for "${options.search}"`;
        }
        const filters = [];
        if (options.status) filters.push(`status: ${options.status}`);
        if (options.priority) filters.push(`priority: ${options.priority}`);
        if (options.assignee) filters.push(`assignee: ${options.assignee}`);
        if (options.tags) filters.push(`tags: ${options.tags.join(', ')}`);
        if (filters.length > 0) {
          header += ` (${filters.join(', ')})`;
        }

        console.log(header);
        
        // Calculate column widths
        const widths = calculateColumnWidths(tasks);
        const totalWidth = Object.values(widths).reduce((sum, w) => sum + w, 0) + 5;
        
        // Header row
        console.log('─'.repeat(totalWidth));
        const headerCols = [
          'ID'.padEnd(widths.id),
          'Status'.padEnd(widths.status),
          'Priority'.padEnd(widths.priority),
          'Task'.padEnd(widths.name),
          'Created'.padEnd(widths.created),
          'Assignee'.padEnd(widths.assignee)
        ];
        console.log(headerCols.join(' '));
        console.log('─'.repeat(totalWidth));

        // Display tasks
        tasks.forEach(task => {
          console.log(formatTableRow(task, widths));
        });

        console.log('─'.repeat(totalWidth));
        console.log(`📊 Showing ${tasks.length} task${tasks.length !== 1 ? 's' : ''}`);

        if (!options.all && tasks.length >= parseInt(options.limit)) {
          console.log(`\n💡 Use --all to see all tasks or --limit <number> to see more`);
        }
      } catch (error) {
        logger.error('Failed to list tasks', error);
        console.error('❌ Failed to list tasks:', error.message);
        process.exit(1);
      }
    });

  return list;
}
