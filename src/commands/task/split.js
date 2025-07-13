import { Command } from 'commander';
import { TaskwerkAPI } from '../../api/taskwerk-api.js';
import { Logger } from '../../logging/logger.js';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

export function taskSplitCommand() {
  const split = new Command('split');

  split
    .description('Split a task into subtasks')
    .argument('<id>', 'Task ID to split')
    .option('-n, --names <names...>', 'Names for subtasks (non-interactive mode)')
    .option('--divide-estimate', 'Divide the parent task estimate equally among subtasks')
    .option('-i, --interactive', 'Use interactive mode', true)
    .action(async (id, options) => {
      const logger = new Logger('task-split');
      
      try {
        const api = new TaskwerkAPI();
        
        // Get the parent task
        const parentTask = api.getTask(id);
        const parentTags = api.getTaskTags(id);
        
        console.log(`\n📋 Splitting task ${parentTask.id}: ${parentTask.name}`);
        
        let subtaskNames = [];
        
        // Non-interactive mode when names are provided
        if (options.names && options.names.length > 0) {
          subtaskNames = options.names;
        } else {
          // Interactive mode using readline
          const rl = readline.createInterface({ input, output });
          
          let count;
          while (true) {
            const countStr = await rl.question('How many subtasks do you want to create? (1-10) [2]: ');
            count = countStr ? parseInt(countStr) : 2;
            
            if (isNaN(count) || count < 1 || count > 10) {
              console.log('Please enter a number between 1 and 10');
              continue;
            }
            break;
          }
          
          // Get names for each subtask
          for (let i = 1; i <= count; i++) {
            while (true) {
              const name = await rl.question(`Enter name for subtask ${i}: `);
              if (name.trim().length > 0) {
                subtaskNames.push(name.trim());
                break;
              }
              console.log('Task name cannot be empty');
            }
          }
          
          rl.close();
        }
        
        // Calculate estimate per subtask if dividing
        let estimatePerSubtask = null;
        if (options.divideEstimate && parentTask.estimate) {
          estimatePerSubtask = Math.ceil(parentTask.estimate / subtaskNames.length);
        }
        
        // Create subtasks
        const createdTasks = [];
        let subtaskNumber = 1;
        
        for (const name of subtaskNames) {
          const subtaskData = {
            name: name,
            description: `Subtask of ${parentTask.id}`,
            status: 'todo',
            priority: parentTask.priority,
            assignee: parentTask.assignee,
            parent_id: parentTask.id,
            created_by: 'user',
            category: parentTask.category
          };
          
          if (estimatePerSubtask) {
            subtaskData.estimate = estimatePerSubtask;
          }
          
          // Create the subtask
          const subtask = await api.createTask(subtaskData);
          
          // Copy tags from parent
          if (parentTags.length > 0) {
            await api.addTaskTags(subtask.id, parentTags, 'user');
          }
          
          createdTasks.push(subtask);
          console.log(`✅ Created subtask ${subtask.id}: ${subtask.name}`);
          
          subtaskNumber++;
        }
        
        // Update parent task status if it was todo
        if (parentTask.status === 'todo') {
          await api.updateTask(parentTask.id, { status: 'in-progress' }, 'user');
          console.log(`\n🔄 Updated parent task status to in-progress`);
        }
        
        // Show summary
        console.log('\n📊 Split Summary:');
        console.log(`   Parent: ${parentTask.id} - ${parentTask.name}`);
        console.log(`   Subtasks created: ${createdTasks.length}`);
        if (parentTags.length > 0) {
          console.log(`   Tags copied: ${parentTags.join(', ')}`);
        }
        if (estimatePerSubtask) {
          console.log(`   Estimate per subtask: ${estimatePerSubtask} hours`);
        }
        
      } catch (error) {
        logger.error('Failed to split task', error);
        console.error('❌ Failed to split task:', error.message);
        process.exit(1);
      }
    });

  return split;
}