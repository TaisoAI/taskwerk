import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LLMManager } from '../../src/ai/llm-manager.js';
import { ConfigManager } from '../../src/config/config-manager.js';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

describe('LLMManager', () => {
  let llmManager;
  let tempDir;
  let originalHome;
  let configManager;

  beforeEach(async () => {
    // Create temp directory for test config
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'taskwerk-test-'));
    originalHome = process.env.HOME;
    process.env.HOME = tempDir;

    // Create fresh ConfigManager and LLMManager instances
    configManager = new ConfigManager();
    llmManager = new LLMManager(configManager);
  });

  afterEach(async () => {
    // Restore HOME
    process.env.HOME = originalHome;
    
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Provider Management', () => {
    it('should list available providers', () => {
      const providers = llmManager.listProviders();
      
      expect(providers).toContainEqual({
        name: 'anthropic',
        configured: false,
        enabled: true
      });
      
      expect(providers).toContainEqual({
        name: 'openai',
        configured: false,
        enabled: true
      });
      
      expect(providers).toContainEqual({
        name: 'ollama',
        configured: true, // Ollama doesn't require API key
        enabled: true
      });
    });

    it('should get provider instance', () => {
      const provider = llmManager.getProvider('anthropic');
      expect(provider.name).toBe('anthropic');
      expect(provider.isConfigured()).toBe(false);
    });

    it('should throw error for unknown provider', () => {
      expect(() => llmManager.getProvider('unknown')).toThrow('Unknown provider: unknown');
    });
  });

  describe('Configuration', () => {
    it('should configure provider API key', () => {
      llmManager.configureProvider('anthropic', 'api_key', 'sk-ant-test');
      
      const provider = llmManager.getProvider('anthropic');
      expect(provider.isConfigured()).toBe(true);
      expect(provider.config.api_key).toBe('sk-ant-test');
    });

    it('should set current provider and model', () => {
      llmManager.setCurrentProvider('anthropic', 'claude-3-opus-20240229');
      
      expect(llmManager.getCurrentProvider().name).toBe('anthropic');
      expect(llmManager.getCurrentModel()).toBe('claude-3-opus-20240229');
    });

    it('should throw error when no provider configured', () => {
      expect(() => llmManager.getCurrentProvider()).toThrow('No AI provider configured. Run "taskwerk aiconfig --choose" to select one.');
    });

    it('should mask sensitive data in config', () => {
      llmManager.configureProvider('openai', 'api_key', 'sk-1234567890abcdef');
      
      const config = llmManager.getProviderConfig('openai');
      expect(config.api_key).toBe('sk-12345...cdef');
    });
  });

  describe('Model Discovery', () => {
    it('should return models only for configured providers', async () => {
      // Configure only OpenAI
      llmManager.configureProvider('openai', 'api_key', 'sk-test-key');
      
      const models = await llmManager.discoverModels();
      
      // Anthropic should have no models (not configured)
      expect(models.has('anthropic')).toBe(false);
      
      // OpenAI should have models (configured)
      expect(models.has('openai')).toBe(true);
      expect(models.get('openai').length).toBeGreaterThan(0);
      
      // Ollama might have models if running locally
      const ollamaModels = models.get('ollama');
      expect(ollamaModels).toBeDefined();
      expect(Array.isArray(ollamaModels)).toBe(true);
    });
  });

  describe('Configuration Summary', () => {
    it('should return complete configuration summary', () => {
      llmManager.configureProvider('anthropic', 'api_key', 'sk-ant-test');
      llmManager.setCurrentProvider('anthropic', 'claude-3-opus-20240229');
      
      const summary = llmManager.getConfigSummary();
      
      expect(summary.current_provider).toBe('anthropic');
      expect(summary.current_model).toBe('claude-3-opus-20240229');
      expect(summary.providers).toHaveLength(3);
      
      const anthropicProvider = summary.providers.find(p => p.name === 'anthropic');
      expect(anthropicProvider.configured).toBe(true);
      expect(anthropicProvider.config.api_key).toContain('...');
    });
  });
});