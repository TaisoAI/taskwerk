import { Command } from 'commander';
import { getAPI } from '../../utils/api.js';
import { handleError, handleSuccess, handleInfo, handleWarning } from '../../utils/output.js';

export function createGitSyncCommand() {
  const command = new Command('sync');
  
  command
    .description('Sync task branches with git')
    .option('-p, --prune', 'Remove merged task branches', false)
    .option('-u, --update', 'Update task statuses from git', false)
    .action(async (options) => {
      try {
        const api = await getAPI();
        
        // Check if we're in a git repository
        if (!api.isGitRepository()) {
          handleError('Not in a git repository');
          return;
        }
        
        if (!options.prune && !options.update) {
          handleWarning('No action specified. Use --prune or --update');
          return;
        }
        
        handleInfo('Syncing task branches...\n');
        
        const results = await api.syncGitBranches({
          prune: options.prune,
          update: options.update
        });
        
        // Show results
        if (results.updated.length > 0) {
          handleSuccess(`Updated ${results.updated.length} task(s) with branch info:`);
          results.updated.forEach(item => {
            handleInfo(`  ${item.taskId}: ${item.branch}`);
          });
        }
        
        if (results.pruned.length > 0) {
          handleSuccess(`\nPruned ${results.pruned.length} merged branch(es):`);
          results.pruned.forEach(item => {
            handleInfo(`  ${item.taskId}: ${item.branch}`);
          });
        }
        
        if (results.errors.length > 0) {
          handleWarning(`\nEncountered ${results.errors.length} error(s):`);
          results.errors.forEach(item => {
            handleError(`  ${item.taskId}: ${item.error}`);
          });
        }
        
        if (results.updated.length === 0 && results.pruned.length === 0 && results.errors.length === 0) {
          handleInfo('No changes needed');
        }
        
      } catch (error) {
        handleError(error);
      }
    });
  
  return command;
}