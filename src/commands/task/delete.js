import { Command } from 'commander';
import { createInterface } from 'readline';
import { TaskwerkAPI } from '../../api/taskwerk-api.js';
import { Logger } from '../../logging/logger.js';

async function confirmDelete(taskName) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question(`❓ Are you sure you want to delete "${taskName}"? (y/N): `, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

export function taskDeleteCommand() {
  const del = new Command('delete');

  del
    .description('Delete a task')
    .argument('<id>', 'Task ID')
    .option('-f, --force', 'Force delete without confirmation')
    .option('--cascade', 'Delete all subtasks')
    .action(async (id, options) => {
      const logger = new Logger('task-delete');

      try {
        const api = new TaskwerkAPI();

        // Get task details first
        const task = api.getTask(id);

        // Check for subtasks if cascade not specified
        const subtasks = api.getSubtasks(id);
        if (subtasks.length > 0 && !options.cascade) {
          console.log(`❌ Cannot delete task ${id}: it has ${subtasks.length} subtask(s)`);
          console.log('\nSubtasks:');
          subtasks.forEach(subtask => {
            console.log(`  - ${subtask.id}: ${subtask.name}`);
          });
          console.log('\nOptions:');
          console.log('  1. Delete subtasks first');
          console.log('  2. Use --cascade to delete all subtasks');
          process.exit(1);
        }

        // Confirm deletion unless force is used
        if (!options.force) {
          let message = `"${task.name}"`;
          if (subtasks.length > 0) {
            message += ` and ${subtasks.length} subtask(s)`;
          }

          const confirmed = await confirmDelete(message);
          if (!confirmed) {
            console.log('❌ Deletion cancelled');
            process.exit(0);
          }
        }

        // Delete subtasks first if cascade is enabled
        if (options.cascade && subtasks.length > 0) {
          console.log(`🗑️  Deleting ${subtasks.length} subtask(s)...`);
          for (const subtask of subtasks) {
            await api.deleteTask(subtask.id, 'user');
            console.log(`  ✅ Deleted subtask ${subtask.id}: ${subtask.name}`);
          }
        }

        // Delete the main task
        await api.deleteTask(id, 'user');
        console.log(`✅ Deleted task ${id}: ${task.name}`);

        // Show summary
        const totalDeleted = 1 + (options.cascade ? subtasks.length : 0);
        if (totalDeleted > 1) {
          console.log(`\n📊 Summary: Deleted ${totalDeleted} task(s) total`);
        }
      } catch (error) {
        logger.error('Failed to delete task', error);
        // For TaskNotFoundError, the message already contains suggestions
        if (error.code === 'TASK_NOT_FOUND') {
          console.error(`❌ ${error.message}`);
        } else {
          console.error('❌ Failed to delete task:', error.message);
        }
        process.exit(1);
      }
    });

  return del;
}
