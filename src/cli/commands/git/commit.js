import { Command } from 'commander';
import { getAPI } from '../../utils/api.js';
import { handleError, handleSuccess, handleInfo, handleWarning } from '../../utils/output.js';

export function createGitCommitCommand() {
  const command = new Command('commit');
  
  command
    .description('Create commit with task context')
    .argument('<task-id>', 'Task ID (e.g., TASK-001 or 1)')
    .option('-m, --message <message>', 'Override generated commit message')
    .option('-p, --push', 'Push after commit', false)
    .option('-c, --close', 'Mark task completed after commit', false)
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
        
        // Check git status
        const gitStatus = api.getGitStatus();
        const stagedFiles = gitStatus.filter(f => 
          f.status.startsWith('M') || 
          f.status.startsWith('A') || 
          f.status.startsWith('D') ||
          f.status.startsWith('R')
        );
        
        if (stagedFiles.length === 0) {
          handleWarning('No staged changes to commit');
          handleInfo('Use "git add" to stage changes first');
          return;
        }
        
        // Show what will be committed
        handleInfo('Staged changes:');
        stagedFiles.forEach(f => {
          const statusMap = {
            'M': 'modified',
            'A': 'added',
            'D': 'deleted',
            'R': 'renamed'
          };
          const status = statusMap[f.status[0]] || f.status;
          handleInfo(`  ${status}: ${f.file}`);
        });
        
        // Commit with task context
        const result = await api.commitWithTask(task.id, {
          message: options.message,
          push: options.push,
          close: options.close
        });
        
        handleSuccess(`\nCommitted with message:`);
        handleInfo(result.message);
        
        if (result.pushed) {
          handleSuccess('Changes pushed to remote');
        }
        
        if (options.close) {
          handleSuccess(`Task ${task.string_id} marked as completed`);
        }
        
      } catch (error) {
        handleError(error);
      }
    });
  
  return command;
}