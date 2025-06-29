import { TaskManager } from '../core/task-manager.js';
import { loadConfig } from '../utils/config.js';

export async function archiveCommand(taskId, options) {
  try {
    const config = await loadConfig();
    const taskManager = new TaskManager(config);

    if (!options.reason) {
      console.error('❌ Archive reason is required');
      console.log('');
      console.log('Use --reason to specify why the task is being archived:');
      console.log('  $ taskwerk archive TASK-001 --reason "Requirements changed"');
      console.log('  $ taskwerk archive TASK-001 --reason "Duplicate of TASK-002"');
      console.log('  $ taskwerk archive TASK-001 --reason "No longer needed"');
      process.exit(1);
    }

    const archivedTask = await taskManager.archiveTask(taskId.toUpperCase(), {
      reason: options.reason,
      supersededBy: options.supersededBy,
      note: options.note,
    });

    console.log(`📦 Archived task: ${archivedTask.id} - ${archivedTask.description}`);
    console.log(`📝 Reason: ${options.reason}`);

    if (options.supersededBy) {
      console.log(`🔗 Superseded by: ${options.supersededBy}`);
    }

    if (options.note) {
      console.log(`💭 Note: ${options.note}`);
    }
  } catch (error) {
    console.error('❌ Failed to archive task:', error.message);
    process.exit(1);
  }
}
