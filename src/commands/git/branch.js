import { Command } from 'commander';
import { notImplemented } from '../../lib/not-implemented.js';

export function gitBranchCommand() {
  const branch = new Command('branch');

  branch
    .description('Create a git branch for a task')
    .argument('<task-id>', 'Task ID to create branch for')
    .option('-b, --base <branch>', 'Base branch to create from', 'main')
    .option('--checkout', 'Checkout the branch after creation', true)
    .option('--no-checkout', 'Do not checkout the branch')
    .action((taskId, _options) => {
      notImplemented('git branch', `Create branch for task ${taskId}`);
    });

  return branch;
}
