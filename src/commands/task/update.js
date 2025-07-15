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
    .addHelpText(
      'after',
      `
Examples:
  Update basic fields:
    $ twrk updatetask 1 -n "Updated task name"          # Rename task
    $ twrk updatetask 1 -p critical                     # Change priority
    $ twrk updatetask 1 -a @sarah                       # Reassign task
    $ twrk updatetask 1 -s in-progress                  # Update status
    $ twrk updatetask 1 -e 16                           # Update estimate to 16 hours
    $ twrk updatetask 1 --progress 75                   # Set 75% complete
    
  Multiple updates at once:
    $ twrk updatetask 1 -p high -s in-progress -a @team
    $ twrk updatetask 1 -n "Redesign homepage" -e 40 --progress 25
    
  Managing tags:
    $ twrk updatetask 1 --add-tags urgent hotfix        # Add multiple tags
    $ twrk updatetask 1 --remove-tags wontfix           # Remove tags
    $ twrk updatetask 1 --add-tags v2.0 --remove-tags v1.0
    
  Adding notes for context:
    $ twrk updatetask 1 --note "Blocked by API changes"
    $ twrk updatetask 1 --note "Customer reported this affects checkout"
    $ twrk updatetask 1 -s blocked --note "Waiting for design approval"
    
  For AI/LLM workflows:
    $ twrk updatetask 1 -a @ai-agent --note "Please implement the login endpoint"
    $ twrk updatetask 1 --note "Requirements: 
      - Use JWT for auth
      - Rate limit to 5 attempts/minute
      - Log all failed attempts"
    $ twrk updatetask 1 -a @claude --add-tags ai-ready
    
  Complex updates:
    $ twrk updatetask TASK-001 -s done --progress 100 --note "Deployed to prod"
    $ twrk updatetask 5 -p low -a null --note "Deprioritized, unassigning"
    
Note: 
  - Use fuzzy matching: '1' instead of 'TASK-001'
  - Set assignee to 'null' to unassign
  - Notes are appended, not replaced`
    )
    .action(async (id, options) => {
      const logger = new Logger('task-update');

      try {
        const api = new TaskwerkAPI();

        // Check if task exists first (this will also resolve fuzzy matches)
        const currentTask = api.getTask(id);
        const actualTaskId = currentTask.id; // Use the actual task ID for subsequent operations

        // Build updates object
        const updates = {};

        if (options.name) {
          updates.name = options.name;
        }
        if (options.priority) {
          updates.priority = options.priority;
        }
        if (options.assignee) {
          updates.assignee = options.assignee;
        }
        if (options.status) {
          updates.status = options.status;
        }

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
          const updatedTask = await api.updateTask(actualTaskId, updates, 'user');
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
          await api.addTaskTags(actualTaskId, options.addTags, 'user');
          console.log(`🏷️  Added tags: ${options.addTags.join(', ')}`);
        }

        if (options.removeTags && options.removeTags.length > 0) {
          await api.removeTaskTags(actualTaskId, options.removeTags, 'user');
          console.log(`🗑️  Removed tags: ${options.removeTags.join(', ')}`);
        }

        // Add note if provided
        if (options.note) {
          await api.addTaskNote(actualTaskId, options.note, 'user');
          console.log(`📝 Added note: ${options.note}`);
        }

        // Show updated task details
        if (
          Object.keys(updates).length > 0 ||
          options.addTags ||
          options.removeTags ||
          options.note
        ) {
          console.log('\nUpdated task:');
          console.log(`  ID: ${actualTaskId}`);
          console.log(`  Name: ${updates.name || currentTask.name}`);
          console.log(`  Status: ${updates.status || currentTask.status}`);
          console.log(`  Priority: ${updates.priority || currentTask.priority}`);

          if (updates.assignee || currentTask.assignee) {
            console.log(`  Assignee: ${updates.assignee || currentTask.assignee}`);
          }

          if (updates.progress !== undefined || currentTask.progress > 0) {
            console.log(
              `  Progress: ${updates.progress !== undefined ? updates.progress : currentTask.progress}%`
            );
          }
        } else {
          console.log('ℹ️  No changes were made');
        }
      } catch (error) {
        logger.error('Failed to update task', error);
        // For TaskNotFoundError, the message already contains suggestions
        if (error.code === 'TASK_NOT_FOUND') {
          console.error(`❌ ${error.message}`);
        } else {
          console.error('❌ Failed to update task:', error.message);
        }
        process.exit(1);
      }
    });

  return update;
}
