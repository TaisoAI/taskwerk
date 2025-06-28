import { TaskManager } from '../core/task-manager.js';
import { loadConfig } from '../utils/config.js';
import { formatStats, formatStatsPlain } from '../utils/formatter.js';

export async function statsCommand(options = {}) {
  try {
    const config = await loadConfig();
    const taskManager = new TaskManager(config);

    const stats = await taskManager.getStats();

    if (options.format === 'plain') {
      console.log(formatStatsPlain(stats));
    } else {
      // Default to markdown format
      console.log(formatStats(stats));
    }
  } catch (error) {
    console.error('❌ Failed to get statistics:', error.message);
    process.exit(1);
  }
}
