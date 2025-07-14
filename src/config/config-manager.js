import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { getConfigSchema, getDefaultConfig, getSensitiveFields } from './schema.js';
import { ConfigurationError } from '../errors/index.js';
import { mergeEnvConfig } from './env-loader.js';

const CONFIG_DIR = join(homedir(), '.taskwerk');
const CONFIG_FILE = 'config.yml';
const CONFIG_PATH = join(CONFIG_DIR, CONFIG_FILE);

/**
 * Configuration manager for Taskwerk
 */
export class ConfigManager {
  constructor(configPath = null) {
    this.configPath = configPath || CONFIG_PATH;
    this.config = null;
    this.schema = getConfigSchema();
    this.sensitiveFields = getSensitiveFields();
  }

  /**
   * Load configuration from file
   */
  load() {
    try {
      if (!existsSync(this.configPath)) {
        // Create default config if it doesn't exist
        this.config = getDefaultConfig();
        // Don't automatically save - let the user configure it first
        return this.config;
      }

      const configContent = readFileSync(this.configPath, 'utf8');
      let parsedConfig;

      // Support both YAML and JSON
      if (this.configPath.endsWith('.yml') || this.configPath.endsWith('.yaml')) {
        parsedConfig = parseYaml(configContent);
      } else if (this.configPath.endsWith('.json')) {
        parsedConfig = JSON.parse(configContent);
      } else {
        // Try YAML first, then JSON
        try {
          parsedConfig = parseYaml(configContent);
        } catch {
          parsedConfig = JSON.parse(configContent);
        }
      }

      // Merge with defaults
      this.config = this.mergeWithDefaults(parsedConfig);
      
      // Merge environment variables (they take precedence)
      this.config = mergeEnvConfig(this.config);
      
      // Validate configuration
      this.validate();
      
      return this.config;
    } catch (error) {
      if (error instanceof ConfigurationError) {
        throw error;
      }
      throw new ConfigurationError(
        `Failed to load configuration: ${error.message}`,
        'configPath',
        this.configPath
      );
    }
  }

  /**
   * Save configuration to file
   */
  save() {
    try {
      // Ensure config directory exists
      const dir = dirname(this.configPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      // Mask sensitive fields before saving
      const configToSave = this.maskSensitiveFields(this.config);

      let content;
      if (this.configPath.endsWith('.yml') || this.configPath.endsWith('.yaml')) {
        content = stringifyYaml(configToSave, {
          indent: 2,
          lineWidth: 80,
        });
      } else {
        content = JSON.stringify(configToSave, null, 2);
      }

      writeFileSync(this.configPath, content, 'utf8');
    } catch (error) {
      throw new ConfigurationError(
        `Failed to save configuration: ${error.message}`,
        'configPath',
        this.configPath
      );
    }
  }

  /**
   * Get a configuration value
   */
  get(path, defaultValue = undefined) {
    if (!this.config) {
      this.load();
    }

    const parts = path.split('.');
    let value = this.config;

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
   */
  set(path, value) {
    if (!this.config) {
      this.load();
    }

    const parts = path.split('.');
    const lastPart = parts.pop();
    let target = this.config;

    // Navigate to the parent object
    for (const part of parts) {
      if (!(part in target)) {
        target[part] = {};
      }
      target = target[part];
    }

    // Set the value
    target[lastPart] = value;

    // Validate after setting
    this.validate();
  }

  /**
   * Delete a configuration value
   */
  delete(path) {
    if (!this.config) {
      this.load();
    }

    const parts = path.split('.');
    const lastPart = parts.pop();
    let target = this.config;

    // Navigate to the parent object
    for (const part of parts) {
      if (!(part in target)) {
        return false;
      }
      target = target[part];
    }

    if (lastPart in target) {
      delete target[lastPart];
      return true;
    }

    return false;
  }

  /**
   * Alias for delete method (used by config command)
   */
  unset(path) {
    return this.delete(path);
  }

  /**
   * Reset configuration to defaults
   */
  reset() {
    this.config = getDefaultConfig();
    this.save();
  }

  /**
   * Merge configuration with defaults
   */
  mergeWithDefaults(config) {
    const defaults = getDefaultConfig();
    return this.deepMerge(defaults, config);
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
   * Validate configuration against schema
   */
  validate() {
    const errors = [];
    this.validateObject(this.config, this.schema, '', errors);

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
      // Special handling for integer type
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
   * Get configuration with masked sensitive fields
   */
  getMasked() {
    if (!this.config) {
      this.load();
    }
    return this.maskSensitiveFields(this.config);
  }

  /**
   * Export configuration as JSON
   */
  toJSON() {
    return this.getMasked();
  }
}

// Singleton instance
let configManagerInstance = null;

/**
 * Get the configuration manager instance
 */
export function getConfigManager(configPath = null) {
  if (!configManagerInstance) {
    configManagerInstance = new ConfigManager(configPath);
  }
  return configManagerInstance;
}

/**
 * Reset the configuration manager instance
 */
export function resetConfigManager() {
  configManagerInstance = null;
}