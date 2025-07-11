import { Command } from 'commander';
import { taskAddCommand } from './add.js';
import { taskListCommand } from './list.js';
import { taskShowCommand } from './show.js';
import { taskUpdateCommand } from './update.js';
import { taskDeleteCommand } from './delete.js';
import { taskStatusCommand } from './status.js';

export function taskCommand() {
  const task = new Command('task');

  task
    .description('Manage tasks')
    .addCommand(taskAddCommand())
    .addCommand(taskListCommand())
    .addCommand(taskShowCommand())
    .addCommand(taskUpdateCommand())
    .addCommand(taskDeleteCommand())
    .addCommand(taskStatusCommand());

  return task;
}
