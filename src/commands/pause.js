import { TaskManager } from '../core/task-manager.js';
import { loadConfig } from '../utils/config.js';

export async function pauseCommand(taskId) {
  try {
    const config = await loadConfig();
    const taskManager = new TaskManager(config);

    const task = await taskManager.pauseTask(taskId);

    console.log(`⏸️  Paused task: ${task.id} - ${task.description}`);
  } catch (error) {
    console.error('❌ Failed to pause task:', error.message);
    process.exit(1);
  }
}
