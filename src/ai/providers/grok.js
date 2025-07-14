import { BaseProvider } from './base-provider.js';

export class GrokProvider extends BaseProvider {
  constructor(config = {}) {
    super(config);
    this.baseUrl = config.base_url || 'https://api.x.ai/v1';
    this.cachedModels = null;
    this.cacheExpiry = null;
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  isConfigured() {
    return !!this.config.api_key;
  }

  getRequiredConfig() {
    return [
      { key: 'api_key', description: 'Grok API key (from x.ai platform)', required: true },
      { key: 'base_url', description: 'API base URL (optional)', required: false }
    ];
  }

  async testConnection() {
    if (!this.isConfigured()) {
      return { success: false, message: 'API key not configured' };
    }

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.config.api_key}`,
          'Content-Type': 'application/json'
        }
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
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.config.api_key}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        
        const models = data.data
          .filter(model => {
            // Filter for Grok models
            const id = model.id.toLowerCase();
            return id.includes('grok');
          })
          .map(model => {
            let description = 'Grok model by xAI';
            const id = model.id.toLowerCase();
            
            if (id.includes('grok-beta')) {
              description = 'Grok Beta - Latest version';
            } else if (id.includes('grok-vision-beta')) {
              description = 'Grok Vision Beta - Multimodal model';
            }

            return {
              id: model.id,
              name: model.id,
              description
            };
          })
          .sort((a, b) => {
            // Sort by preference: vision > beta > others
            const getScore = (id) => {
              if (id.includes('vision')) return 100;
              if (id.includes('beta')) return 90;
              return 50;
            };
            return getScore(b.id) - getScore(a.id);
          });
        
        // Cache results
        this.cachedModels = models;
        this.cacheExpiry = Date.now() + this.cacheTimeout;
        
        return models;
      }
    } catch (error) {
      return [];
    }

    return [];
  }

  async complete({ model, messages, temperature = 0.7, maxTokens = 8192, stream = false, onChunk, tools }) {
    if (!this.isConfigured()) {
      throw new Error('Grok provider not configured');
    }

    const body = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream
    };

    // Add tools if provided (Grok uses OpenAI-compatible format)
    if (tools && tools.length > 0) {
      body.tools = tools;
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.api_key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Request failed');
    }

    if (stream && onChunk) {
      return this.handleStream(response, onChunk);
    }

    const data = await response.json();
    
    const result = {
      content: data.choices[0].message.content || '',
      tool_calls: [],
      usage: {
        prompt_tokens: data.usage?.prompt_tokens || 0,
        completion_tokens: data.usage?.completion_tokens || 0
      }
    };

    // Handle tool calls if present
    if (data.choices[0].message.tool_calls) {
      result.tool_calls = data.choices[0].message.tool_calls;
    }

    return result;
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
      return 'Invalid API key. Please check your Grok API key.';
    }
    if (error.message?.includes('rate_limit')) {
      return 'Rate limit exceeded. Please try again later.';
    }
    if (error.message?.includes('model')) {
      return 'Invalid model selected. Please choose a valid Grok model.';
    }
    return error.message || 'Unknown error occurred';
  }
}