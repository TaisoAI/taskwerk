import { Command } from 'commander';
import { notImplemented } from '../../lib/not-implemented.js';

export function taskDeleteCommand() {
  const del = new Command('delete');

  del
    .description('Delete a task')
    .argument('<id>', 'Task ID')
    .option('-f, --force', 'Force delete without confirmation')
    .option('--cascade', 'Delete all subtasks')
    .action((id, _options) => {
      notImplemented('task delete', `Delete task ${id}`);
    });

  return del;
}
