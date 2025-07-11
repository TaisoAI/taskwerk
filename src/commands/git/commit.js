import { Command } from 'commander';
import { notImplemented } from '../../lib/not-implemented.js';

export function gitCommitCommand() {
  const commit = new Command('commit');

  commit
    .description('Create a git commit linked to a task')
    .argument('<task-id>', 'Task ID to link commit to')
    .option('-m, --message <message>', 'Commit message')
    .option('-a, --all', 'Stage all changes before committing')
    .option('--amend', 'Amend the previous commit')
    .option('--co-author <email>', 'Add co-author to commit')
    .action((taskId, _options) => {
      notImplemented('git commit', `Create commit for task ${taskId}`);
    });

  return commit;
}
