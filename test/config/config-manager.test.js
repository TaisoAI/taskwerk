import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';
import {
  ConfigManager,
  getConfigManager,
  resetConfigManager,
} from '../../src/config/config-manager.js';
import { ConfigurationError } from '../../src/errors/index.js';

describe('ConfigManager', () => {
  let tempDir;
  let configPath;
  let manager;
  let originalHome;

  beforeEach(() => {
    // Save original HOME
    originalHome = process.env.HOME;

    tempDir = mkdtempSync(join(tmpdir(), 'taskwerk-config-test-'));

    // Set test HOME to prevent loading user's actual config
    process.env.HOME = tempDir;

    configPath = join(tempDir, 'config.yml');
    manager = new ConfigManager(configPath);
    resetConfigManager();
  });

  afterEach(() => {
    // Restore HOME
    process.env.HOME = originalHome;

    rmSync(tempDir, { recursive: true, force: true });
    resetConfigManager();
  });

  describe('constructor', () => {
    it('should create instance with custom config path', () => {
      expect(manager.configPath).toBe(configPath);
      expect(manager.config).toBe(null);
    });

    it('should create instance with default config path', () => {
      const defaultManager = new ConfigManager();
      expect(defaultManager.configPath).toContain('.taskwerk');
      expect(defaultManager.configPath).toContain('config.yml');
    });
  });

  describe('load', () => {
    it('should create default config if file does not exist', () => {
      const config = manager.load();

      expect(config).toBeDefined();
      expect(config.general.defaultPriority).toBe('medium');
      expect(config.database.backupEnabled).toBe(true);

      // Should NOT automatically save the default config
      expect(existsSync(configPath)).toBe(false);
    });

    it('should load existing YAML config', () => {
      const yamlConfig = `
general:
  defaultPriority: high
  defaultStatus: in-progress
database:
  backupEnabled: false
`;
      writeFileSync(configPath, yamlConfig);

      const config = manager.load();
      expect(config.general.defaultPriority).toBe('high');
      expect(config.general.defaultStatus).toBe('in-progress');
      expect(config.database.backupEnabled).toBe(false);
    });

    it('should load existing JSON config', () => {
      const jsonPath = join(tempDir, 'config.json');
      const jsonManager = new ConfigManager(jsonPath);

      const jsonConfig = {
        general: {
          defaultPriority: 'low',
        },
        output: {
          format: 'json',
        },
      };

      writeFileSync(jsonPath, JSON.stringify(jsonConfig));

      const config = jsonManager.load();
      expect(config.general.defaultPriority).toBe('low');
      expect(config.output.format).toBe('json');
    });

    it('should merge with defaults', () => {
      const partialConfig = `
general:
  defaultPriority: high
`;
      writeFileSync(configPath, partialConfig);

      const config = manager.load();
      expect(config.general.defaultPriority).toBe('high');
      expect(config.general.defaultStatus).toBe('todo'); // From defaults
      expect(config.database.backupEnabled).toBe(true); // From defaults
    });

    it('should throw error for invalid config', () => {
      const invalidConfig = `
general:
  defaultPriority: invalid-priority
`;
      writeFileSync(configPath, invalidConfig);

      expect(() => manager.load()).toThrow(ConfigurationError);
    });
  });

  describe('save', () => {
    it('should save configuration as YAML', () => {
      manager.load();
      manager.set('general.defaultPriority', 'high');

      manager.save();

      const content = readFileSync(configPath, 'utf8');
      expect(content).toContain('general:');
      expect(content).toContain('defaultPriority: high');
    });

    it('should obfuscate sensitive fields when saving', () => {
      manager.load();
      manager.set('ai.providers.openai.api_key', 'sk-secret-key');
      manager.set('ai.current_provider', 'openai');

      manager.save();

      const content = readFileSync(configPath, 'utf8');
      expect(content).toContain('api_key: "@obf:');
      expect(content).not.toContain('api_key: sk-secret-key');
      expect(content).toContain('current_provider: openai');

      // Verify we can load and retrieve the original value
      const newManager = new ConfigManager(configPath);
      newManager.load();
      expect(newManager.get('ai.providers.openai.api_key')).toBe('sk-secret-key');
    });

    it('should create directory if it does not exist', () => {
      const nestedPath = join(tempDir, 'nested', 'dir', 'config.yml');
      const nestedManager = new ConfigManager(nestedPath);

      nestedManager.load();
      nestedManager.set('general.defaultPriority', 'low');
      nestedManager.save();

      const content = readFileSync(nestedPath, 'utf8');
      expect(content).toContain('defaultPriority: low');
    });
  });

  describe('get', () => {
    beforeEach(() => {
      // Set up test config through proper channels
      manager.set('general.defaultPriority', 'high');
      manager.set('general.nested.value', 'test');
      manager.set('database.path', '/tmp/test.db');
    });

    it('should get top-level value', () => {
      const general = manager.get('general');
      expect(general.defaultPriority).toBe('high');
      expect(general.nested.value).toBe('test');
    });

    it('should get nested value', () => {
      expect(manager.get('general.defaultPriority')).toBe('high');
      expect(manager.get('general.nested.value')).toBe('test');
    });

    it('should return default value for missing path', () => {
      expect(manager.get('nonexistent', 'default')).toBe('default');
      expect(manager.get('general.missing', null)).toBe(null);
    });

    it('should load config if not loaded', () => {
      const newManager = new ConfigManager(configPath);
      expect(newManager.config).toBe(null);

      const value = newManager.get('general.defaultPriority');
      expect(value).toBe('medium'); // Default value
      expect(newManager.config).toBeDefined();
    });
  });

  describe('set', () => {
    beforeEach(() => {
      manager.config = {
        general: {
          defaultPriority: 'medium',
        },
      };
    });

    it('should set existing value', () => {
      manager.set('general.defaultPriority', 'high');
      expect(manager.config.general.defaultPriority).toBe('high');
    });

    it('should create nested structure', () => {
      manager.set('new.nested.value', 'test');
      expect(manager.config.new.nested.value).toBe('test');
    });

    it('should validate after setting', () => {
      expect(() => {
        manager.set('general.defaultPriority', 'invalid');
      }).toThrow(ConfigurationError);
    });
  });

  describe('delete', () => {
    beforeEach(() => {
      manager.set('general.defaultPriority', 'high');
      manager.set('general.toDelete', 'value');
    });

    it('should delete existing value', () => {
      const result = manager.delete('general.toDelete');
      expect(result).toBe(true);
      expect(manager.get('general.toDelete')).toBeUndefined();
    });

    it('should return false for non-existent path', () => {
      const result = manager.delete('nonexistent.path');
      expect(result).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset to default configuration', () => {
      // First, ensure we're starting fresh
      if (existsSync(configPath)) {
        rmSync(configPath);
      }

      // Create a new manager with the test config path
      const testManager = new ConfigManager(configPath);

      // Load defaults and set a custom value
      testManager.load();
      testManager.set('general.defaultPriority', 'low');
      expect(testManager.get('general.defaultPriority')).toBe('low');
      testManager.save();

      // Check what's in the file before reset
      const beforeReset = readFileSync(configPath, 'utf8');
      const configBefore = parseYaml(beforeReset);
      // The saved file might have the full config structure due to how save works
      // Just verify our value was saved
      expect(configBefore.general?.defaultPriority || configBefore.defaultPriority).toBe('low');

      // Reset should clear local config and reload defaults
      testManager.reset();

      // After reset, value should come from defaults (or global if exists)
      // In test environment with HOME set to tempDir, there's no global config
      const priorityAfterReset = testManager.get('general.defaultPriority');

      // After reset, the file should either be empty or contain only non-sensitive defaults
      const content = readFileSync(configPath, 'utf8');
      const config = content ? parseYaml(content) : {};

      // The important thing is that our custom value 'low' should not be in the file
      if (config.general?.defaultPriority) {
        expect(config.general.defaultPriority).not.toBe('low');
      }

      // Verify the local config was cleared - value should not be 'low' anymore
      expect(priorityAfterReset).not.toBe('low');
      // In a clean test environment, it should be the default 'medium'
      expect(priorityAfterReset).toBe('medium');
    });
  });

  describe('validate', () => {
    it('should validate correct configuration', () => {
      manager.load();
      manager.set('general.defaultPriority', 'high');
      manager.set('general.defaultStatus', 'todo');

      // Validation happens automatically on set, so if we get here it's valid
      expect(manager.get('general.defaultPriority')).toBe('high');
    });

    it('should throw for invalid enum value', () => {
      manager.load();

      expect(() => {
        manager.set('general.defaultPriority', 'invalid');
      }).toThrow(ConfigurationError);
    });

    it('should throw for invalid type', () => {
      manager.load();

      expect(() => {
        manager.set('database.backupEnabled', 'not-a-boolean');
      }).toThrow(ConfigurationError);
    });

    it('should throw for value out of range', () => {
      manager.load();

      expect(() => {
        manager.set('ai.temperature', 3.0); // Max is 2.0
      }).toThrow(ConfigurationError);
    });

    it('should throw for invalid pattern', () => {
      manager.load();

      expect(() => {
        manager.set('general.taskIdPrefix', 'task'); // Should be uppercase
      }).toThrow(ConfigurationError);
    });
  });

  describe('getMasked', () => {
    it('should mask sensitive fields', () => {
      manager.load();
      manager.set('ai.providers.openai.api_key', 'sk-secret-key');
      manager.set('ai.current_provider', 'openai');
      manager.set('ai.defaults.temperature', 0.7);

      const masked = manager.getMasked();
      expect(masked.ai.providers.openai.api_key).toBe('********');
      expect(masked.ai.current_provider).toBe('openai');
      expect(masked.ai.defaults.temperature).toBe(0.7);
    });
  });

  describe('singleton', () => {
    it('should return same instance from getConfigManager', () => {
      const instance1 = getConfigManager();
      const instance2 = getConfigManager();
      expect(instance1).toBe(instance2);
    });

    it('should reset singleton with resetConfigManager', () => {
      const instance1 = getConfigManager();
      resetConfigManager();
      const instance2 = getConfigManager();
      expect(instance1).not.toBe(instance2);
    });
  });
});
