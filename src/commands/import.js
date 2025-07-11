import { Command } from 'commander';
import { notImplemented } from '../lib/not-implemented.js';

export function importCommand() {
  const imp = new Command('import');

  imp
    .description('Import tasks from a file')
    .argument('<file>', 'File to import')
    .option('-f, --format <format>', 'Import format (json, markdown)', 'json')
    .option('--merge', 'Merge with existing tasks')
    .option('--dry-run', 'Preview import without making changes')
    .action((file, _options) => {
      notImplemented('import', `Import tasks from ${file}`);
    });

  return imp;
}
