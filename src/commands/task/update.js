import { Command } from 'commander';
import { TaskwerkAPI } from '../../api/taskwerk-api.js';
import { Logger } from '../../logging/logger.js';

export function taskUpdateCommand() {
  const update = new Command('update');

  update
    .description('Update a task')
    .argument('<id>', 'Task ID')
    .option('-n, --name <name>', 'Update task name')
    .option('-p, --priority <level>', 'Update priority')
    .option('-a, --assignee <name>', 'Update assignee')
    .option('-e, --estimate <hours>', 'Update time estimate')
    .option('-s, --status <status>', 'Update status')
    .option('--progress <percent>', 'Update progress (0-100)')
    .option('--add-tags <tags...>', 'Add tags')
    .option('--remove-tags <tags...>', 'Remove tags')
    .option('--note <text>', 'Append a note')
    .action(async (id, options) => {
      const logger = new Logger('task-update');
      
      try {
        const api = new TaskwerkAPI();
        
        // Check if task exists first
        const currentTask = api.getTask(id);
        
        // Build updates object
        const updates = {};
        
        if (options.name) {updates.name = options.name;}
        if (options.priority) {updates.priority = options.priority;}
        if (options.assignee) {updates.assignee = options.assignee;}
        if (options.status) {updates.status = options.status;}
        
        if (options.estimate) {
          const estimateNum = parseInt(options.estimate);
          if (isNaN(estimateNum)) {
            console.error('❌ Estimate must be a number');
            process.exit(1);
          }
          updates.estimate = estimateNum;
        }
        
        if (options.progress) {
          const progressNum = parseInt(options.progress);
          if (isNaN(progressNum) || progressNum < 0 || progressNum > 100) {
            console.error('❌ Progress must be a number between 0 and 100');
            process.exit(1);
          }
          updates.progress = progressNum;
        }
        
        // Update task if there are field updates
        if (Object.keys(updates).length > 0) {
          const updatedTask = await api.updateTask(id, updates, 'user');
          console.log(`✅ Updated task ${updatedTask.id}: ${updatedTask.name}`);
          
          // Show what changed
          for (const [field, newValue] of Object.entries(updates)) {
            const oldValue = currentTask[field];
            if (oldValue !== newValue) {
              console.log(`  ${field}: ${oldValue || '(none)'} → ${newValue}`);
            }
          }
        }
        
        // Handle tag operations
        if (options.addTags && options.addTags.length > 0) {
          await api.addTaskTags(id, options.addTags, 'user');
          console.log(`🏷️  Added tags: ${options.addTags.join(', ')}`);
        }
        
        if (options.removeTags && options.removeTags.length > 0) {
          await api.removeTaskTags(id, options.removeTags, 'user');
          console.log(`🗑️  Removed tags: ${options.removeTags.join(', ')}`);
        }
        
        // Add note if provided
        if (options.note) {
          await api.addTaskNote(id, options.note, 'user');
          console.log(`📝 Added note: ${options.note}`);
        }
        
        // Show updated task details
        if (Object.keys(updates).length > 0 || options.addTags || options.removeTags || options.note) {
          console.log('\nUpdated task:');
          console.log(`  ID: ${id}`);
          console.log(`  Name: ${(updates.name || currentTask.name)}`);
          console.log(`  Status: ${(updates.status || currentTask.status)}`);
          console.log(`  Priority: ${(updates.priority || currentTask.priority)}`);
          
          if (updates.assignee || currentTask.assignee) {
            console.log(`  Assignee: ${(updates.assignee || currentTask.assignee)}`);
          }
          
          if (updates.progress !== undefined || currentTask.progress > 0) {
            console.log(`  Progress: ${(updates.progress !== undefined ? updates.progress : currentTask.progress)}%`);
          }
        } else {
          console.log('ℹ️  No changes were made');
        }
        
      } catch (error) {
        logger.error('Failed to update task', error);
        console.error('❌ Failed to update task:', error.message);
        process.exit(1);
      }
    });

  return update;
}
