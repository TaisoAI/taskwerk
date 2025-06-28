import { TaskManager } from '../core/task-manager.js';
import { loadConfig } from '../utils/config.js';
import { formatSessionStatus } from '../utils/formatter.js';

export async function statusCommand() {
  try {
    const config = await loadConfig();
    const taskManager = new TaskManager(config);

    const session = await taskManager.getCurrentSession();
    const stats = await taskManager.getStats();

    console.log(formatSessionStatus(session, stats));
  } catch (error) {
    console.error('❌ Failed to get status:', error.message);
    process.exit(1);
  }
}
