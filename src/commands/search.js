import { TaskManager } from '../core/task-manager.js';
import { loadConfig } from '../utils/config.js';
import { formatTaskList } from '../utils/formatter.js';

export async function searchCommand(query) {
  try {
    const config = await loadConfig();
    const taskManager = new TaskManager(config);

    const tasks = await taskManager.searchTasks(query);

    if (tasks.length === 0) {
      console.log(`No tasks found matching: "${query}"`);
      return;
    }

    console.log(`Found ${tasks.length} task(s) matching: "${query}"\n`);
    console.log(formatTaskList(tasks));
  } catch (error) {
    console.error('❌ Failed to search tasks:', error.message);
    process.exit(1);
  }
}
