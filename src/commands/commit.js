import { TaskManager } from '../core/task-manager.js';
import { GitManager } from '../git/git-manager.js';
import { loadConfig } from '../utils/config.js';

export async function commitCommand() {
  try {
    const config = await loadConfig();
    const taskManager = new TaskManager(config);
    const gitManager = new GitManager();

    const session = await taskManager.getCurrentSession();

    if (!session.currentTask) {
      console.log('❌ No active task in current session');
      return;
    }

    const task = await taskManager.getTask(session.currentTask);
    const commitMessage = await gitManager.createTaskCommit(task, session);

    console.log(`✅ Committed changes for task: ${task.id}`);
    console.log(`📝 Commit message: ${commitMessage}`);
  } catch (error) {
    console.error('❌ Failed to commit:', error.message);
    process.exit(1);
  }
}
