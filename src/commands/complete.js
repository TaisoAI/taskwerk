import { TaskManager } from '../core/task-manager.js';
import { GitManager } from '../git/git-manager.js';
import { loadConfig } from '../utils/config.js';

export async function completeCommand(taskId, options) {
  try {
    const config = await loadConfig();
    const taskManager = new TaskManager(config);
    const gitManager = new GitManager();

    // Get changed files from git (optional, for context)
    let files = [];
    if (options.files) {
      files = options.files.split(',');
    } else if (await gitManager.isGitRepository()) {
      files = await gitManager.getChangedFiles();
    }

    // Complete the task
    const completionData = {
      note: options.note,
      files: files,
      level: options.level || 'standard',
      sideEffects: options.sideEffects ? options.sideEffects.split(',') : [],
      versionImpact: options.versionImpact,
    };

    const completedTask = await taskManager.completeTask(taskId, completionData);

    console.log(`✅ Completed task: ${completedTask.id} - ${completedTask.description}`);

    if (completedTask.note) {
      console.log(`📝 Note: ${completedTask.note}`);
    }

    if (files.length > 0) {
      console.log(`📁 Files: ${files.join(', ')}`);
    }

    if (options.versionImpact && options.versionImpact !== 'none') {
      console.log(`📈 Version impact: ${options.versionImpact}`);
    }

    if (options.sideEffects) {
      console.log(`⚠️  Side effects: ${options.sideEffects}`);
    }
  } catch (error) {
    console.error('❌ Failed to complete task:', error.message);
    process.exit(1);
  }
}
