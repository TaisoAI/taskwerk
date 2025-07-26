import { AnthropicProvider } from './providers/anthropic.js';
import { OpenAIProvider } from './providers/openai.js';
import { OllamaProvider } from './providers/ollama.js';
import { LMStudioProvider } from './providers/lmstudio.js';
import { GrokProvider } from './providers/grok.js';
import { MistralProvider } from './providers/mistral.js';
import { ConfigManager } from '../config/config-manager.js';
import { Logger } from '../logging/logger.js';

export class LLMManager {
  constructor(configManager = null) {
    this.logger = new Logger('llm-manager');
    this.providers = new Map();
    this.configManager = configManager || new ConfigManager();
    this.initializeProviders();
  }

  initializeProviders() {
    // Register available providers
    this.registerProvider('anthropic', AnthropicProvider);
    this.registerProvider('openai', OpenAIProvider);
    this.registerProvider('grok', GrokProvider);
    this.registerProvider('mistral', MistralProvider);
    this.registerProvider('ollama', OllamaProvider);
    this.registerProvider('lmstudio', LMStudioProvider);
    // More providers can be added here
  }

  registerProvider(name, ProviderClass) {
    this.providers.set(name, ProviderClass);
  }

  /**
   * Get a provider instance
   * @param {string} name - Provider name
   * @returns {BaseProvider}
   */
  getProvider(name) {
    const ProviderClass = this.providers.get(name);
    if (!ProviderClass) {
      throw new Error(`Unknown provider: ${name}`);
    }

    const config = this.configManager.get(`ai.providers.${name}`, {});
    return new ProviderClass(config);
  }

  /**
   * Get the current default provider
   * @returns {BaseProvider}
   */
  getCurrentProvider() {
    const currentProviderName = this.configManager.get('ai.current_provider');
    if (!currentProviderName) {
      throw new Error('No AI provider configured. Run "taskwerk aiconfig --choose" to select one.');
    }

    return this.getProvider(currentProviderName);
  }

  /**
   * Get the current default model
   * @returns {string}
   */
  getCurrentModel() {
    const model = this.configManager.get('ai.current_model');
    if (!model) {
      throw new Error('No model selected. Run "taskwerk aiconfig --choose" to select one.');
    }
    return model;
  }

  /**
   * List all available providers
   * @returns {Array<{name: string, configured: boolean}>}
   */
  listProviders() {
    const results = [];

    for (const [name, ProviderClass] of this.providers) {
      const config = this.configManager.get(`ai.providers.${name}`, {});
      const provider = new ProviderClass(config);
      results.push({
        name,
        configured: provider.isConfigured(),
        enabled: config.enabled !== false,
      });
    }

    return results;
  }

  /**
   * Test all configured providers
   * @returns {Promise<Array<{name: string, success: boolean, message: string}>>}
   */
  async testAllProviders() {
    const results = [];

    for (const [name, ProviderClass] of this.providers) {
      const config = this.configManager.get(`ai.providers.${name}`, {});
      if (config.enabled === false) {
        continue;
      }

      const provider = new ProviderClass(config);
      if (!provider.isConfigured()) {
        results.push({
          name,
          success: false,
          message: 'Not configured',
        });
        continue;
      }

      this.logger.info(`Testing ${name} provider...`);
      const result = await provider.testConnection();
      results.push({ name, ...result });
    }

    return results;
  }

  /**
   * Discover all available models from all configured providers
   * @returns {Promise<Map<string, Array>>}
   */
  async discoverModels() {
    const modelsByProvider = new Map();

    for (const [name, ProviderClass] of this.providers) {
      const config = this.configManager.get(`ai.providers.${name}`, {});
      if (config.enabled === false) {
        continue;
      }

      const provider = new ProviderClass(config);
      if (!provider.isConfigured()) {
        continue;
      }

      try {
        this.logger.info(`Discovering models from ${name}...`);
        const models = await provider.listModels();
        modelsByProvider.set(name, models);
      } catch (error) {
        this.logger.error(`Failed to list models from ${name}:`, error);
        modelsByProvider.set(name, []);
      }
    }

    return modelsByProvider;
  }

  /**
   * Complete a prompt using the current or specified provider
   * @param {Object} params
   * @returns {Promise<{content: string, usage?: Object}>}
   */
  async complete(params) {
    const { provider: providerName, model, verbose, ...completionParams } = params;

    // Get provider (use current if not specified)
    const provider = providerName ? this.getProvider(providerName) : this.getCurrentProvider();

    // Get model (use current if not specified)
    const modelToUse = model || this.getCurrentModel();

    // Log the request only in verbose mode
    if (verbose) {
      this.logger.info(`Completing with ${provider.name} using model ${modelToUse}`);
    }

    try {
      const result = await provider.complete({
        model: modelToUse,
        ...completionParams,
      });

      // Log usage if available and in verbose mode
      if (verbose && result.usage) {
        this.logger.info(
          `Token usage - Prompt: ${result.usage.prompt_tokens}, Completion: ${result.usage.completion_tokens}`
        );
      }

      return result;
    } catch (error) {
      // Only log errors in verbose mode or for non-configuration errors
      const isConfigError =
        error.message?.includes('api_key') ||
        error.message?.includes('API key') ||
        error.message?.includes('x-api-key') ||
        error.message?.includes('No AI provider') ||
        error.message?.includes('No model');

      if (verbose || !isConfigError) {
        this.logger.error(`Completion failed:`, error);
      }
      throw new Error(provider.parseError(error));
    }
  }

  /**
   * Set the current provider and model
   * @param {string} providerName
   * @param {string} modelId
   * @param {boolean} global - Save to global config instead of local
   */
  setCurrentProvider(providerName, modelId, global = false) {
    if (!this.providers.has(providerName)) {
      throw new Error(`Unknown provider: ${providerName}`);
    }

    this.configManager.set('ai.current_provider', providerName, global);
    this.configManager.set('ai.current_model', modelId, global);
    this.configManager.save(global);

    const scope = global ? 'global' : 'local';
    this.logger.info(
      `Set current provider to ${providerName} with model ${modelId} in ${scope} config`
    );
  }

  /**
   * Configure a provider
   * @param {string} providerName
   * @param {string} key
   * @param {string} value
   * @param {boolean} global - Save to global config instead of local
   */
  configureProvider(providerName, key, value, global = false) {
    if (!this.providers.has(providerName)) {
      throw new Error(`Unknown provider: ${providerName}`);
    }

    const configPath = `ai.providers.${providerName}.${key}`;

    // Handle special case for enabling/disabling
    if (key === 'enabled') {
      value = value === 'true' || value === true;
    }

    this.configManager.set(configPath, value, global);
    this.configManager.save(global);

    const scope = global ? 'global' : 'local';
    this.logger.info(
      `Set ${providerName}.${key} = ${key.includes('key') ? '***' : value} in ${scope} config`
    );
  }

  /**
   * Get provider configuration (with sensitive data masked)
   * @param {string} providerName
   * @returns {Object}
   */
  getProviderConfig(providerName) {
    const config = this.configManager.get(`ai.providers.${providerName}`, {});
    const provider = this.getProvider(providerName);
    const requiredConfig = provider.getRequiredConfig();

    // Mask sensitive fields
    const maskedConfig = { ...config };
    for (const field of requiredConfig) {
      if (field.key.includes('key') && maskedConfig[field.key]) {
        const value = maskedConfig[field.key];
        maskedConfig[field.key] = value.substring(0, 8) + '...' + value.substring(value.length - 4);
      }
    }

    return maskedConfig;
  }

  /**
   * Get AI configuration summary
   * @returns {Object}
   */
  getConfigSummary() {
    const aiConfig = this.configManager.get('ai', {});
    const providers = this.listProviders();

    return {
      current_provider: aiConfig.current_provider || 'none',
      current_model: aiConfig.current_model || 'none',
      providers: providers.map(p => ({
        ...p,
        config: p.configured ? this.safeGetProviderConfig(p.name) : {},
      })),
      defaults: aiConfig.defaults || {},
    };
  }

  /**
   * Safely get provider config without throwing
   * @param {string} providerName
   * @returns {Object}
   */
  safeGetProviderConfig(providerName) {
    try {
      return this.getProviderConfig(providerName);
    } catch (error) {
      // Return just the raw config if we can't get provider details
      return this.configManager.get(`ai.providers.${providerName}`, {});
    }
  }
}
