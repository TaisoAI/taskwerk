import { TaskManager } from '../core/task-manager.js';
import { loadConfig } from '../utils/config.js';
import { formatTaskList } from '../utils/formatter.js';

export async function listCommand(options) {
  try {
    const config = await loadConfig();
    const taskManager = new TaskManager(config);

    if (options.current) {
      const session = await taskManager.getCurrentSession();
      console.log(formatTaskList([], { session }));
      return;
    }

    const tasks = await taskManager.getTasks({
      priority: options.priority,
      category: options.category,
      completed: options.completed,
    });

    console.log(
      formatTaskList(tasks, {
        showCompleted: options.completed,
        priority: options.priority,
        category: options.category,
      })
    );
  } catch (error) {
    console.error('❌ Failed to list tasks:', error.message);
    process.exit(1);
  }
}
