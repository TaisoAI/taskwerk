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
        console.error('❌ Failed to update task status:', error.message);
        process.exit(1);
      }
    });

  return status;
}
