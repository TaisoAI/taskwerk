import { Command } from 'commander';
import { notImplemented } from '../../lib/not-implemented.js';

export function taskShowCommand() {
  const show = new Command('show');

  show
    .description('Show task details')
    .argument('<id>', 'Task ID')
    .option('--format <format>', 'Output format (text, json)', 'text')
    .action((id, _options) => {
      notImplemented('task show', `Show details for task ${id}`);
    });

  return show;
}
