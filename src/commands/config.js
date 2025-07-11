import { Command } from 'commander';
import { notImplemented } from '../lib/not-implemented.js';

export function configCommand() {
  const config = new Command('config');

  config
    .description('Manage taskwerk configuration')
    .argument('[key]', 'Configuration key to get/set')
    .argument('[value]', 'Configuration value to set')
    .option('-l, --list', 'List all configuration values')
    .option('-g, --global', 'Use global configuration')
    .option('--unset', 'Remove a configuration value')
    .action((key, value, _options) => {
      if (_options.list) {
        notImplemented('config', 'List all configuration values');
      } else if (key && value) {
        notImplemented('config', `Set configuration ${key}=${value}`);
      } else if (key && _options.unset) {
        notImplemented('config', `Unset configuration ${key}`);
      } else if (key) {
        notImplemented('config', `Get configuration value for ${key}`);
      } else {
        notImplemented('config', 'Manage configuration');
      }
    });

  return config;
}
