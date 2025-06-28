import { TaskManager } from '../core/task-manager.js';
import { loadConfig } from '../utils/config.js';
import { formatTaskContext } from '../utils/formatter.js';

export async function contextCommand(taskId) {
  try {
    const config = await loadConfig();
    const taskManager = new TaskManager(config);

    const task = await taskManager.getTask(taskId);
    const context = await taskManager.getTaskContext(taskId);

    console.log(formatTaskContext(task, context));
  } catch (error) {
    console.error('❌ Failed to get task context:', error.message);
    process.exit(1);
  }
}
