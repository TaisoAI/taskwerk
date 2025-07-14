import { Command } from 'commander';
import { ConfigManager } from '../config/config-manager.js';
import { Logger } from '../logging/logger.js';

export function configCommand() {
  const config = new Command('config');

  config
    .description('Manage taskwerk configuration')
    .argument('[key]', 'Configuration key to get/set (e.g., general.defaultPriority)')
    .argument('[value]', 'Configuration value to set')
    .option('-l, --list', 'List all configuration values')
    .option('-g, --global', 'Use global configuration')
    .option('--unset', 'Remove a configuration value')
    .option('--format <format>', 'Output format (text, json)', 'text')
    .action(async (key, value, options) => {
      const logger = new Logger('config');
      
      try {
        const configManager = new ConfigManager();
        
        if (options.list) {
          // List all configuration
          const config = configManager.load();
          
          if (options.format === 'json') {
            console.log(JSON.stringify(config, null, 2));
            return;
          }
          
          console.log('⚙️  Taskwerk Configuration');
          console.log('═'.repeat(50));
          
          const printSection = (obj, prefix = '') => {
            for (const [k, v] of Object.entries(obj)) {
              const fullKey = prefix ? `${prefix}.${k}` : k;
              if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
                console.log(`\n📂 ${fullKey}:`);
                printSection(v, fullKey);
              } else {
                console.log(`  ${fullKey}: ${JSON.stringify(v)}`);
              }
            }
          };
          
          printSection(config);
          console.log('═'.repeat(50));
          
        } else if (key && value !== undefined) {
          // Set configuration value
          configManager.set(key, value);
          console.log(`✅ Set ${key} = ${JSON.stringify(value)}`);
          
        } else if (key && options.unset) {
          // Unset configuration value
          configManager.unset(key);
          console.log(`✅ Unset ${key}`);
          
        } else if (key) {
          // Get configuration value
          const configValue = configManager.get(key);
          
          if (configValue === undefined) {
            console.log(`❌ Configuration key '${key}' not found`);
            process.exit(1);
          }
          
          if (options.format === 'json') {
            console.log(JSON.stringify(configValue, null, 2));
          } else {
            console.log(`${key}: ${JSON.stringify(configValue)}`);
          }
          
        } else {
          // Show config help
          console.log('⚙️  Configuration Management');
          console.log('');
          console.log('Usage:');
          console.log('  taskwerk config --list                     # List all config');
          console.log('  taskwerk config <key>                      # Get config value');
          console.log('  taskwerk config <key> <value>              # Set config value');
          console.log('  taskwerk config <key> --unset              # Remove config');
          console.log('');
          console.log('Examples:');
          console.log('  taskwerk config general.defaultPriority medium');
          console.log('  taskwerk config developer.logLevel debug');
          console.log('  taskwerk config database.path');
          console.log('');
          console.log('Common settings:');
          console.log('  general.defaultPriority    - Default task priority (low, medium, high)');
          console.log('  general.defaultStatus      - Default task status (todo, in-progress)');
          console.log('  developer.logLevel         - Logging level (error, warn, info, debug)');
          console.log('  developer.logConsole       - Enable console logging (true/false)');
          console.log('  developer.logFile          - Enable file logging (true/false)');
        }
        
      } catch (error) {
        logger.error('Failed to manage configuration', error);
        console.error('❌ Failed to manage configuration:', error.message);
        process.exit(1);
      }
    });

  return config;
}
