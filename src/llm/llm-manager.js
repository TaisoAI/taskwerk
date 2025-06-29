import { TaskWerkToolRegistry } from './tool-registry.js';
import { saveConfig } from '../utils/config.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export class LLMManager {
  constructor(config = {}, taskManager = null) {
    this.config = config;
    this.loadedModel = null;
    this.modelConfig = null;
    this.taskManager = taskManager;
    this.toolRegistry = taskManager ? new TaskWerkToolRegistry(taskManager) : null;
  }

  async installModel(_modelName, _progressCallback) {
    throw new Error('Model installation not yet implemented');
  }

  async loadModel(modelName) {
    if (this.isRemoteModel(modelName)) {
      return this.loadRemoteModel(modelName);
    }

    if (this.isLocalModel(modelName)) {
      return this.loadLocalModel(modelName);
    }

    throw new Error(`Unsupported model type: ${modelName}`);
  }

  async processNaturalLanguage(input, context = {}) {
    if (!this.loadedModel) {
      throw new Error('No model loaded. Load a model first.');
    }

    if (!this.toolRegistry) {
      throw new Error('No task manager provided. Tool integration unavailable.');
    }

    const tools = this.toolRegistry.getToolSchemas();
    const session = await this.getSessionContext();

    const enhancedContext = {
      ...context,
      tools,
      session,
    };

    const response = await this.loadedModel.process(input, enhancedContext);

    if (response.toolCalls && response.toolCalls.length > 0) {
      const results = await this.executeToolCalls(response.toolCalls);
      return {
        ...response,
        toolResults: results,
      };
    }

    return response;
  }

  async executeToolCalls(toolCalls) {
    const results = [];

    for (const toolCall of toolCalls) {
      try {
        const { function: func } = toolCall;

        // Handle both string and object arguments
        let parameters;
        if (typeof func.arguments === 'string') {
          parameters = JSON.parse(func.arguments);
        } else if (typeof func.arguments === 'object') {
          parameters = func.arguments;
        } else {
          throw new Error(`Invalid function arguments type: ${typeof func.arguments}`);
        }

        this.toolRegistry.validateParameters(func.name, parameters);
        const result = await this.toolRegistry.executeTool(func.name, parameters);

        results.push({
          toolCallId: toolCall.id,
          success: true,
          result,
        });
      } catch (error) {
        results.push({
          toolCallId: toolCall.id,
          success: false,
          error: error.message,
        });
      }
    }

    return results;
  }

  async getSessionContext() {
    if (!this.taskManager) {
      return null;
    }

    try {
      const status = await this.taskManager.getStatus();
      const stats = await this.taskManager.getStats();
      return { status, stats };
    } catch (error) {
      return null;
    }
  }

  async getModelInfo(modelName) {
    if (this.isRemoteModel(modelName)) {
      return {
        name: modelName,
        type: 'remote',
        provider: this.getProviderFromModelName(modelName),
        status: 'available',
      };
    }

    throw new Error('Local model info not yet implemented');
  }

  async isModelAvailable(modelName) {
    if (this.isRemoteModel(modelName)) {
      return this.hasValidApiKey(this.getProviderFromModelName(modelName));
    }

    if (this.isLocalModel(modelName)) {
      return this.checkLocalModelAvailability(modelName);
    }

    return false;
  }

  async getModelUnavailabilityReason(modelName) {
    if (this.isRemoteModel(modelName)) {
      const provider = this.getProviderFromModelName(modelName);
      if (!this.hasValidApiKey(provider)) {
        const envKey = provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY';
        return {
          reason: 'missing_api_key',
          provider,
          envKey,
          message: `Missing API key for ${provider}. Set ${envKey} environment variable.`,
        };
      }
      return { reason: 'available' };
    }

    if (this.isLocalModel(modelName)) {
      const provider = this.getProviderFromModelName(modelName);

      if (provider === 'ollama') {
        try {
          const { OllamaModel } = await import('./providers/ollama-model.js');
          const model = new OllamaModel(modelName);

          if (!(await model.isAvailable())) {
            return {
              reason: 'service_unavailable',
              provider: 'ollama',
              message: 'Ollama service is not running. Start it with: ollama serve',
            };
          }

          const models = await model.listAvailableModels();
          if (!models.some(m => m.name === modelName)) {
            return {
              reason: 'model_not_found',
              provider: 'ollama',
              modelName,
              message: `Model '${modelName}' not found in Ollama. Pull it with: ollama pull ${modelName}`,
            };
          }

          return { reason: 'available' };
        } catch (error) {
          return {
            reason: 'service_error',
            provider: 'ollama',
            error: error.message,
            message: 'Ollama not installed or not working. Install from: https://ollama.ai',
          };
        }
      }

      if (provider === 'lmstudio') {
        try {
          const { LMStudioModel } = await import('./providers/lmstudio-model.js');
          const model = new LMStudioModel(modelName);
          if (!(await model.isAvailable())) {
            return {
              reason: 'service_unavailable',
              provider: 'lmstudio',
              message: 'LM Studio is not running. Start it and load a model.',
            };
          }
          return { reason: 'available' };
        } catch (error) {
          return {
            reason: 'service_error',
            provider: 'lmstudio',
            error: error.message,
            message: 'LM Studio not installed or not working. Install from: https://lmstudio.ai',
          };
        }
      }

      return {
        reason: 'unknown_provider',
        provider,
        message: `Unknown local model provider: ${provider}`,
      };
    }

    return {
      reason: 'unknown_model',
      modelName,
      message: `Unknown model type: ${modelName}`,
    };
  }

  async checkLocalModelAvailability(modelName) {
    const provider = this.getProviderFromModelName(modelName);

    if (provider === 'ollama') {
      try {
        const { OllamaModel } = await import('./providers/ollama-model.js');
        const model = new OllamaModel(modelName);

        // First check if Ollama is running
        if (!(await model.isAvailable())) {
          return false;
        }

        // Then check if the specific model exists
        const models = await model.listAvailableModels();
        return models.some(m => m.name === modelName);
      } catch (error) {
        return false;
      }
    }

    if (provider === 'lmstudio') {
      try {
        const { LMStudioModel } = await import('./providers/lmstudio-model.js');
        const model = new LMStudioModel(modelName);
        return model.isAvailable();
      } catch (error) {
        return false;
      }
    }

    return false;
  }

  async uninstallModel(_modelName) {
    throw new Error('Model uninstallation not yet implemented');
  }

  isRemoteModel(modelName) {
    return (
      modelName.includes('openai') || modelName.includes('claude') || modelName.includes('gpt')
    );
  }

  isLocalModel(modelName) {
    return (
      modelName.includes('ollama:') ||
      modelName.includes('lmstudio:') ||
      this.isOllamaModel(modelName) ||
      this.isLMStudioModel(modelName)
    );
  }

  isOllamaModel(modelName) {
    // Common Ollama model patterns
    return (
      modelName.includes('llama') ||
      modelName.includes('mistral') ||
      modelName.includes('codellama') ||
      modelName.includes('gemma') ||
      modelName.includes('qwen') ||
      modelName.includes('phi') ||
      modelName.includes('granite') ||
      modelName.includes('deepseek') ||
      modelName.includes('moondream') ||
      modelName.includes('smollm') ||
      modelName.includes('devstral') ||
      modelName === 'ollama' ||
      // If model name contains colon (version tag), it's likely Ollama format
      (modelName.includes(':') &&
        !modelName.includes('ollama:') &&
        !modelName.includes('lmstudio:'))
    );
  }

  isLMStudioModel(modelName) {
    return modelName.includes('lmstudio') || modelName === 'lmstudio';
  }

  getProviderFromModelName(modelName) {
    if (modelName.includes('openai') || modelName.includes('gpt')) {
      return 'openai';
    }
    if (modelName.includes('claude')) {
      return 'anthropic';
    }
    if (this.isOllamaModel(modelName) || modelName.includes('ollama:')) {
      return 'ollama';
    }
    if (this.isLMStudioModel(modelName) || modelName.includes('lmstudio:')) {
      return 'lmstudio';
    }
    return 'unknown';
  }

  loadStoredApiKeys() {
    const configPath = join(homedir(), '.taskwerk', 'keys.json');

    if (!existsSync(configPath)) {
      return {};
    }

    try {
      const content = readFileSync(configPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return {};
    }
  }

  getApiKey(provider) {
    // Priority: stored keys override environment variables
    const storedKeys = this.loadStoredApiKeys();
    const storedKey = storedKeys[provider.toLowerCase()];

    if (storedKey) {
      return storedKey;
    }

    // Fallback to environment variables
    const envKey = provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY';
    return process.env[envKey];
  }

  hasValidApiKey(provider) {
    return !!this.getApiKey(provider);
  }

  async loadRemoteModel(modelName) {
    const provider = this.getProviderFromModelName(modelName);

    if (provider === 'openai') {
      const { OpenAIModel } = await import('./providers/openai-model.js');
      this.loadedModel = new OpenAIModel(modelName, {
        apiKey: this.getApiKey('openai'),
      });
      return this.loadedModel;
    }

    // TODO: Add Anthropic provider implementation
    // if (provider === 'anthropic') {
    //   const { AnthropicModel } = await import('./providers/anthropic-model.js');
    //   this.loadedModel = new AnthropicModel(modelName, {
    //     apiKey: this.getApiKey('anthropic'),
    //   });
    //   return this.loadedModel;
    // }

    throw new Error(`Unsupported remote model provider: ${provider}`);
  }

  async loadLocalModel(modelName) {
    const provider = this.getProviderFromModelName(modelName);

    if (provider === 'ollama') {
      const { OllamaModel } = await import('./providers/ollama-model.js');
      this.loadedModel = new OllamaModel(modelName, {
        baseUrl: this.config.ollamaUrl || 'http://localhost:11434',
      });
      return this.loadedModel;
    }

    if (provider === 'lmstudio') {
      const { LMStudioModel } = await import('./providers/lmstudio-model.js');
      this.loadedModel = new LMStudioModel(modelName, {
        baseUrl: this.config.lmstudioUrl || 'http://localhost:1234',
      });
      return this.loadedModel;
    }

    throw new Error(`Unsupported local model provider: ${provider}`);
  }

  async listAvailableModels() {
    const models = [];

    // Remote models
    if (process.env.OPENAI_API_KEY) {
      models.push({
        name: 'gpt-3.5-turbo',
        type: 'remote',
        provider: 'openai',
        status: 'available',
      });
      models.push({
        name: 'gpt-4',
        type: 'remote',
        provider: 'openai',
        status: 'available',
      });
    }

    // Local models - Ollama
    try {
      const { OllamaModel } = await import('./providers/ollama-model.js');
      const ollama = new OllamaModel('test');
      if (await ollama.isAvailable()) {
        const ollamaModels = await ollama.listAvailableModels();
        for (const model of ollamaModels) {
          models.push({
            name: model.name,
            type: 'local',
            provider: 'ollama',
            status: 'available',
            size: model.size,
            modified: model.modified_at,
          });
        }
      }
    } catch (error) {
      // Ollama not available
    }

    // Local models - LM Studio
    try {
      const { LMStudioModel } = await import('./providers/lmstudio-model.js');
      const lmstudio = new LMStudioModel('test');
      if (await lmstudio.isAvailable()) {
        const lmstudioModels = await lmstudio.listAvailableModels();
        for (const model of lmstudioModels) {
          models.push({
            name: model.id,
            type: 'local',
            provider: 'lmstudio',
            status: 'available',
            created: model.created,
          });
        }
      }
    } catch (error) {
      // LM Studio not available
    }

    return models;
  }

  async setDefaultModel(modelName) {
    if (!(await this.isModelAvailable(modelName))) {
      throw new Error(`Model not available: ${modelName}`);
    }

    this.config.defaultModel = modelName;

    // Save to persistent config
    try {
      await saveConfig(this.config);
    } catch (error) {
      console.warn(`Warning: Could not save default model to config: ${error.message}`);
    }

    return true;
  }

  getDefaultModel() {
    // If no default model is configured, suggest setup
    if (!this.config.defaultModel) {
      return null;
    }
    return this.config.defaultModel;
  }
}
