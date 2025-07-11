import { Command } from 'commander';
import { notImplemented } from '../../lib/not-implemented.js';

export function taskAddCommand() {
  const add = new Command('add');

  add
    .description('Add a new task')
    .argument('<name>', 'Task name')
    .option('-p, --priority <level>', 'Set priority (low, medium, high)', 'medium')
    .option('-a, --assignee <name>', 'Assign task to a person')
    .option('-e, --estimate <hours>', 'Time estimate in hours')
    .option('-P, --parent <id>', 'Parent task ID')
    .option('-t, --tags <tags...>', 'Add tags to the task')
    .option('-d, --description <text>', 'Task description')
    .action((name, _options) => {
      notImplemented('task add', `Add new task "${name}"`);
    });

  return add;
}
