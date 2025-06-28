import { TaskManager } from '../core/task-manager.js';
import { loadConfig } from '../utils/config.js';

export async function addCommand(description, options) {
  try {
    const config = await loadConfig();
    const taskManager = new TaskManager(config);

    const task = await taskManager.addTask({
      description,
      priority: options.priority || config.defaultPriority,
      category: options.category,
    });

    console.log(`✅ Added task: ${task.id} - ${task.description}`);
  } catch (error) {
    console.error('❌ Failed to add task:', error.message);
    process.exit(1);
  }
}
