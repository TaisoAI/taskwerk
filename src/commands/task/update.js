import { Command } from 'commander';
import { notImplemented } from '../../lib/not-implemented.js';

export function taskUpdateCommand() {
  const update = new Command('update');

  update
    .description('Update a task')
    .argument('<id>', 'Task ID')
    .option('-n, --name <name>', 'Update task name')
    .option('-p, --priority <level>', 'Update priority')
    .option('-a, --assignee <name>', 'Update assignee')
    .option('-e, --estimate <hours>', 'Update time estimate')
    .option('-s, --status <status>', 'Update status')
    .option('--progress <percent>', 'Update progress (0-100)')
    .option('--add-tags <tags...>', 'Add tags')
    .option('--remove-tags <tags...>', 'Remove tags')
    .option('--note <text>', 'Append a note')
    .action((id, _options) => {
      notImplemented('task update', `Update task ${id}`);
    });

  return update;
}
