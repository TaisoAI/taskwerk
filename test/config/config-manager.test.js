import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ConfigManager, getConfigManager, resetConfigManager } from '../../src/config/config-manager.js';
import { ConfigurationError } from '../../src/errors/index.js';

describe('ConfigManager', () => {
  let tempDir;
  let configPath;
  let manager;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'taskwerk-config-test-'));
    configPath = join(tempDir, 'config.yml');
    manager = new ConfigManager(configPath);
    resetConfigManager();
  });

  afterEach(() => {
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
      manager.config = {
        general: {
          defaultPriority: 'high',
        },
      };
      
      manager.save();
      
      const content = readFileSync(configPath, 'utf8');
      expect(content).toContain('general:');
      expect(content).toContain('defaultPriority: high');
    });

    it('should mask sensitive fields when saving', () => {
      manager.config = {
        ai: {
          apiKey: 'sk-secret-key',
          provider: 'openai',
        },
      };
      
      manager.save();
      
      const content = readFileSync(configPath, 'utf8');
      expect(content).toContain('apiKey: "********"');
      expect(content).toContain('provider: openai');
    });

    it('should create directory if it does not exist', () => {
      const nestedPath = join(tempDir, 'nested', 'dir', 'config.yml');
      const nestedManager = new ConfigManager(nestedPath);
      
      nestedManager.config = { general: { defaultPriority: 'low' } };
      nestedManager.save();
      
      const content = readFileSync(nestedPath, 'utf8');
      expect(content).toContain('defaultPriority: low');
    });
  });

  describe('get', () => {
    beforeEach(() => {
      manager.config = {
        general: {
          defaultPriority: 'high',
          nested: {
            value: 'test',
          },
        },
        database: {
          path: '/tmp/test.db',
        },
      };
    });

    it('should get top-level value', () => {
      expect(manager.get('general')).toEqual({
        defaultPriority: 'high',
        nested: { value: 'test' },
      });
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
      manager.config = {
        general: {
          defaultPriority: 'high',
          toDelete: 'value',
        },
      };
    });

    it('should delete existing value', () => {
      const result = manager.delete('general.toDelete');
      expect(result).toBe(true);
      expect(manager.config.general.toDelete).toBeUndefined();
    });

    it('should return false for non-existent path', () => {
      const result = manager.delete('nonexistent.path');
      expect(result).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset to default configuration', () => {
      manager.config = {
        general: {
          defaultPriority: 'high',
        },
      };
      
      manager.reset();
      
      expect(manager.config.general.defaultPriority).toBe('medium');
      
      // Should save the reset config
      const content = readFileSync(configPath, 'utf8');
      expect(content).toContain('defaultPriority: medium');
    });
  });

  describe('validate', () => {
    it('should validate correct configuration', () => {
      manager.config = {
        general: {
          defaultPriority: 'high',
          defaultStatus: 'todo',
        },
      };
      
      expect(() => manager.validate()).not.toThrow();
    });

    it('should throw for invalid enum value', () => {
      manager.config = {
        general: {
          defaultPriority: 'invalid',
        },
      };
      
      expect(() => manager.validate()).toThrow(ConfigurationError);
    });

    it('should throw for invalid type', () => {
      manager.config = {
        database: {
          backupEnabled: 'not-a-boolean',
        },
      };
      
      expect(() => manager.validate()).toThrow(ConfigurationError);
    });

    it('should throw for value out of range', () => {
      manager.config = {
        ai: {
          temperature: 3.0, // Max is 2.0
        },
      };
      
      expect(() => manager.validate()).toThrow(ConfigurationError);
    });

    it('should throw for invalid pattern', () => {
      manager.config = {
        general: {
          taskIdPrefix: 'task', // Should be uppercase
        },
      };
      
      expect(() => manager.validate()).toThrow(ConfigurationError);
    });
  });

  describe('getMasked', () => {
    it('should mask sensitive fields', () => {
      manager.config = {
        ai: {
          apiKey: 'sk-secret-key',
          provider: 'openai',
          temperature: 0.7,
        },
      };
      
      const masked = manager.getMasked();
      expect(masked.ai.apiKey).toBe('********');
      expect(masked.ai.provider).toBe('openai');
      expect(masked.ai.temperature).toBe(0.7);
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