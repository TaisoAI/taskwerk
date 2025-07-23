import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { getConfigSchema, getDefaultConfig, getSensitiveFields } from './schema.js';
import { ConfigurationError } from '../errors/index.js';
import { mergeEnvConfig } from './env-loader.js';
import { Logger } from '../logging/logger.js';

const CONFIG_DIR = '.taskwerk';
const CONFIG_FILE = 'config.yml';

/**
 * Configuration source types
 */
export const ConfigSource = {
  DEFAULT: 'default',
  GLOBAL: 'global',
  LOCAL: 'local',
  ENV: 'env',
};

/**
 * Get global configuration path
 */
export function getGlobalConfigPath() {
  // Check XDG_CONFIG_HOME first
  const xdgConfig = process.env.XDG_CONFIG_HOME;
  if (xdgConfig) {
    return join(xdgConfig, 'taskwerk', 'config.yml');
  }

  // Default to ~/.config/taskwerk/config.yml
  const configPath = join(homedir(), '.config', 'taskwerk', 'config.yml');

  // Check for legacy ~/.taskwerk/config.yml
  const legacyPath = join(homedir(), '.taskwerk', 'config.yml');
  if (existsSync(legacyPath) && !existsSync(configPath)) {
    return legacyPath;
  }

  // Also check for JSON variants
  const configJsonPath = configPath.replace('.yml', '.json');
  const legacyJsonPath = legacyPath.replace('.yml', '.json');

  if (existsSync(configJsonPath)) {
    return configJsonPath;
  }
  if (existsSync(legacyJsonPath)) {
    return legacyJsonPath;
  }

  return configPath;
}

/**
 * Enhanced configuration manager with global/local support
 */
export class GlobalConfigManager {
  constructor(localPath = null) {
    this.localPath = localPath || join(CONFIG_DIR, CONFIG_FILE);
    this.globalPath = getGlobalConfigPath();
    this.logger = new Logger('config');

    // Configuration layers
    this.defaultConfig = null;
    this.globalConfig = null;
    this.localConfig = null;
    this.envConfig = null;
    this.mergedConfig = null;

    // Track source of each config value
    this.configSources = new Map();

    this.schema = getConfigSchema();
    this.sensitiveFields = getSensitiveFields();
  }

  /**
   * Load all configuration layers
   */
  load() {
    try {
      // 1. Load default configuration
      this.defaultConfig = getDefaultConfig();
      this.trackSources(this.defaultConfig, ConfigSource.DEFAULT);

      // 2. Load global configuration if exists
      if (existsSync(this.globalPath)) {
        this.globalConfig = this.loadConfigFile(this.globalPath);
        this.trackSources(this.globalConfig, ConfigSource.GLOBAL);
        this.checkFilePermissions(this.globalPath, true);
      }

      // 3. Load local configuration if exists
      if (existsSync(this.localPath)) {
        this.localConfig = this.loadConfigFile(this.localPath);
        this.trackSources(this.localConfig, ConfigSource.LOCAL);
      }

      // 4. Load environment configuration
      this.envConfig = mergeEnvConfig({});
      this.trackSources(this.envConfig, ConfigSource.ENV);

      // 5. Merge all configurations
      this.mergedConfig = this.mergeConfigs();

      // 6. Validate final configuration
      this.validate();

      return this.mergedConfig;
    } catch (error) {
      if (error instanceof ConfigurationError) {
        throw error;
      }
      throw new ConfigurationError(`Failed to load configuration: ${error.message}`, 'load', {
        localPath: this.localPath,
        globalPath: this.globalPath,
      });
    }
  }

  /**
   * Load configuration from a file
   */
  loadConfigFile(filePath) {
    const content = readFileSync(filePath, 'utf8');

    // Support both YAML and JSON
    if (filePath.endsWith('.yml') || filePath.endsWith('.yaml')) {
      return parseYaml(content);
    } else if (filePath.endsWith('.json')) {
      return JSON.parse(content);
    } else {
      // Try YAML first, then JSON
      try {
        return parseYaml(content);
      } catch {
        return JSON.parse(content);
      }
    }
  }

  /**
   * Save configuration to file
   * @param {boolean} global - Save to global config instead of local
   */
  save(global = false) {
    const configPath = global ? this.globalPath : this.localPath;
    const configToSave = global ? this.globalConfig : this.localConfig;

    if (!configToSave) {
      throw new ConfigurationError(
        `No ${global ? 'global' : 'local'} configuration to save`,
        'save',
        { configPath }
      );
    }

    try {
      // Ensure directory exists
      const dir = dirname(configPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      // Mask sensitive fields
      const masked = this.maskSensitiveFields(configToSave);

      // Serialize based on file extension
      let content;
      if (configPath.endsWith('.yml') || configPath.endsWith('.yaml')) {
        content = stringifyYaml(masked, {
          indent: 2,
          lineWidth: 80,
        });
      } else {
        content = JSON.stringify(masked, null, 2);
      }

      writeFileSync(configPath, content, 'utf8');

      // Set secure permissions for global config
      if (global && configPath.includes(homedir())) {
        try {
          chmodSync(configPath, 0o600); // User read/write only
        } catch (error) {
          this.logger.warn(`Could not set secure permissions on ${configPath}: ${error.message}`);
        }
      }
    } catch (error) {
      throw new ConfigurationError(
        `Failed to save ${global ? 'global' : 'local'} configuration: ${error.message}`,
        'save',
        { configPath }
      );
    }
  }

  /**
   * Get a configuration value
   */
  get(path, defaultValue = undefined) {
    if (!this.mergedConfig) {
      this.load();
    }

    const parts = path.split('.');
    let value = this.mergedConfig;

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
   * Set a configuration value
   * @param {string} path - Configuration path
   * @param {any} value - Value to set
   * @param {boolean} global - Set in global config instead of local
   */
  set(path, value, global = false) {
    if (!this.mergedConfig) {
      this.load();
    }

    // Initialize target config if needed
    if (global && !this.globalConfig) {
      this.globalConfig = {};
    } else if (!global && !this.localConfig) {
      this.localConfig = {};
    }

    const targetConfig = global ? this.globalConfig : this.localConfig;
    const parts = path.split('.');
    const lastPart = parts.pop();
    let target = targetConfig;

    // Navigate to the parent object
    for (const part of parts) {
      if (!(part in target)) {
        target[part] = {};
      }
      target = target[part];
    }

    // Set the value
    target[lastPart] = value;

    // Update source tracking
    this.configSources.set(path, global ? ConfigSource.GLOBAL : ConfigSource.LOCAL);

    // Re-merge configurations
    this.mergedConfig = this.mergeConfigs();

    // Validate after setting
    this.validate();
  }

  /**
   * Delete a configuration value
   * @param {string} path - Configuration path
   * @param {boolean} global - Delete from global config
   */
  delete(path, global = false) {
    if (!this.mergedConfig) {
      this.load();
    }

    const targetConfig = global ? this.globalConfig : this.localConfig;
    if (!targetConfig) {
      return false;
    }

    const parts = path.split('.');
    const lastPart = parts.pop();
    let target = targetConfig;

    // Navigate to the parent object
    for (const part of parts) {
      if (!(part in target)) {
        return false;
      }
      target = target[part];
    }

    if (lastPart in target) {
      delete target[lastPart];

      // Re-merge configurations
      this.mergedConfig = this.mergeConfigs();

      return true;
    }

    return false;
  }

  /**
   * Get configuration source for a path
   */
  getSource(path) {
    return this.configSources.get(path) || ConfigSource.DEFAULT;
  }

  /**
   * Get configuration with source information
   */
  getWithSources() {
    if (!this.mergedConfig) {
      this.load();
    }

    const result = {};
    const addWithSource = (obj, path = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const fullPath = path ? `${path}.${key}` : key;

        if (this.isObject(value)) {
          result[key] = {};
          addWithSource(value, fullPath);
        } else {
          result[key] = {
            value: value,
            source: this.getSource(fullPath),
          };
        }
      }
    };

    addWithSource(this.mergedConfig);
    return result;
  }

  /**
   * Merge configurations in priority order
   */
  mergeConfigs() {
    let merged = {};

    // Merge in order: defaults → global → local → env
    if (this.defaultConfig) {
      merged = this.deepMerge(merged, this.defaultConfig);
    }
    if (this.globalConfig) {
      merged = this.deepMerge(merged, this.globalConfig);
    }
    if (this.localConfig) {
      merged = this.deepMerge(merged, this.localConfig);
    }
    if (this.envConfig) {
      merged = this.deepMerge(merged, this.envConfig);
    }

    return merged;
  }

  /**
   * Track sources of configuration values
   */
  trackSources(config, source, path = '') {
    if (!config) {
      return;
    }

    for (const [key, value] of Object.entries(config)) {
      const fullPath = path ? `${path}.${key}` : key;

      if (this.isObject(value)) {
        this.trackSources(value, source, fullPath);
      } else if (value !== undefined) {
        // Only track if not already tracked by higher priority source
        const currentSource = this.configSources.get(fullPath);
        const sourcePriority = {
          [ConfigSource.DEFAULT]: 0,
          [ConfigSource.GLOBAL]: 1,
          [ConfigSource.LOCAL]: 2,
          [ConfigSource.ENV]: 3,
        };

        if (!currentSource || sourcePriority[source] > sourcePriority[currentSource]) {
          this.configSources.set(fullPath, source);
        }
      }
    }
  }

  /**
   * Check file permissions for security
   */
  checkFilePermissions(filePath, isGlobal = false) {
    try {
      const stats = statSync(filePath);
      const mode = stats.mode & parseInt('777', 8);

      // Check if file is world-readable
      if (mode & 0o004) {
        const message = `Configuration file ${filePath} is world-readable. This may expose sensitive data.`;

        if (isGlobal && this.hasSensitiveData(isGlobal ? this.globalConfig : this.localConfig)) {
          this.logger.warn(message);
          console.warn(`⚠️  ${message}`);
          console.warn(`   Run: chmod 600 "${filePath}" to fix`);
        }
      }
    } catch (error) {
      // Ignore permission check errors
    }
  }

  /**
   * Check if config contains sensitive data
   */
  hasSensitiveData(config) {
    if (!config) {
      return false;
    }

    for (const field of this.sensitiveFields) {
      const value = this.getValueByPath(config, field);
      if (value && value !== '********') {
        return true;
      }
    }

    return false;
  }

  /**
   * Get value by path from object
   */
  getValueByPath(obj, path) {
    const parts = path.split('.');
    let value = obj;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Deep merge two objects
   */
  deepMerge(target, source) {
    const output = { ...target };

    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            output[key] = source[key];
          } else {
            output[key] = this.deepMerge(target[key], source[key]);
          }
        } else {
          output[key] = source[key];
        }
      });
    }

    return output;
  }

  /**
   * Check if value is a plain object
   */
  isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
  }

  /**
   * Validate configuration
   */
  validate() {
    const errors = [];
    this.validateObject(this.mergedConfig, this.schema, '', errors);

    if (errors.length > 0) {
      throw new ConfigurationError(
        `Configuration validation failed: ${errors.join(', ')}`,
        'validation',
        errors
      );
    }
  }

  /**
   * Recursively validate an object against a schema
   */
  validateObject(obj, schema, path, errors) {
    if (schema.type !== 'object') {
      return;
    }

    // Check for unknown properties
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(obj)) {
        if (!(key in schema.properties)) {
          errors.push(`Unknown property: ${path}${key}`);
        }
      }
    }

    // Check required properties
    const requiredProps = schema.required || [];
    for (const requiredProp of requiredProps) {
      if (!(requiredProp in obj)) {
        const fullPath = path ? `${path}.${requiredProp}` : requiredProp;
        errors.push(`Missing required property: ${fullPath}`);
      }
    }

    // Validate each property that exists
    for (const [key, propSchema] of Object.entries(schema.properties || {})) {
      const fullPath = path ? `${path}.${key}` : key;
      const value = obj[key];

      if (value !== undefined) {
        this.validateValue(value, propSchema, fullPath, errors);
      }
    }
  }

  /**
   * Validate a value against a schema
   */
  validateValue(value, schema, path, errors) {
    // Type validation
    if (schema.type) {
      const type = Array.isArray(value) ? 'array' : typeof value;
      if (schema.type === 'integer') {
        if (type !== 'number' || !Number.isInteger(value)) {
          errors.push(`Invalid type for ${path}: expected integer, got ${type}`);
          return;
        }
      } else if (type !== schema.type) {
        errors.push(`Invalid type for ${path}: expected ${schema.type}, got ${type}`);
        return;
      }
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push(`Invalid value for ${path}: must be one of ${schema.enum.join(', ')}`);
    }

    // String pattern validation
    if (schema.pattern && typeof value === 'string') {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(value)) {
        errors.push(`Invalid format for ${path}: must match pattern ${schema.pattern}`);
      }
    }

    // Number range validation
    if (typeof value === 'number') {
      if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push(`Value for ${path} must be >= ${schema.minimum}`);
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push(`Value for ${path} must be <= ${schema.maximum}`);
      }
    }

    // Nested object validation
    if (schema.type === 'object' && schema.properties) {
      this.validateObject(value, schema, path, errors);
    }
  }

  /**
   * Mask sensitive fields in configuration
   */
  maskSensitiveFields(config) {
    const masked = JSON.parse(JSON.stringify(config)); // Deep clone

    for (const field of this.sensitiveFields) {
      const parts = field.split('.');
      let target = masked;

      for (let i = 0; i < parts.length - 1; i++) {
        if (target[parts[i]]) {
          target = target[parts[i]];
        } else {
          break;
        }
      }

      const lastPart = parts[parts.length - 1];
      if (target[lastPart]) {
        target[lastPart] = '********';
      }
    }

    return masked;
  }

  /**
   * Get masked configuration
   */
  getMasked() {
    if (!this.mergedConfig) {
      this.load();
    }
    return this.maskSensitiveFields(this.mergedConfig);
  }

  /**
   * Get global configuration (masked)
   */
  getGlobalMasked() {
    if (!this.globalConfig) {
      return null;
    }
    return this.maskSensitiveFields(this.globalConfig);
  }

  /**
   * Get local configuration (masked)
   */
  getLocalMasked() {
    if (!this.localConfig) {
      return null;
    }
    return this.maskSensitiveFields(this.localConfig);
  }

  /**
   * Migrate local config to global
   */
  async migrateToGlobal() {
    if (!this.localConfig) {
      throw new ConfigurationError('No local configuration to migrate', 'migrate');
    }

    // Merge with existing global config if any
    if (this.globalConfig) {
      this.globalConfig = this.deepMerge(this.globalConfig, this.localConfig);
    } else {
      this.globalConfig = { ...this.localConfig };
    }

    // Save global config
    this.save(true);

    // Clear local config
    this.localConfig = {};
    this.save(false);

    return true;
  }

  /**
   * Copy global config to local
   */
  async copyFromGlobal() {
    if (!this.globalConfig) {
      throw new ConfigurationError('No global configuration to copy', 'copy');
    }

    // Merge with existing local config if any
    if (this.localConfig) {
      this.localConfig = this.deepMerge(this.localConfig, this.globalConfig);
    } else {
      this.localConfig = { ...this.globalConfig };
    }

    // Save local config
    this.save(false);

    return true;
  }

  /**
   * Clear configuration
   * @param {boolean} global - Clear global config instead of local
   */
  clear(global = false) {
    if (global) {
      this.globalConfig = {};
      this.save(true);
    } else {
      this.localConfig = {};
      this.save(false);
    }

    // Reload to update merged config
    this.load();
  }
}

// Singleton instance
let configManagerInstance = null;

/**
 * Get the global configuration manager instance
 */
export function getGlobalConfigManager(localPath = null) {
  if (!configManagerInstance) {
    configManagerInstance = new GlobalConfigManager(localPath);
  }
  return configManagerInstance;
}

/**
 * Reset the global configuration manager instance
 */
export function resetGlobalConfigManager() {
  configManagerInstance = null;
}
