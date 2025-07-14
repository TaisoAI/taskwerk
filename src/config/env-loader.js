/**
 * Environment variable loader for configuration
 */

const ENV_PREFIX = 'TASKWERK_';

/**
 * Load configuration from environment variables
 */
export function loadFromEnv() {
  const config = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith(ENV_PREFIX)) {
      const configPath = parseEnvKey(key);
      if (configPath) {
        setNestedProperty(config, configPath, parseEnvValue(value));
      }
    }
  }

  return config;
}

/**
 * Parse environment variable key to configuration path
 * TASKWERK_GENERAL_DEFAULT_PRIORITY -> general.defaultPriority
 */
function parseEnvKey(envKey) {
  const parts = envKey.substring(ENV_PREFIX.length).split('_').filter(Boolean);

  if (parts.length === 0) {
    return null;
  }

  // First part is the section (e.g., 'general', 'database')
  const section = parts[0].toLowerCase();

  // Remaining parts form the camelCase property name
  const propertyParts = parts.slice(1);

  if (propertyParts.length === 0) {
    return section;
  }

  // Convert property parts to camelCase
  const property = propertyParts
    .map((part, index) => {
      const lowerPart = part.toLowerCase();
      if (index === 0) {
        return lowerPart;
      }
      return lowerPart.charAt(0).toUpperCase() + lowerPart.slice(1);
    })
    .join('');

  return `${section}.${property}`;
}

/**
 * Parse environment variable value
 */
function parseEnvValue(value) {
  // Try to parse as JSON first
  try {
    return JSON.parse(value);
  } catch {
    // If not JSON, return as string
    return value;
  }
}

/**
 * Set nested property in object
 */
function setNestedProperty(obj, path, value) {
  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current)) {
      current[part] = {};
    }
    current = current[part];
  }

  current[parts[parts.length - 1]] = value;
}

/**
 * Get environment variable name for a config path
 */
export function getEnvName(configPath) {
  const parts = configPath.split('.');

  const envParts = parts.map(part => {
    // Convert camelCase to UPPER_SNAKE_CASE
    return part.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
  });

  return ENV_PREFIX + envParts.join('_');
}

/**
 * Export current configuration as environment variables
 */
export function exportToEnv(config, includeComments = true) {
  const lines = [];

  if (includeComments) {
    lines.push('# Taskwerk Configuration Environment Variables');
    lines.push('# Generated on ' + new Date().toISOString());
    lines.push('');
  }

  const flatConfig = flattenConfig(config);

  for (const [path, value] of Object.entries(flatConfig)) {
    const envName = getEnvName(path);
    let envValue;

    if (typeof value === 'string') {
      envValue = value;
    } else {
      // For non-string values, stringify and escape quotes for shell
      envValue = JSON.stringify(value).replace(/"/g, '\\"');
    }

    if (includeComments && getConfigDescription(path)) {
      lines.push(`# ${getConfigDescription(path)}`);
    }

    lines.push(`export ${envName}="${envValue}"`);

    if (includeComments) {
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Flatten nested configuration object
 */
function flattenConfig(obj, prefix = '') {
  const flat = {};

  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const depth = path.split('.').length;

    // Only flatten top-level sections (depth 1)
    // Keep everything else as-is
    if (value && typeof value === 'object' && !Array.isArray(value) && depth === 1) {
      // This is a section, flatten it one level
      for (const [subKey, subValue] of Object.entries(value)) {
        flat[`${path}.${subKey}`] = subValue;
      }
    } else {
      flat[path] = value;
    }
  }

  return flat;
}

/**
 * Get description for a config path from schema
 */
function getConfigDescription(_path) {
  // This would need to be integrated with the schema
  // For now, return null
  return null;
}

/**
 * Merge environment variables into configuration
 */
export function mergeEnvConfig(config) {
  const envConfig = loadFromEnv();
  return deepMerge(config, envConfig);
}

/**
 * Deep merge helper
 */
function deepMerge(target, source) {
  const output = { ...target };

  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          output[key] = source[key];
        } else {
          output[key] = deepMerge(target[key], source[key]);
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
function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}
