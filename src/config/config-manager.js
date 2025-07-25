/**
 * Configuration manager for Taskwerk
 * This now uses GlobalConfigManager internally to support global/local configs
 */
import { GlobalConfigManager, getGlobalConfigPath, ConfigSource } from './global-config-manager.js';

// Re-export for backward compatibility
export { getGlobalConfigPath, ConfigSource };

/**
 * ConfigManager that maintains backward compatibility while using GlobalConfigManager
 */
export class ConfigManager extends GlobalConfigManager {
  constructor(configPath = null) {
    super(configPath);
    // For backward compatibility
    this.configPath = this.localPath;
    this.config = null;
  }

  /**
   * Load configuration from file (backward compatibility)
   */
  load() {
    this.config = super.load();
    return this.config;
  }

  /**
   * Save configuration to file (backward compatibility)
   * Always saves to local by default
   */
  save(global = false) {
    // For backward compatibility, just save the local config as-is
    super.save(global);
  }

  /**
   * Get a configuration value (backward compatibility)
   */
  get(path, defaultValue = undefined) {
    if (!this.config) {
      this.load();
    }
    return super.get(path, defaultValue);
  }

  /**
   * Set a configuration value (backward compatibility)
   * Always sets in local config
   */
  set(path, value) {
    if (!this.config) {
      this.load();
    }
    super.set(path, value, false);
    this.config = this.mergedConfig;
  }

  /**
   * Delete a configuration value (backward compatibility)
   */
  delete(path) {
    if (!this.config) {
      this.load();
    }
    const result = super.delete(path, false);
    this.config = this.mergedConfig;
    return result;
  }

  /**
   * Alias for delete method (used by config command)
   */
  unset(path) {
    return this.delete(path);
  }

  /**
   * Reset configuration to defaults (backward compatibility)
   */
  reset() {
    this.localConfig = {};
    this.save();
    this.load(); // Reload to get defaults
  }

  /**
   * Merge configuration with defaults (backward compatibility)
   */
  mergeWithDefaults(config) {
    return this.deepMerge(this.defaultConfig, config);
  }

  /**
   * Get configuration with masked sensitive fields (backward compatibility)
   */
  getMasked() {
    if (!this.config) {
      this.load();
    }
    return super.getMasked();
  }

  /**
   * Export configuration as JSON (backward compatibility)
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
