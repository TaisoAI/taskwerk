import { Command } from 'commander';
import { createGitBranchCommand } from './git/branch.js';
import { createGitCommitCommand } from './git/commit.js';
import { createGitSyncCommand } from './git/sync.js';

export function createGitCommand() {
  const command = new Command('git');
  
  command
    .description('Git integration commands')
    .addCommand(createGitBranchCommand())
    .addCommand(createGitCommitCommand())
    .addCommand(createGitSyncCommand());
  
  return command;
}