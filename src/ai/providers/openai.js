import { BaseProvider } from './base-provider.js';

export class OpenAIProvider extends BaseProvider {
  constructor(config = {}) {
    super(config);
    this.baseUrl = config.base_url || 'https://api.openai.com/v1';
    this.cachedModels = null;
    this.cacheExpiry = null;
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
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
      return [];
    }

    // Check cache first
    if (this.cachedModels && this.cacheExpiry && Date.now() < this.cacheExpiry) {
      return this.cachedModels;
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
        
        // Filter for chat completion models and sort by capability
        const chatModels = data.data
          .filter(model => {
            const id = model.id.toLowerCase();
            return (
              (id.includes('gpt-4') || id.includes('gpt-3.5') || id.includes('o1')) &&
              !id.includes('instruct') &&
              !id.includes('edit') &&
              !id.includes('search') &&
              !id.includes('similarity') &&
              !id.includes('ada') &&
              !id.includes('babbage') &&
              !id.includes('curie') &&
              !id.includes('davinci')
            );
          })
          .map(model => {
            // Generate better descriptions based on model name
            let description = `OpenAI model`;
            const id = model.id.toLowerCase();
            
            if (id.includes('o1-preview')) {
              description = 'Latest reasoning model (preview)';
            } else if (id.includes('o1-mini')) {
              description = 'Fast reasoning model';
            } else if (id.includes('gpt-4o')) {
              description = 'Latest multimodal GPT-4 model';
            } else if (id.includes('gpt-4-turbo')) {
              description = 'Latest GPT-4 with enhanced capabilities';
            } else if (id.includes('gpt-4-32k')) {
              description = 'GPT-4 with 32K context window';
            } else if (id.includes('gpt-4')) {
              description = 'Most capable GPT-4 model';
            } else if (id.includes('gpt-3.5-turbo-16k')) {
              description = 'GPT-3.5 with 16K context window';
            } else if (id.includes('gpt-3.5-turbo')) {
              description = 'Fast and efficient model';
            }

            return {
              id: model.id,
              name: model.id,
              description
            };
          })
          .sort((a, b) => {
            // Sort by preference: o1 > gpt-4o > gpt-4-turbo > gpt-4 > gpt-3.5
            const getScore = (id) => {
              if (id.includes('o1-preview')) {return 100;}
              if (id.includes('o1-mini')) {return 90;}
              if (id.includes('gpt-4o')) {return 80;}
              if (id.includes('gpt-4-turbo')) {return 70;}
              if (id.includes('gpt-4')) {return 60;}
              if (id.includes('gpt-3.5')) {return 50;}
              return 0;
            };
            return getScore(b.id) - getScore(a.id);
          });
        
        // Cache results
        this.cachedModels = chatModels;
        this.cacheExpiry = Date.now() + this.cacheTimeout;
        
        return chatModels;
      }
    } catch (error) {
      // Return empty array on error since we don't have fallback models
      return [];
    }

    return [];
  }

  async complete({ model, messages, temperature = 0.7, maxTokens = 8192, stream = false, onChunk }) {
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