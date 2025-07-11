import { Command } from 'commander';
import { notImplemented } from '../../lib/not-implemented.js';

export function taskListCommand() {
  const list = new Command('list');

  list
    .description('List tasks')
    .option('-s, --status <status>', 'Filter by status')
    .option('-a, --assignee <name>', 'Filter by assignee')
    .option('-p, --priority <level>', 'Filter by priority')
    .option('-t, --tags <tags...>', 'Filter by tags')
    .option('--sort <field>', 'Sort by field (created, updated, priority)', 'created')
    .option('--format <format>', 'Output format (table, json, csv)', 'table')
    .option('--limit <number>', 'Limit number of results', '50')
    .option('--all', 'Show all tasks including completed/archived')
    .action(_options => {
      notImplemented('task list', 'List all tasks with filters');
    });

  return list;
}
