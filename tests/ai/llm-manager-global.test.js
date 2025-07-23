import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { LLMManager } from '../../src/ai/llm-manager.js';
import { ConfigManager } from '../../src/config/config-manager.js';
import * as yaml from 'yaml';

describe('LLMManager with global/local config', () => {
  let tempDir;
  let localConfigPath;
  let globalConfigPath;
  let configManager;
  let llmManager;
  let originalHome;
  
  beforeEach(() => {
    // Save original HOME
    originalHome = process.env.HOME;
    
    // Create temp directory
    tempDir = mkdtempSync(join(tmpdir(), 'llm-manager-test-'));
    process.env.HOME = tempDir;
    
    // Setup paths
    localConfigPath = join(tempDir, 'project', '.taskwerk', 'config.yml');
    globalConfigPath = join(tempDir, '.config', 'taskwerk', 'config.yml');
    
    // Create directories
    mkdirSync(join(tempDir, 'project', '.taskwerk'), { recursive: true });
    mkdirSync(join(tempDir, '.config', 'taskwerk'), { recursive: true });
    
    // Create config manager with local path
    configManager = new ConfigManager(localConfigPath);
    
    // Create LLM manager
    llmManager = new LLMManager(configManager);
  });
  
  afterEach(() => {
    // Restore HOME
    process.env.HOME = originalHome;
    
    // Clean up
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
  
  describe('configureProvider with global flag', () => {
    it('should save provider config to local by default', () => {
      llmManager.configureProvider('openai', 'api_key', 'sk-local-key');
      
      const localConfig = yaml.parse(require('fs').readFileSync(localConfigPath, 'utf8'));
      expect(localConfig.ai.providers.openai.api_key).toBe('********');
      
      // Global should not have it
      expect(existsSync(globalConfigPath)).toBe(false);
    });
    
    it('should save provider config to global when specified', () => {
      llmManager.configureProvider('openai', 'api_key', 'sk-global-key', true);
      
      const globalConfig = yaml.parse(require('fs').readFileSync(globalConfigPath, 'utf8'));
      expect(globalConfig.ai.providers.openai.api_key).toBe('********');
      
      // Local should not have it
      if (existsSync(localConfigPath)) {
        const localConfig = yaml.parse(require('fs').readFileSync(localConfigPath, 'utf8'));
        expect(localConfig.ai?.providers?.openai?.api_key).toBeUndefined();
      }
    });
    
    it('should handle boolean conversion for enabled flag', () => {
      llmManager.configureProvider('openai', 'enabled', 'false', true);
      
      const config = configManager.get('ai.providers.openai.enabled');
      expect(config).toBe(false);
      expect(typeof config).toBe('boolean');
    });
    
    it('should log correct scope in messages', () => {
      const logSpy = vi.spyOn(llmManager.logger, 'info');
      
      llmManager.configureProvider('anthropic', 'api_key', 'sk-ant-key', true);
      
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('global config')
      );
      
      llmManager.configureProvider('openai', 'api_key', 'sk-key', false);
      
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('local config')
      );
    });
  });
  
  describe('setCurrentProvider with global flag', () => {
    it('should save current provider to local by default', () => {
      llmManager.setCurrentProvider('openai', 'gpt-4');
      
      const config = configManager.load();
      expect(config.ai.current_provider).toBe('openai');
      expect(config.ai.current_model).toBe('gpt-4');
      
      // Check it's in local
      const localConfig = yaml.parse(require('fs').readFileSync(localConfigPath, 'utf8'));
      expect(localConfig.ai.current_provider).toBe('openai');
    });
    
    it('should save current provider to global when specified', () => {
      llmManager.setCurrentProvider('anthropic', 'claude-3-opus-20240229', true);
      
      const globalConfig = yaml.parse(require('fs').readFileSync(globalConfigPath, 'utf8'));
      expect(globalConfig.ai.current_provider).toBe('anthropic');
      expect(globalConfig.ai.current_model).toBe('claude-3-opus-20240229');
    });
    
    it('should validate provider exists', () => {
      expect(() => {
        llmManager.setCurrentProvider('invalid-provider', 'model');
      }).toThrow('Unknown provider: invalid-provider');
    });
  });
  
  describe('Configuration inheritance', () => {
    beforeEach(() => {
      // Set up global config
      const globalConfig = {
        ai: {
          providers: {
            openai: { 
              api_key: 'global-openai-key' 
            },
            anthropic: { 
              api_key: 'global-anthropic-key' 
            }
          },
          current_provider: 'openai',
          current_model: 'gpt-3.5-turbo'
        }
      };
      
      writeFileSync(globalConfigPath, yaml.stringify(globalConfig));
      
      // Set up local config that overrides some values
      const localConfig = {
        ai: {
          providers: {
            openai: { 
              api_key: 'local-openai-key' 
            }
          },
          current_model: 'gpt-4'
        }
      };
      
      writeFileSync(localConfigPath, yaml.stringify(localConfig));
      
      // Reload config
      configManager.load();
    });
    
    it('should use local provider config over global', () => {
      const provider = llmManager.getProvider('openai');
      
      // Would check the config used to initialize provider
      const config = configManager.get('ai.providers.openai');
      expect(config.api_key).toBe('local-openai-key');
    });
    
    it('should use global provider config when not in local', () => {
      const provider = llmManager.getProvider('anthropic');
      
      const config = configManager.get('ai.providers.anthropic');
      expect(config.api_key).toBe('global-anthropic-key');
    });
    
    it('should use local current_model over global', () => {
      const model = llmManager.getCurrentModel();
      expect(model).toBe('gpt-4');
    });
    
    it('should use global current_provider when not in local', () => {
      const provider = llmManager.getCurrentProvider();
      expect(provider.name).toBe('openai');
    });
  });
  
  describe('listProviders with merged config', () => {
    beforeEach(() => {
      // Global: anthropic configured
      llmManager.configureProvider('anthropic', 'api_key', 'global-ant', true);
      
      // Local: openai configured
      llmManager.configureProvider('openai', 'api_key', 'local-oai', false);
      
      // Disable ollama locally
      llmManager.configureProvider('ollama', 'enabled', 'false', false);
    });
    
    it('should list all providers with correct status', () => {
      const providers = llmManager.listProviders();
      
      const anthropic = providers.find(p => p.name === 'anthropic');
      expect(anthropic.configured).toBe(true);
      expect(anthropic.enabled).toBe(true);
      
      const openai = providers.find(p => p.name === 'openai');
      expect(openai.configured).toBe(true);
      expect(openai.enabled).toBe(true);
      
      const ollama = providers.find(p => p.name === 'ollama');
      expect(ollama.enabled).toBe(false);
    });
  });
  
  describe('Environment variable precedence', () => {
    it('should use env vars over both global and local', () => {
      // Set in both global and local
      llmManager.configureProvider('openai', 'api_key', 'global-key', true);
      llmManager.configureProvider('openai', 'api_key', 'local-key', false);
      
      // Set env var
      process.env.TASKWERK_AI_PROVIDERS_OPENAI_API_KEY = 'env-key';
      
      // Reload config
      configManager.load();
      
      const config = configManager.get('ai.providers.openai.api_key');
      expect(config).toBe('env-key');
      
      // Clean up
      delete process.env.TASKWERK_AI_PROVIDERS_OPENAI_API_KEY;
    });
  });
  
  describe('getConfigSummary with global/local', () => {
    beforeEach(() => {
      // Configure providers in different scopes
      llmManager.configureProvider('anthropic', 'api_key', 'ant-key', true);
      llmManager.configureProvider('openai', 'api_key', 'oai-key', false);
      llmManager.setCurrentProvider('openai', 'gpt-4', false);
    });
    
    it('should show merged configuration summary', () => {
      const summary = llmManager.getConfigSummary();
      
      expect(summary.current_provider).toBe('openai');
      expect(summary.current_model).toBe('gpt-4');
      
      const providers = summary.providers;
      expect(providers).toContainEqual(
        expect.objectContaining({
          name: 'anthropic',
          configured: true
        })
      );
      expect(providers).toContainEqual(
        expect.objectContaining({
          name: 'openai',
          configured: true
        })
      );
    });
  });
  
  describe('Error handling', () => {
    it('should throw error for unknown provider', () => {
      expect(() => {
        llmManager.configureProvider('unknown', 'api_key', 'value');
      }).toThrow('Unknown provider: unknown');
    });
    
    it('should handle provider initialization errors gracefully', () => {
      // This would test error handling in getProvider
      const provider = llmManager.getProvider('openai');
      expect(provider).toBeDefined();
      expect(provider.isConfigured()).toBe(false);
    });
  });
});