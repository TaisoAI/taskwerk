import { TaskManager } from '../core/task-manager.js';
import { loadConfig } from '../utils/config.js';

export async function completeCommand(taskId, options) {
  try {
    const config = await loadConfig();
    const taskManager = new TaskManager(config);

    const task = await taskManager.completeTask(taskId, {
      note: options.note,
    });

    console.log(`✅ Completed task: ${task.id} - ${task.description}`);

    if (task.filesChanged && task.filesChanged.length > 0) {
      console.log(`📁 Files modified: ${task.filesChanged.join(', ')}`);
    }

    if (task.commit) {
      console.log(`📝 Commit: ${task.commit}`);
    }
  } catch (error) {
    console.error('❌ Failed to complete task:', error.message);
    process.exit(1);
  }
}
