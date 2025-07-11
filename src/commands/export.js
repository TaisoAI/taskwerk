import { Command } from 'commander';
import { notImplemented } from '../lib/not-implemented.js';

export function exportCommand() {
  const exp = new Command('export');

  exp
    .description('Export tasks to a file')
    .option('-f, --format <format>', 'Export format (json, markdown)', 'json')
    .option('-o, --output <file>', 'Output file path')
    .option('-s, --status <status>', 'Filter by status')
    .option('-a, --assignee <name>', 'Filter by assignee')
    .option('--all', 'Include completed and archived tasks')
    .action(_options => {
      notImplemented('export', `Export tasks to ${_options.format} format`);
    });

  return exp;
}
