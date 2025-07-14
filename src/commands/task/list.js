import { Command } from 'commander';
import { TaskwerkAPI } from '../../api/taskwerk-api.js';
import { Logger } from '../../logging/logger.js';

function formatTask(task, index) {
  const statusEmoji = {
    'todo': '⏳',
    'in-progress': '🔄', 
    'in_progress': '🔄',
    'blocked': '🚫',
    'done': '✅',
    'completed': '✅',
    'cancelled': '❌'
  };
  
  const priorityEmoji = {
    'low': '🔵',
    'medium': '🟡', 
    'high': '🔴',
    'critical': '🚨'
  };
  
  return `${index + 1}. ${statusEmoji[task.status] || '⏳'} ${priorityEmoji[task.priority] || '🟡'} ${task.id} - ${task.name}${task.assignee ? ` (@${task.assignee})` : ''}`;
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
    .action(async (options) => {
      const logger = new Logger('task-list');
      
      try {
        const api = new TaskwerkAPI();
        
        // Build query options
        const queryOptions = {};
        
        if (options.status) {queryOptions.status = options.status;}
        if (options.priority) {queryOptions.priority = options.priority;}
        if (options.assignee) {queryOptions.assignee = options.assignee;}
        if (options.tags) {queryOptions.tags = options.tags;}
        
        if (!options.all) {
          queryOptions.limit = parseInt(options.limit) || 50;
        }
        
        // Map sort options
        const sortField = options.sort === 'created' ? 'created_at' : 
                         options.sort === 'updated' ? 'updated_at' : 
                         options.sort === 'priority' ? 'priority' : 'created_at';
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
            console.log(`${task.id},"${task.name}",${task.status},${task.priority},${task.assignee || ''},${task.created_at}`);
          });
          return;
        }
        
        // Default table format
        let header = `📋 Tasks`;
        if (options.search) {header = `🔍 Search results for "${options.search}"`;}
        if (options.status) {header += ` (status: ${options.status})`;}
        if (options.priority) {header += ` (priority: ${options.priority})`;}
        if (options.assignee) {header += ` (assignee: ${options.assignee})`;}
        if (options.tags) {header += ` (tags: ${options.tags.join(', ')})`;}
        
        console.log(header);
        console.log('─'.repeat(50));
        
        // Display tasks
        tasks.forEach((task, index) => {
          console.log(formatTask(task, index));
        });
        
        console.log('─'.repeat(50));
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
