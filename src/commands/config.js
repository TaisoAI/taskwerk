/**
 * TaskWerk v3 Config Command
 *
 * Manages TaskWerk configuration settings
 */

import { BaseCommand } from '../cli/base-command.js';
import { loadConfig, saveConfig, getConfigPath, getDefaultConfig } from '../utils/config.js';
import { readFile, access } from 'fs/promises';
import { constants } from 'fs';
import chalk from 'chalk';

/**
 * Config command implementation for v3
 */
export class ConfigCommand extends BaseCommand {
  constructor() {
    super('config', 'Manage TaskWerk configuration');

    // Set category
    this.category = 'System';

    // Define subcommands and options
    this.option('--list', 'Show all configuration values')
      .option('--get <key>', 'Get a specific configuration value')
      .option('--set <key=value>', 'Set a configuration value')
      .option('--unset <key>', 'Remove a configuration value')
      .option('--reset', 'Reset configuration to defaults')
      .option('--path', 'Show configuration file path')
      .option('--edit', 'Open configuration in editor')
      .option('--validate', 'Validate current configuration')
      .option('--migrate', 'Migrate v2 configuration to v3')
      .option('--json', 'Output in JSON format');
  }

  /**
   * Execute config command
   */
  async execute(args, options) {
    try {
      // Handle various operations
      if (options.path) {
        return this.showConfigPath();
      }

      if (options.list) {
        return this.listConfiguration(options);
      }

      if (options.get) {
        return this.getConfigValue(options.get, options);
      }

      if (options.set) {
        return this.setConfigValue(options.set, options);
      }

      if (options.unset) {
        return this.unsetConfigValue(options.unset, options);
      }

      if (options.reset) {
        return this.resetConfiguration(options);
      }

      if (options.edit) {
        return this.editConfiguration(options);
      }

      if (options.validate) {
        return this.validateConfiguration(options);
      }

      if (options.migrate) {
        return this.migrateConfiguration(options);
      }

      // Default: show current configuration
      return this.listConfiguration(options);
    } catch (error) {
      throw new Error(`Configuration operation failed: ${error.message}`);
    }
  }

  /**
   * Show configuration file path
   */
  showConfigPath() {
    const configPath = getConfigPath();
    this.info(`Configuration file: ${configPath}`);
    return configPath;
  }

  /**
   * List all configuration values
   */
  async listConfiguration(options) {
    const config = await loadConfig();

    if (options.json) {
      console.log(JSON.stringify(config, null, 2));
      return config;
    }

    console.log(chalk.bold('\nTaskWerk Configuration'));
    console.log(''.padEnd(50, '═'));

    this.displayConfigSection('Database', {
      databasePath: config.databasePath,
      backupEnabled: config.backupEnabled,
      backupInterval: config.backupInterval,
    });

    this.displayConfigSection('Display', {
      outputFormat: config.outputFormat,
      colors: config.colors,
      editor: config.editor,
      pager: config.pager,
    });

    this.displayConfigSection('Workflow', {
      requireEstimates: config.workflow?.requireEstimates,
      autoStart: config.workflow?.autoStart,
      validateDependencies: config.workflow?.validateDependencies,
      defaultPriority: config.workflow?.defaultPriority || 'medium',
    });

    this.displayConfigSection('Git Integration', {
      autoCommit: config.git?.autoCommit,
      branchPrefix: config.git?.branchPrefix,
      commitPrefix: config.git?.commitPrefix,
      signCommits: config.git?.signCommits,
    });

    this.displayConfigSection('AI Integration', {
      defaultModel: config.ai?.defaultModel,
      temperature: config.ai?.temperature,
      maxTokens: config.ai?.maxTokens,
      provider: config.ai?.provider,
    });

    return config;
  }

  /**
   * Display a configuration section
   */
  displayConfigSection(title, values) {
    console.log(`\n${chalk.cyan(title)}`);
    console.log(''.padEnd(30, '─'));

    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined) {
        const displayValue = value === true ? 'enabled' : value === false ? 'disabled' : value;
        console.log(`  ${key}: ${chalk.green(displayValue)}`);
      }
    }
  }

  /**
   * Get a specific configuration value
   */
  async getConfigValue(key, options) {
    const config = await loadConfig();
    const value = this.getNestedValue(config, key);

    if (value === undefined) {
      throw new Error(`Configuration key not found: ${key}`);
    }

    if (options.json) {
      console.log(JSON.stringify(value));
    } else {
      console.log(value);
    }

    return value;
  }

  /**
   * Set a configuration value
   */
  async setConfigValue(keyValue, _options) {
    const [key, ...valueParts] = keyValue.split('=');
    const value = valueParts.join('=');

    if (!key || value === undefined) {
      throw new Error('Invalid format. Use: --set key=value');
    }

    const config = await loadConfig();

    // Parse value type
    const parsedValue = this.parseConfigValue(value);

    // Set nested value
    this.setNestedValue(config, key, parsedValue);

    // Validate the new configuration
    const validation = this.validateConfig(config);
    if (!validation.valid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }

    // Save configuration
    await saveConfig(config);

    this.success(`Set ${key} = ${parsedValue}`);
    return { key, value: parsedValue };
  }

  /**
   * Unset a configuration value
   */
  async unsetConfigValue(key, _options) {
    const config = await loadConfig();

    // Check if key exists
    if (this.getNestedValue(config, key) === undefined) {
      throw new Error(`Configuration key not found: ${key}`);
    }

    // Remove nested value
    this.deleteNestedValue(config, key);

    // Save configuration
    await saveConfig(config);

    this.success(`Removed configuration: ${key}`);
    return { key, removed: true };
  }

  /**
   * Reset configuration to defaults
   */
  async resetConfiguration(_options) {
    const defaultConfig = getDefaultConfig();

    // Save default configuration
    await saveConfig(defaultConfig);

    this.success('Configuration reset to defaults');
    return defaultConfig;
  }

  /**
   * Edit configuration in editor
   */
  async editConfiguration(_options) {
    const config = await loadConfig();
    const configPath = getConfigPath();

    // Get editor from config or environment
    const editor = config.editor || process.env.EDITOR || 'nano';

    this.info(`Opening configuration in ${editor}...`);

    // Use dynamic import for child_process
    const { spawn } = await import('child_process');

    return new Promise((resolve, reject) => {
      const child = spawn(editor, [configPath], {
        stdio: 'inherit',
      });

      child.on('exit', async code => {
        if (code === 0) {
          // Validate the edited configuration
          try {
            const newConfig = await loadConfig();
            const validation = this.validateConfig(newConfig);

            if (!validation.valid) {
              this.error('Configuration validation failed:');
              validation.errors.forEach(err => this.error(`  - ${err}`));
              reject(new Error('Invalid configuration after edit'));
            } else {
              this.success('Configuration updated successfully');
              resolve(newConfig);
            }
          } catch (error) {
            reject(error);
          }
        } else {
          reject(new Error(`Editor exited with code ${code}`));
        }
      });
    });
  }

  /**
   * Validate current configuration
   */
  async validateConfiguration(options) {
    const config = await loadConfig();
    const validation = this.validateConfig(config);

    if (options.json) {
      console.log(JSON.stringify(validation, null, 2));
      return validation;
    }

    if (validation.valid) {
      this.success('Configuration is valid');
    } else {
      this.error('Configuration validation failed:');
      validation.errors.forEach(err => this.error(`  - ${err}`));
    }

    return validation;
  }

  /**
   * Migrate v2 configuration to v3
   */
  async migrateConfiguration(_options) {
    this.info('Checking for v2 configuration...');

    // Look for v2 config file
    const v2ConfigPath = '.taskrc.json';

    try {
      await access(v2ConfigPath, constants.F_OK);
    } catch (error) {
      throw new Error('No v2 configuration file found (.taskrc.json)');
    }

    // Read v2 config
    const v2ConfigContent = await readFile(v2ConfigPath, 'utf-8');
    const v2Config = JSON.parse(v2ConfigContent);

    this.info('Migrating v2 configuration to v3...');

    // Create v3 config from v2
    const v3Config = {
      version: '3.0.0',
      databasePath: v2Config.databasePath || '.taskwerk.db',
      outputFormat: v2Config.outputFormat || 'pretty',
      editor: v2Config.editor || process.env.EDITOR || 'nano',
      colors: v2Config.colors !== false,
      git: {
        autoCommit: v2Config.git?.autoCommit || false,
        branchPrefix: v2Config.git?.branchPrefix || 'task/',
        commitPrefix: v2Config.git?.commitPrefix || 'task:',
        signCommits: v2Config.git?.signCommits || false,
      },
      workflow: {
        requireEstimates: v2Config.workflow?.requireEstimates || false,
        autoStart: v2Config.workflow?.autoStart || true,
        validateDependencies: v2Config.workflow?.validateDependencies || true,
        defaultPriority: v2Config.defaultPriority || 'medium',
      },
      display: {
        dateFormat: v2Config.display?.dateFormat || 'YYYY-MM-DD',
        timeFormat: v2Config.display?.timeFormat || 'HH:mm',
        taskIdFormat: v2Config.display?.taskIdFormat || 'TASK-{id}',
      },
    };

    // Copy AI settings if present
    if (v2Config.ai) {
      v3Config.ai = {
        defaultModel: v2Config.ai.defaultModel,
        temperature: v2Config.ai.temperature,
        maxTokens: v2Config.ai.maxTokens,
        provider: v2Config.ai.provider,
      };
    }

    // Validate v3 config
    const validation = this.validateConfig(v3Config);
    if (!validation.valid) {
      throw new Error(`Migration failed: ${validation.errors.join(', ')}`);
    }

    // Save v3 config
    await saveConfig(v3Config);

    this.success('Configuration migrated successfully');
    this.info(`v2 config: ${v2ConfigPath}`);
    this.info(`v3 config: ${getConfigPath()}`);

    return v3Config;
  }

  /**
   * Validate configuration object
   */
  validateConfig(config) {
    const errors = [];

    // Required fields
    if (!config.version) {
      errors.push('version is required');
    }
    if (!config.databasePath) {
      errors.push('databasePath is required');
    }

    // Type validations
    if (config.outputFormat && !['pretty', 'plain', 'json'].includes(config.outputFormat)) {
      errors.push('outputFormat must be one of: pretty, plain, json');
    }

    if (config.colors !== undefined && typeof config.colors !== 'boolean') {
      errors.push('colors must be a boolean');
    }

    // Workflow validations
    if (config.workflow) {
      const workflow = config.workflow;
      if (
        workflow.defaultPriority &&
        !['high', 'medium', 'low'].includes(workflow.defaultPriority)
      ) {
        errors.push('workflow.defaultPriority must be one of: high, medium, low');
      }
    }

    // AI validations
    if (config.ai) {
      const ai = config.ai;
      if (ai.temperature !== undefined && (ai.temperature < 0 || ai.temperature > 2)) {
        errors.push('ai.temperature must be between 0 and 2');
      }
      if (ai.maxTokens !== undefined && ai.maxTokens < 1) {
        errors.push('ai.maxTokens must be greater than 0');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Parse configuration value from string
   */
  parseConfigValue(value) {
    // Boolean
    if (value === 'true') {
      return true;
    }
    if (value === 'false') {
      return false;
    }

    // Number
    if (/^\d+$/.test(value)) {
      return parseInt(value);
    }
    if (/^\d+\.\d+$/.test(value)) {
      return parseFloat(value);
    }

    // String
    return value;
  }

  /**
   * Get nested configuration value
   */
  getNestedValue(obj, path) {
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current[key] === undefined) {
        return undefined;
      }
      current = current[key];
    }

    return current;
  }

  /**
   * Set nested configuration value
   */
  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    let current = obj;

    for (const key of keys) {
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    current[lastKey] = value;
  }

  /**
   * Delete nested configuration value
   */
  deleteNestedValue(obj, path) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    let current = obj;

    for (const key of keys) {
      if (!current[key]) {
        return;
      }
      current = current[key];
    }

    delete current[lastKey];
  }
}

// Export as default for auto-discovery
export default ConfigCommand;
