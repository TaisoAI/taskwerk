import { Command } from 'commander';
import { TaskwerkAPI } from '../../api/taskwerk-api.js';
import { Logger } from '../../logging/logger.js';

export function taskStatusCommand() {
  const status = new Command('status');

  status
    .description('Change task status')
    .argument('<id>', 'Task ID')
    .argument('<status>', 'New status (todo, in-progress, blocked, done, cancelled)')
    .option('--note <text>', 'Add a note about the status change')
    .addHelpText(
      'after',
      `
Examples:
  Basic status changes:
    $ twrk statustask 1 in-progress              # Start working on task
    $ twrk statustask 1 done                     # Mark task as complete
    $ twrk statustask 1 blocked                  # Mark as blocked
    $ twrk statustask TASK-001 cancelled         # Cancel a task
    
  With notes for context:
    $ twrk statustask 1 blocked --note "Waiting for API keys"
    $ twrk statustask 1 done --note "Deployed to production"
    $ twrk statustask 1 in-progress --note "Started implementation"
    
  Quick status shortcuts (also available as root commands):
    $ twrk done 1                                # Mark as done
    $ twrk start 1                               # Mark as in-progress
    $ twrk block 1                               # Mark as blocked
    
  Bulk status updates using shell:
    $ for i in 1 2 3; do twrk statustask $i done; done
    $ twrk listtask -s todo --format json | jq -r '.[] | .id' | xargs -I {} twrk start {}
    
Valid statuses:
  - todo: Not started yet
  - in-progress: Currently being worked on
  - blocked: Cannot proceed due to dependency
  - done: Completed successfully
  - cancelled: Will not be completed
  
Note: Status names are case-insensitive`
    )
    .action(async (id, newStatus, options) => {
      const logger = new Logger('task-status');

      try {
        const api = new TaskwerkAPI();

        // Normalize status values
        const normalizedStatus = newStatus.toLowerCase();
        const validStatuses = ['todo', 'in-progress', 'blocked', 'done', 'cancelled'];

        if (!validStatuses.includes(normalizedStatus)) {
          console.error(`❌ Invalid status: ${newStatus}`);
          console.error(`Valid statuses: ${validStatuses.join(', ')}`);
          process.exit(1);
        }

        // Update the task
        await api.updateTask(id, { status: normalizedStatus }, 'user');

        // Add note if provided
        if (options.note) {
          await api.addTaskNote(id, options.note);
        }

        console.log(`✅ Updated status of ${id} to ${normalizedStatus}`);
      } catch (error) {
        logger.error('Failed to update task status', error);
        // For TaskNotFoundError, the message already contains suggestions
        if (error.code === 'TASK_NOT_FOUND') {
          console.error(`❌ ${error.message}`);
        } else {
          console.error('❌ Failed to update task status:', error.message);
        }
        process.exit(1);
      }
    });

  return status;
}
