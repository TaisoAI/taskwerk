import { Command } from 'commander';
import { TaskwerkAPI } from '../../api/taskwerk-api.js';
import { Logger } from '../../logging/logger.js';

export function taskAddCommand() {
  const add = new Command('add');

  add
    .description('Add a new task')
    .argument('<name>', 'Task name')
    .option('-p, --priority <level>', 'Set priority (low, medium, high)', 'medium')
    .option('-a, --assignee <name>', 'Assign task to a person')
    .option('-e, --estimate <hours>', 'Time estimate in hours')
    .option('-P, --parent <id>', 'Parent task ID')
    .option('-t, --tags <tags...>', 'Add tags to the task')
    .option('-d, --description <text>', 'Task description')
    .action(async (name, options) => {
      const logger = new Logger('task-add');
      
      try {
        const api = new TaskwerkAPI();
        
        // Build task data
        const taskData = {
          name,
          description: options.description,
          priority: options.priority,
          assignee: options.assignee,
          parent_id: options.parent,
          created_by: 'user'
        };

        // Add estimate if provided
        if (options.estimate) {
          const estimateNum = parseInt(options.estimate);
          if (isNaN(estimateNum)) {
            console.error('❌ Estimate must be a number');
            process.exit(1);
          }
          taskData.estimate = estimateNum;
        }

        // Create the task
        const task = await api.createTask(taskData);
        
        console.log(`✅ Created task ${task.id}: ${task.name}`);
        
        // Add tags if provided
        if (options.tags && options.tags.length > 0) {
          await api.addTaskTags(task.id, options.tags, 'user');
          console.log(`🏷️  Added tags: ${options.tags.join(', ')}`);
        }
        
        // Show task details
        console.log(`\nTask Details:`);
        console.log(`  ID: ${task.id}`);
        console.log(`  Name: ${task.name}`);
        console.log(`  Status: ${task.status}`);
        console.log(`  Priority: ${task.priority}`);
        if (task.assignee) console.log(`  Assignee: ${task.assignee}`);
        if (task.parent_id) console.log(`  Parent: ${task.parent_id}`);
        if (task.estimate) console.log(`  Estimate: ${task.estimate} hours`);
        if (task.description) console.log(`  Description: ${task.description}`);
        
      } catch (error) {
        logger.error('Failed to create task', error);
        console.error('❌ Failed to create task:', error.message);
        process.exit(1);
      }
    });

  return add;
}
