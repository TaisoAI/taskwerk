import { Command } from 'commander';
import { notImplemented } from '../lib/not-implemented.js';

export function statusCommand() {
  const status = new Command('status');

  status
    .description('Show taskwerk repository status')
    .option('--format <format>', 'Output format (text, json)', 'text')
    .action(_options => {
      notImplemented('status', 'Show repository status and statistics');
    });

  return status;
}
