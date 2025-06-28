import { TaskManager } from '../core/task-manager.js';
import { GitManager } from '../git/git-manager.js';
import { loadConfig } from '../utils/config.js';

export async function branchCommand(taskId) {
  try {
    const config = await loadConfig();
    const taskManager = new TaskManager(config);
    const gitManager = new GitManager();

    const task = await taskManager.getTask(taskId);
    const branchName = await gitManager.createTaskBranch(task);

    await taskManager.updateSession({
      currentTask: taskId,
      branch: branchName,
      baseBranch: await gitManager.getCurrentBranch(),
    });

    console.log(`🌿 Created and switched to branch: ${branchName}`);
    console.log(`📝 Task: ${task.id} - ${task.description}`);
  } catch (error) {
    console.error('❌ Failed to create branch:', error.message);
    process.exit(1);
  }
}
