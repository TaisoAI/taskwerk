import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { ConfigManager } from '../../src/config/config-manager.js';
import * as yaml from 'yaml';

describe('ConfigManager Backward Compatibility', () => {
  let tempDir;
  let configPath;
  let manager;
  let originalHome;
  
  beforeEach(() => {
    // Save original HOME
    originalHome = process.env.HOME;
    
    // Create temp directory
    tempDir = mkdtempSync(join(tmpdir(), 'taskwerk-compat-test-'));
    
    // Set test HOME to prevent global config from actual home
    process.env.HOME = tempDir;
    
    configPath = join(tempDir, '.taskwerk', 'config.yml');
    
    // Create config directory
    mkdirSync(join(tempDir, '.taskwerk'), { recursive: true });
    
    // Create manager instance
    manager = new ConfigManager(configPath);
  });
  
  afterEach(() => {
    // Restore HOME
    process.env.HOME = originalHome;
    
    // Clean up
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
  
  describe('Legacy API', () => {
    it('should expose configPath property', () => {
      expect(manager.configPath).toBe(configPath);
    });
    
    it('should expose config property after load', () => {
      expect(manager.config).toBeNull();
      
      manager.load();
      
      expect(manager.config).toBeDefined();
      expect(manager.config).toHaveProperty('ai');
    });
    
    it('should support load() method', () => {
      const config = manager.load();
      
      expect(config).toBeDefined();
      expect(config).toHaveProperty('ai');
      expect(manager.config).toBe(config);
    });
    
    it('should support save() method', () => {
      manager.load();
      manager.set('test.value', 'saved');
      manager.save();
      
      const saved = yaml.parse(require('fs').readFileSync(configPath, 'utf8'));
      expect(saved.test.value).toBe('saved');
    });
    
    it('should support get() without loading', () => {
      // Should auto-load
      const value = manager.get('ai.providers');
      expect(value).toBeDefined();
      expect(manager.config).toBeDefined();
    });
    
    it('should support set() without loading', () => {
      // Should auto-load
      manager.set('test.autoload', 'value');
      
      expect(manager.config).toBeDefined();
      expect(manager.config.test.autoload).toBe('value');
    });
    
    it('should support delete() method', () => {
      manager.set('test.delete', 'value');
      expect(manager.get('test.delete')).toBe('value');
      
      const result = manager.delete('test.delete');
      
      expect(result).toBe(true);
      expect(manager.get('test.delete')).toBeUndefined();
    });
    
    it('should support unset() alias', () => {
      manager.set('test.unset', 'value');
      expect(manager.get('test.unset')).toBe('value');
      
      const result = manager.unset('test.unset');
      
      expect(result).toBe(true);
      expect(manager.get('test.unset')).toBeUndefined();
    });
    
    it('should support reset() method', () => {
      manager.set('test.reset', 'value');
      manager.save();
      
      manager.reset();
      
      expect(manager.get('test.reset')).toBeUndefined();
      expect(manager.config).toBeDefined();
      
      // Check file was saved with empty config
      const saved = yaml.parse(require('fs').readFileSync(configPath, 'utf8'));
      expect(saved).toEqual({});
    });
    
    it('should support mergeWithDefaults() method', () => {
      const custom = { ai: { current_provider: 'openai' } };
      const merged = manager.mergeWithDefaults(custom);
      
      expect(merged.ai?.current_provider).toBe('openai');
      expect(merged.general).toBeDefined(); // From defaults
    });
    
    it('should support getMasked() method', () => {
      manager.set('ai.providers.openai.api_key', 'sk-secret');
      
      const masked = manager.getMasked();
      
      expect(masked.ai.providers.openai.api_key).toBe('********');
    });
    
    it('should support toJSON() method', () => {
      manager.set('ai.providers.openai.api_key', 'sk-secret');
      manager.set('test.value', 'public');
      
      const json = manager.toJSON();
      
      expect(json.ai.providers.openai.api_key).toBe('********');
      expect(json.test.value).toBe('public');
    });
  });
  
  describe('Local-only behavior', () => {
    it('should always save to local by default', () => {
      manager.set('test', 'value');
      manager.save();
      
      expect(existsSync(configPath)).toBe(true);
      // Global path might exist but shouldn't have our test value
      if (existsSync(manager.globalPath)) {
        const globalConfig = yaml.parse(readFileSync(manager.globalPath, 'utf8'));
        expect(globalConfig.test).toBeUndefined();
      }
    });
    
    it('should always set in local by default', () => {
      manager.set('test', 'value');
      
      expect(manager.localConfig.test).toBe('value');
      // Global config might exist but shouldn't have our test value
      if (manager.globalConfig) {
        expect(manager.globalConfig.test).toBeUndefined();
      }
    });
    
    it('should always delete from local by default', () => {
      manager.set('test', 'value');
      manager.delete('test');
      
      expect(manager.localConfig.test).toBeUndefined();
    });
  });
  
  describe('Singleton pattern', () => {
    it('should work with getConfigManager', async () => {
      const { getConfigManager, resetConfigManager } = await import('../../src/config/config-manager.js');
      
      const instance1 = getConfigManager();
      const instance2 = getConfigManager();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(ConfigManager);
      
      resetConfigManager();
    });
  });
  
  describe('Integration with existing code', () => {
    it('should work with typical usage pattern', () => {
      // Simulate typical usage
      const config = manager.load();
      
      // Set some AI config
      manager.set('ai.providers.openai.api_key', 'sk-test');
      manager.set('ai.current_provider', 'openai');
      manager.set('ai.current_model', 'gpt-4');
      
      // Save
      manager.save();
      
      // Reload
      const newManager = new ConfigManager(configPath);
      const reloaded = newManager.load();
      
      expect(reloaded.ai.providers.openai.api_key).toBe('sk-test');
      expect(reloaded.ai.current_provider).toBe('openai');
      expect(reloaded.ai.current_model).toBe('gpt-4');
    });
    
    it('should handle validation errors', () => {
      manager.load();
      
      // Try to set invalid value
      expect(() => {
        manager.set('ai.defaults.temperature', 'not-a-number');
      }).toThrow(/validation/i);
    });
    
    it('should maintain config reference after operations', () => {
      manager.load();
      const configRef = manager.config;
      
      manager.set('test', 'value');
      expect(manager.config).toBe(configRef);
      expect(manager.config.test).toBe('value');
      
      manager.delete('test');
      expect(manager.config).toBe(configRef);
      expect(manager.config.test).toBeUndefined();
    });
  });
});