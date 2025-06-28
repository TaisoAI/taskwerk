import { TaskManager } from '../core/task-manager.js';
import { loadConfig } from '../utils/config.js';

export async function startCommand(taskId) {
  try {
    const config = await loadConfig();
    const taskManager = new TaskManager(config);

    const task = await taskManager.startTask(taskId);

    console.log(`🚀 Started task: ${task.id} - ${task.description}`);

    const session = await taskManager.getCurrentSession();
    if (session.branch) {
      console.log(`📝 Session: ${session.agent || 'Unknown'} on ${session.branch}`);
    }
  } catch (error) {
    console.error('❌ Failed to start task:', error.message);
    process.exit(1);
  }
}
