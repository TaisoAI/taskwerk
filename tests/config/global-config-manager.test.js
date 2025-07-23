import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir, homedir } from 'os';
import { GlobalConfigManager, ConfigSource, getGlobalConfigPath } from '../../src/config/global-config-manager.js';
import * as yaml from 'yaml';

describe('GlobalConfigManager', () => {
  let tempDir;
  let localConfigPath;
  let globalConfigPath;
  let originalHome;
  let originalXdgConfig;
  
  beforeEach(() => {
    // Create temp directory
    tempDir = mkdtempSync(join(tmpdir(), 'taskwerk-test-'));
    
    // Save original env vars
    originalHome = process.env.HOME;
    originalXdgConfig = process.env.XDG_CONFIG_HOME;
    
    // Set test HOME
    process.env.HOME = tempDir;
    delete process.env.XDG_CONFIG_HOME;
    
    // Setup paths
    localConfigPath = join(tempDir, '.taskwerk', 'config.yml');
    globalConfigPath = join(tempDir, '.config', 'taskwerk', 'config.yml');
    
    // Create directories
    mkdirSync(join(tempDir, '.taskwerk'), { recursive: true });
    mkdirSync(join(tempDir, '.config', 'taskwerk'), { recursive: true });
  });
  
  afterEach(() => {
    // Restore env vars
    process.env.HOME = originalHome;
    if (originalXdgConfig) {
      process.env.XDG_CONFIG_HOME = originalXdgConfig;
    }
    
    // Clean up
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
  
  describe('getGlobalConfigPath', () => {
    it('should use XDG_CONFIG_HOME when set', () => {
      const xdgPath = join(tempDir, 'xdg-config');
      process.env.XDG_CONFIG_HOME = xdgPath;
      
      const path = getGlobalConfigPath();
      expect(path).toBe(join(xdgPath, 'taskwerk', 'config.yml'));
    });
    
    it('should default to ~/.config/taskwerk/config.yml', () => {
      delete process.env.XDG_CONFIG_HOME;
      
      const path = getGlobalConfigPath();
      expect(path).toBe(join(tempDir, '.config', 'taskwerk', 'config.yml'));
    });
    
    it('should use legacy path if it exists and new path does not', () => {
      delete process.env.XDG_CONFIG_HOME;
      const legacyPath = join(tempDir, '.taskwerk', 'config.yml');
      writeFileSync(legacyPath, 'test: legacy');
      
      const path = getGlobalConfigPath();
      expect(path).toBe(legacyPath);
    });
    
    it('should prefer JSON files if they exist', () => {
      delete process.env.XDG_CONFIG_HOME;
      const jsonPath = join(tempDir, '.config', 'taskwerk', 'config.json');
      writeFileSync(jsonPath, '{"test": "json"}');
      
      const path = getGlobalConfigPath();
      expect(path).toBe(jsonPath);
    });
  });
  
  describe('Configuration Loading', () => {
    let manager;
    
    beforeEach(() => {
      manager = new GlobalConfigManager(localConfigPath);
    });
    
    it('should load default config when no files exist', () => {
      const config = manager.load();
      
      expect(config).toHaveProperty('ai');
      expect(config.ai).toHaveProperty('providers');
      expect(manager.configSources.get('ai.providers')).toBe(ConfigSource.DEFAULT);
    });
    
    it('should load and merge global config', () => {
      const globalConfig = {
        ai: {
          providers: {
            openai: {
              api_key: 'global-key'
            }
          }
        }
      };
      
      writeFileSync(globalConfigPath, yaml.stringify(globalConfig));
      
      const config = manager.load();
      
      expect(config.ai.providers.openai.api_key).toBe('global-key');
      expect(manager.getSource('ai.providers.openai.api_key')).toBe(ConfigSource.GLOBAL);
    });
    
    it('should prioritize local config over global', () => {
      const globalConfig = {
        ai: {
          providers: {
            openai: { api_key: 'global-key' }
          },
          current_model: 'gpt-3.5'
        }
      };
      
      const localConfig = {
        ai: {
          providers: {
            openai: { api_key: 'local-key' }
          }
        }
      };
      
      writeFileSync(globalConfigPath, yaml.stringify(globalConfig));
      writeFileSync(localConfigPath, yaml.stringify(localConfig));
      
      const config = manager.load();
      
      expect(config.ai.providers.openai.api_key).toBe('local-key');
      expect(config.ai.current_model).toBe('gpt-3.5'); // From global
      expect(manager.getSource('ai.providers.openai.api_key')).toBe(ConfigSource.LOCAL);
      expect(manager.getSource('ai.current_model')).toBe(ConfigSource.GLOBAL);
    });
    
    it('should prioritize environment variables over all', () => {
      process.env.TASKWERK_AI_PROVIDERS_OPENAI_API_KEY = 'env-key';
      
      const localConfig = {
        ai: {
          providers: {
            openai: { api_key: 'local-key' }
          }
        }
      };
      
      writeFileSync(localConfigPath, yaml.stringify(localConfig));
      
      const config = manager.load();
      
      expect(config.ai.providers.openai.api_key).toBe('env-key');
      expect(manager.getSource('ai.providers.openai.api_key')).toBe(ConfigSource.ENV);
      
      delete process.env.TASKWERK_AI_PROVIDERS_OPENAI_API_KEY;
    });
    
    it('should load JSON config files', () => {
      const jsonPath = localConfigPath.replace('.yml', '.json');
      const config = { ai: { current_provider: 'openai' } };
      
      writeFileSync(jsonPath, JSON.stringify(config, null, 2));
      
      const loadedManager = new GlobalConfigManager(jsonPath);
      const loaded = loadedManager.load();
      
      expect(loaded.ai.current_provider).toBe('openai');
    });
  });
  
  describe('Configuration Setting', () => {
    let manager;
    
    beforeEach(() => {
      manager = new GlobalConfigManager(localConfigPath);
      manager.load();
    });
    
    it('should set values in local config by default', () => {
      manager.set('ai.current_provider', 'anthropic');
      
      expect(manager.localConfig.ai.current_provider).toBe('anthropic');
      expect(manager.get('ai.current_provider')).toBe('anthropic');
      expect(manager.getSource('ai.current_provider')).toBe(ConfigSource.LOCAL);
    });
    
    it('should set values in global config when specified', () => {
      manager.set('ai.providers.openai.api_key', 'test-key', true);
      
      expect(manager.globalConfig.ai.providers.openai.api_key).toBe('test-key');
      expect(manager.get('ai.providers.openai.api_key')).toBe('test-key');
      expect(manager.getSource('ai.providers.openai.api_key')).toBe(ConfigSource.GLOBAL);
    });
    
    it('should create nested paths when setting', () => {
      manager.set('new.nested.path', 'value');
      
      expect(manager.localConfig.new.nested.path).toBe('value');
      expect(manager.get('new.nested.path')).toBe('value');
    });
    
    it('should validate after setting', () => {
      // This should throw validation error for invalid enum value
      expect(() => {
        manager.set('ai.defaults.temperature', 'invalid');
      }).toThrow();
    });
  });
  
  describe('Configuration Deletion', () => {
    let manager;
    
    beforeEach(() => {
      manager = new GlobalConfigManager(localConfigPath);
      manager.load();
    });
    
    it('should delete from local config by default', () => {
      manager.set('test.value', 'local');
      expect(manager.get('test.value')).toBe('local');
      
      const result = manager.delete('test.value');
      
      expect(result).toBe(true);
      expect(manager.get('test.value')).toBeUndefined();
    });
    
    it('should delete from global config when specified', () => {
      manager.set('test.value', 'global', true);
      expect(manager.get('test.value')).toBe('global');
      
      const result = manager.delete('test.value', true);
      
      expect(result).toBe(true);
      expect(manager.get('test.value')).toBeUndefined();
    });
    
    it('should return false when deleting non-existent path', () => {
      const result = manager.delete('non.existent.path');
      expect(result).toBe(false);
    });
  });
  
  describe('Configuration Saving', () => {
    let manager;
    
    beforeEach(() => {
      manager = new GlobalConfigManager(localConfigPath);
      manager.load();
    });
    
    it('should save local config', () => {
      manager.set('test.local', 'value');
      manager.save(false);
      
      const saved = yaml.parse(readFileSync(localConfigPath, 'utf8'));
      expect(saved.test.local).toBe('value');
    });
    
    it('should save global config', () => {
      manager.set('test.global', 'value', true);
      manager.save(true);
      
      const saved = yaml.parse(readFileSync(globalConfigPath, 'utf8'));
      expect(saved.test.global).toBe('value');
    });
    
    it('should mask sensitive fields when saving', () => {
      manager.set('ai.providers.openai.api_key', 'sk-secret-key');
      manager.save(false);
      
      const saved = yaml.parse(readFileSync(localConfigPath, 'utf8'));
      expect(saved.ai.providers.openai.api_key).toBe('********');
    });
    
    it('should create directories if they do not exist', () => {
      const newPath = join(tempDir, 'new', 'path', 'config.yml');
      const newManager = new GlobalConfigManager(newPath);
      
      newManager.load();
      newManager.set('test', 'value');
      newManager.save(false);
      
      expect(existsSync(newPath)).toBe(true);
    });
  });
  
  describe('Configuration Sources', () => {
    let manager;
    
    beforeEach(() => {
      manager = new GlobalConfigManager(localConfigPath);
    });
    
    it('should track configuration sources correctly', () => {
      const globalConfig = { ai: { current_provider: 'openai' } };
      const localConfig = { ai: { current_model: 'gpt-4' } };
      
      writeFileSync(globalConfigPath, yaml.stringify(globalConfig));
      writeFileSync(localConfigPath, yaml.stringify(localConfig));
      
      manager.load();
      
      expect(manager.getSource('ai.current_provider')).toBe(ConfigSource.GLOBAL);
      expect(manager.getSource('ai.current_model')).toBe(ConfigSource.LOCAL);
    });
    
    it('should return config with sources', () => {
      manager.set('test.local', 'local-value');
      manager.set('test.global', 'global-value', true);
      
      const withSources = manager.getWithSources();
      
      expect(withSources.test.local).toEqual({
        value: 'local-value',
        source: ConfigSource.LOCAL
      });
      
      expect(withSources.test.global).toEqual({
        value: 'global-value',
        source: ConfigSource.GLOBAL
      });
    });
  });
  
  describe('Migration Operations', () => {
    let manager;
    
    beforeEach(() => {
      manager = new GlobalConfigManager(localConfigPath);
      manager.load();
    });
    
    it('should migrate local config to global', async () => {
      manager.set('ai.providers.openai.api_key', 'local-key');
      manager.set('ai.current_provider', 'openai');
      
      await manager.migrateToGlobal();
      
      // Check global config has the values
      const globalSaved = yaml.parse(readFileSync(globalConfigPath, 'utf8'));
      expect(globalSaved.ai.providers.openai.api_key).toBe('********'); // Masked
      expect(globalSaved.ai.current_provider).toBe('openai');
      
      // Check local config is empty
      const localSaved = yaml.parse(readFileSync(localConfigPath, 'utf8'));
      expect(localSaved).toEqual({});
    });
    
    it('should merge with existing global config during migration', async () => {
      // Set up existing global config
      manager.set('ai.providers.anthropic.api_key', 'global-anthropic', true);
      manager.save(true);
      
      // Set up local config
      manager.set('ai.providers.openai.api_key', 'local-openai');
      manager.set('ai.providers.anthropic.api_key', 'local-anthropic'); // Override
      
      await manager.migrateToGlobal();
      
      // Reload to check merged result
      manager.load();
      expect(manager.get('ai.providers.anthropic.api_key')).toBe('local-anthropic');
      expect(manager.get('ai.providers.openai.api_key')).toBe('local-openai');
    });
    
    it('should copy global config to local', async () => {
      manager.set('ai.providers.openai.api_key', 'global-key', true);
      manager.set('ai.current_provider', 'openai', true);
      manager.save(true);
      
      await manager.copyFromGlobal();
      
      // Check local config has the values
      const localSaved = yaml.parse(readFileSync(localConfigPath, 'utf8'));
      expect(localSaved.ai.providers.openai.api_key).toBe('********'); // Masked
      expect(localSaved.ai.current_provider).toBe('openai');
    });
    
    it('should throw error when no config to migrate', async () => {
      const emptyManager = new GlobalConfigManager(localConfigPath);
      emptyManager.load();
      
      await expect(emptyManager.migrateToGlobal()).rejects.toThrow('No local configuration to migrate');
    });
  });
  
  describe('Clear Operations', () => {
    let manager;
    
    beforeEach(() => {
      manager = new GlobalConfigManager(localConfigPath);
      manager.load();
    });
    
    it('should clear local config', () => {
      manager.set('test', 'value');
      manager.save(false);
      
      manager.clear(false);
      
      const saved = yaml.parse(readFileSync(localConfigPath, 'utf8'));
      expect(saved).toEqual({});
      expect(manager.get('test')).toBeUndefined();
    });
    
    it('should clear global config', () => {
      manager.set('test', 'value', true);
      manager.save(true);
      
      manager.clear(true);
      
      const saved = yaml.parse(readFileSync(globalConfigPath, 'utf8'));
      expect(saved).toEqual({});
      expect(manager.get('test')).toBeUndefined();
    });
  });
  
  describe('Security Checks', () => {
    let manager;
    
    beforeEach(() => {
      manager = new GlobalConfigManager(localConfigPath);
    });
    
    it('should check for sensitive data', () => {
      const config = {
        ai: {
          providers: {
            openai: { api_key: 'sk-test' }
          }
        }
      };
      
      expect(manager.hasSensitiveData(config)).toBe(true);
      
      const configNoSensitive = {
        ai: {
          current_provider: 'openai'
        }
      };
      
      expect(manager.hasSensitiveData(configNoSensitive)).toBe(false);
    });
    
    it('should mask sensitive fields', () => {
      const config = {
        ai: {
          providers: {
            openai: { api_key: 'sk-test-key' },
            anthropic: { api_key: 'sk-ant-key' }
          }
        }
      };
      
      const masked = manager.maskSensitiveFields(config);
      
      expect(masked.ai.providers.openai.api_key).toBe('********');
      expect(masked.ai.providers.anthropic.api_key).toBe('********');
    });
  });
  
  describe('Singleton Pattern', () => {
    it('should support singleton pattern', async () => {
      const { getGlobalConfigManager, resetGlobalConfigManager } = await import('../../src/config/global-config-manager.js');
      
      const instance1 = getGlobalConfigManager();
      const instance2 = getGlobalConfigManager();
      
      expect(instance1).toBe(instance2);
      
      resetGlobalConfigManager();
      const instance3 = getGlobalConfigManager();
      
      expect(instance3).not.toBe(instance1);
    });
  });
});

