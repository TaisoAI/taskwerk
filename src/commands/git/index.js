import { Command } from 'commander';
import { gitBranchCommand } from './branch.js';
import { gitCommitCommand } from './commit.js';

export function gitCommand() {
  const git = new Command('git');

  git
    .description('Git integration commands')
    .addCommand(gitBranchCommand())
    .addCommand(gitCommitCommand());

  return git;
}
