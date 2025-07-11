import { Command } from 'commander';
import { notImplemented } from '../../lib/not-implemented.js';

export function taskStatusCommand() {
  const status = new Command('status');

  status
    .description('Change task status')
    .argument('<id>', 'Task ID')
    .argument('<status>', 'New status (todo, in-progress, blocked, done)')
    .option('--note <text>', 'Add a note about the status change')
    .action((id, newStatus, _options) => {
      notImplemented('task status', `Change status of task ${id} to ${newStatus}`);
    });

  return status;
}
