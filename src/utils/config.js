/**
 * TaskWerk v3 Configuration Management
 *
 * Handles loading, validation, and management of TaskWerk configuration
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
  version: '3.0.0',
  databasePath: '.taskwerk.db',
  outputFormat: 'pretty',
  editor: process.env.EDITOR || 'nano',
  colors: true,
  debug: false,
  git: {
    autoCommit: false,
    branchPrefix: 'task/',
    commitPrefix: 'task:',
  },
  workflow: {
    requireEstimates: false,
    autoStart: true,
    validateDependencies: true,
  },
  display: {
    dateFormat: 'YYYY-MM-DD',
    timeFormat: 'HH:mm',
    taskIdFormat: 'TASK-{id}',
    showDetails: false,
    groupBy: null,
  },
};

/**
 * Configuration file locations in order of precedence
 */
const CONFIG_LOCATIONS = [
  '.taskwerk.json', // Current directory
  '.taskwerkrc', // Current directory (alternative)
  '.taskwerkrc.json', // Current directory (alternative)
  join(homedir(), '.taskwerk.json'), // User home directory
  join(homedir(), '.config', 'taskwerk', 'config.json'), // XDG config
];

/**
 * Loaded configuration cache
 */
let configCache = null;

/**
 * Load configuration from file system
 */
export async function loadConfig(customPath = null) {
  // Return cached config if available
  if (configCache && !customPath) {
    return configCache;
  }

  // Check custom path first
  if (customPath) {
    if (existsSync(customPath)) {
      const config = loadConfigFile(customPath);
      return mergeConfigs(DEFAULT_CONFIG, config);
    } else {
      throw new Error(`Configuration file not found: ${customPath}`);
    }
  }

  // Check standard locations
  for (const location of CONFIG_LOCATIONS) {
    if (existsSync(location)) {
      const config = loadConfigFile(location);
      configCache = mergeConfigs(DEFAULT_CONFIG, config);
      configCache._configPath = location;
      return configCache;
    }
  }

  // Return default config if no file found
  configCache = { ...DEFAULT_CONFIG };
  return configCache;
}

/**
 * Load configuration from a specific file
 */
function loadConfigFile(path) {
  try {
    const content = readFileSync(path, 'utf8');
    const config = JSON.parse(content);

    // Validate config
    validateConfig(config);

    return config;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in configuration file ${path}: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Save configuration to file
 */
export async function saveConfig(config, path = null) {
  const configPath = path || config._configPath || CONFIG_LOCATIONS[0];

  // Remove internal properties
  const configToSave = { ...config };
  delete configToSave._configPath;

  try {
    // Ensure directory exists
    const dir = dirname(configPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(configPath, JSON.stringify(configToSave, null, 2));

    // Update cache
    configCache = config;
    configCache._configPath = configPath;

    return configPath;
  } catch (error) {
    throw new Error(`Failed to save configuration: ${error.message}`);
  }
}

/**
 * Get a configuration value by path
 */
export function getConfigValue(path, defaultValue = undefined) {
  const config = configCache || DEFAULT_CONFIG;

  const parts = path.split('.');
  let value = config;

  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = value[part];
    } else {
      return defaultValue;
    }
  }

  return value;
}

/**
 * Set a configuration value by path
 */
export function setConfigValue(path, value) {
  if (!configCache) {
    configCache = { ...DEFAULT_CONFIG };
  }

  const parts = path.split('.');
  let target = configCache;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in target) || typeof target[part] !== 'object') {
      target[part] = {};
    }
    target = target[part];
  }

  target[parts[parts.length - 1]] = value;

  return configCache;
}

/**
 * Validate configuration object
 */
function validateConfig(config) {
  // Check required fields
  if (!config.version) {
    throw new Error('Configuration must include version');
  }

  // Validate types
  if (config.databasePath && typeof config.databasePath !== 'string') {
    throw new Error('databasePath must be a string');
  }

  if (config.outputFormat && !['pretty', 'plain', 'json'].includes(config.outputFormat)) {
    throw new Error('outputFormat must be one of: pretty, plain, json');
  }

  if (config.colors !== undefined && typeof config.colors !== 'boolean') {
    throw new Error('colors must be a boolean');
  }

  // Validate nested objects
  if (config.git && typeof config.git !== 'object') {
    throw new Error('git configuration must be an object');
  }

  if (config.workflow && typeof config.workflow !== 'object') {
    throw new Error('workflow configuration must be an object');
  }

  if (config.display && typeof config.display !== 'object') {
    throw new Error('display configuration must be an object');
  }

  return true;
}

/**
 * Merge configurations with proper nesting
 */
function mergeConfigs(base, override) {
  const result = { ...base };

  for (const [key, value] of Object.entries(override)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      // Recursively merge objects
      result[key] = mergeConfigs(base[key] || {}, value);
    } else {
      // Direct assignment for primitives and arrays
      result[key] = value;
    }
  }

  return result;
}

/**
 * Reset configuration cache
 */
export function resetConfigCache() {
  configCache = null;
}

/**
 * Get all configuration paths to check
 */
export function getConfigPaths() {
  return CONFIG_LOCATIONS.slice();
}

/**
 * Create a default configuration file
 */
export function createDefaultConfig(path = CONFIG_LOCATIONS[0]) {
  try {
    writeFileSync(path, JSON.stringify(DEFAULT_CONFIG, null, 2));
    return path;
  } catch (error) {
    throw new Error(`Failed to create configuration file: ${error.message}`);
  }
}

/**
 * Get the path where configuration will be saved
 */
export function getConfigPath() {
  if (configCache && configCache._configPath) {
    return configCache._configPath;
  }

  // Check standard locations
  for (const location of CONFIG_LOCATIONS) {
    if (existsSync(location)) {
      return location;
    }
  }

  // Return default location
  return CONFIG_LOCATIONS[0];
}

/**
 * Get default configuration
 */
export function getDefaultConfig() {
  return { ...DEFAULT_CONFIG };
}

export default {
  loadConfig,
  saveConfig,
  getConfigValue,
  setConfigValue,
  resetConfigCache,
  getConfigPaths,
  getConfigPath,
  getDefaultConfig,
  createDefaultConfig,
  DEFAULT_CONFIG,
};
