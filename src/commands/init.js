import { Command } from 'commander';
import { notImplemented } from '../lib/not-implemented.js';

export function initCommand() {
  const init = new Command('init');

  init
    .description('Initialize taskwerk in the current directory')
    .option('-f, --force', 'Force initialization, overwrite existing config')
    .option('--git', 'Enable git integration', true)
    .option('--no-git', 'Disable git integration')
    .action(_options => {
      notImplemented('init', 'Initialize taskwerk repository');
    });

  return init;
}
