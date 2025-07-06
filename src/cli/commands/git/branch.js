import { Command } from 'commander';
import { getAPI } from '../../utils/api.js';
import { handleError, handleSuccess, handleInfo } from '../../utils/output.js';

export function createGitBranchCommand() {
  const command = new Command('branch');
  
  command
    .description('Create/checkout git branch for a task')
    .argument('<task-id>', 'Task ID (e.g., TASK-001 or 1)')
    .option('-c, --checkout', 'Switch to new branch (default: true)', true)
    .option('-p, --prefix <prefix>', 'Branch prefix', 'feature/')
    .option('-b, --base <branch>', 'Base branch (default: current)')
    .action(async (taskId, options) => {
      try {
        const api = await getAPI();
        
        // Check if we're in a git repository
        if (!api.isGitRepository()) {
          handleError('Not in a git repository');
          return;
        }
        
        // Get task to validate it exists
        const task = await api.getTask(taskId);
        if (!task) {
          handleError(`Task ${taskId} not found`);
          return;
        }
        
        // Show current status
        const currentBranch = api.getCurrentBranch();
        handleInfo(`Current branch: ${currentBranch || 'detached HEAD'}`);
        
        // Create branch
        const result = await api.createTaskBranch(task.id, {
          prefix: options.prefix,
          checkout: options.checkout,
          base: options.base
        });
        
        if (result.created) {
          handleSuccess(`Created branch: ${result.branch}`);
        } else {
          handleInfo(`Branch already exists: ${result.branch}`);
        }
        
        if (result.checked_out) {
          handleSuccess(`Switched to branch: ${result.branch}`);
        }
        
        // Show task info
        handleInfo(`\nTask: ${task.string_id} - ${task.name}`);
        if (task.status !== 'in-progress') {
          handleInfo('Tip: Use "twrk task status <task-id> in-progress" to start working on this task');
        }
        
      } catch (error) {
        handleError(error);
      }
    });
  
  return command;
}