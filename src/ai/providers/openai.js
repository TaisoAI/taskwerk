import { BaseProvider } from './base-provider.js';

export class OpenAIProvider extends BaseProvider {
  constructor(config = {}) {
    super(config);
    this.baseUrl = config.base_url || 'https://api.openai.com/v1';
    this.models = [
      { id: 'gpt-4-turbo-preview', name: 'GPT-4 Turbo', description: 'Latest GPT-4 Turbo model' },
      { id: 'gpt-4', name: 'GPT-4', description: 'Most capable GPT-4 model' },
      { id: 'gpt-4-32k', name: 'GPT-4 32K', description: 'GPT-4 with larger context window' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fast and efficient model' },
      { id: 'gpt-3.5-turbo-16k', name: 'GPT-3.5 Turbo 16K', description: 'GPT-3.5 with larger context' }
    ];
  }

  isConfigured() {
    return !!this.config.api_key;
  }

  getRequiredConfig() {
    return [
      { key: 'api_key', description: 'OpenAI API key (starts with sk-)', required: true },
      { key: 'base_url', description: 'API base URL (optional, for custom endpoints)', required: false },
      { key: 'organization', description: 'OpenAI organization ID (optional)', required: false }
    ];
  }

  async testConnection() {
    if (!this.isConfigured()) {
      return { success: false, message: 'API key not configured' };
    }

    try {
      const headers = {
        'Authorization': `Bearer ${this.config.api_key}`,
        'Content-Type': 'application/json'
      };

      if (this.config.organization) {
        headers['OpenAI-Organization'] = this.config.organization;
      }

      const response = await fetch(`${this.baseUrl}/models`, {
        headers
      });

      if (response.ok) {
        return { success: true, message: 'Connection successful' };
      } else {
        const error = await response.json();
        return { success: false, message: error.error?.message || 'Connection failed' };
      }
    } catch (error) {
      return { success: false, message: `Connection error: ${error.message}` };
    }
  }

  async listModels() {
    if (!this.isConfigured()) {
      return this.models;
    }

    try {
      const headers = {
        'Authorization': `Bearer ${this.config.api_key}`
      };

      if (this.config.organization) {
        headers['OpenAI-Organization'] = this.config.organization;
      }

      const response = await fetch(`${this.baseUrl}/models`, {
        headers
      });

      if (response.ok) {
        const data = await response.json();
        const chatModels = data.data
          .filter(model => model.id.includes('gpt'))
          .map(model => ({
            id: model.id,
            name: model.id,
            description: `Created: ${new Date(model.created * 1000).toLocaleDateString()}`
          }));
        
        return chatModels.length > 0 ? chatModels : this.models;
      }
    } catch (error) {
      // Fall back to default models
    }

    return this.models;
  }

  async complete({ model, messages, temperature = 0.7, maxTokens = 2000, stream = false, onChunk }) {
    if (!this.isConfigured()) {
      throw new Error('OpenAI provider not configured');
    }

    const headers = {
      'Authorization': `Bearer ${this.config.api_key}`,
      'Content-Type': 'application/json'
    };

    if (this.config.organization) {
      headers['OpenAI-Organization'] = this.config.organization;
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Request failed');
    }

    if (stream && onChunk) {
      return this.handleStream(response, onChunk);
    }

    const data = await response.json();
    return {
      content: data.choices[0].message.content,
      usage: {
        prompt_tokens: data.usage.prompt_tokens,
        completion_tokens: data.usage.completion_tokens
      }
    };
  }

  async handleStream(response, onChunk) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';
    let usage = null;

    let done = false;
    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (done) {
        break;
      }
      const value = result.value;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            continue;
          }

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices[0].delta;
            
            if (delta.content) {
              fullContent += delta.content;
              onChunk(delta.content);
            }

            if (parsed.usage) {
              usage = {
                prompt_tokens: parsed.usage.prompt_tokens,
                completion_tokens: parsed.usage.completion_tokens
              };
            }
          } catch (e) {
            // Ignore parsing errors
          }
        }
      }
    }

    return { content: fullContent, usage };
  }

  parseError(error) {
    if (error.message?.includes('api_key')) {
      return 'Invalid API key. Please check your OpenAI API key.';
    }
    if (error.message?.includes('rate_limit')) {
      return 'Rate limit exceeded. Please try again later.';
    }
    if (error.message?.includes('model')) {
      return 'Invalid model selected. Please choose a valid OpenAI model.';
    }
    if (error.message?.includes('quota')) {
      return 'Quota exceeded. Please check your OpenAI account.';
    }
    return error.message || 'Unknown error occurred';
  }
}