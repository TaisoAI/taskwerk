/**
 * Wrapper to maintain backward compatibility while transitioning to GlobalConfigManager
 */
import { GlobalConfigManager } from './global-config-manager.js';

/**
 * Legacy ConfigManager that wraps GlobalConfigManager
 * This maintains the existing API while using the new global/local functionality
 */
export class ConfigManager extends GlobalConfigManager {
  constructor(configPath = null) {
    super(configPath);
    // For backward compatibility
    this.config = null;
    // Expose configPath for backward compatibility
    this.configPath = this.localPath;
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
  save() {
    // For backward compatibility, just save the local config as-is
    // Do not update localConfig with merged config
    super.save(false);
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
    super.set(path, value, false);
    this.config = this.mergedConfig;
  }

  /**
   * Delete a configuration value (backward compatibility)
   */
  delete(path) {
    const result = super.delete(path, false);
    this.config = this.mergedConfig;
    return result;
  }

  /**
   * Alias for delete method (backward compatibility)
   */
  unset(path) {
    return this.delete(path);
  }

  /**
   * Reset configuration to defaults (backward compatibility)
   */
  reset() {
    // Clear local config
    this.localConfig = {};
    // Save empty local config - use parent save to avoid wrapper behavior
    super.save(false);
    // Reload to get fresh config (defaults merged with any global)
    this.load();
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
