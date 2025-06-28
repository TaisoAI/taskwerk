import { TaskManager } from '../core/task-manager.js';
import { loadConfig } from '../utils/config.js';
import { formatTaskList } from '../utils/formatter.js';

export async function recentCommand() {
  try {
    const config = await loadConfig();
    const taskManager = new TaskManager(config);

    const tasks = await taskManager.getRecentlyCompleted();

    if (tasks.length === 0) {
      console.log('No recently completed tasks found.');
      return;
    }

    console.log('Recently completed tasks:\n');
    console.log(formatTaskList(tasks, { showCompleted: true }));
  } catch (error) {
    console.error('❌ Failed to get recent tasks:', error.message);
    process.exit(1);
  }
}
