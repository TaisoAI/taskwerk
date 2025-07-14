import { BaseProvider } from './base-provider.js';

export class LMStudioProvider extends BaseProvider {
  constructor(config = {}) {
    super(config);
    this.baseUrl = config.base_url || 'http://localhost:1234/v1';
  }

  isConfigured() {
    // LMStudio doesn't require API keys when running locally
    return true;
  }

  getRequiredConfig() {
    return [
      {
        key: 'base_url',
        description: 'LMStudio API URL (default: http://localhost:1234/v1)',
        required: false,
      },
    ];
  }

  async testConnection() {
    try {
      const response = await fetch(`${this.baseUrl}/models`);

      if (response.ok) {
        const data = await response.json();
        const modelCount = data.data ? data.data.length : 0;
        return { success: true, message: `Connected to LMStudio (${modelCount} models loaded)` };
      } else {
        return { success: false, message: 'LMStudio server not responding' };
      }
    } catch (error) {
      return {
        success: false,
        message: `Cannot connect to LMStudio at ${this.baseUrl}. Is LMStudio running?`,
      };
    }
  }

  async listModels() {
    try {
      const response = await fetch(`${this.baseUrl}/models`);

      if (response.ok) {
        const data = await response.json();

        if (!data.data || data.data.length === 0) {
          return [
            {
              id: 'no-models',
              name: 'No models loaded',
              description: 'Load a model in LMStudio first',
            },
          ];
        }

        return data.data.map(model => {
          let description = 'LMStudio model';
          const id = model.id.toLowerCase();

          // Determine model family
          if (id.includes('llama')) {
            description = 'Llama family model';
          } else if (id.includes('gemma')) {
            description = 'Google Gemma model';
          } else if (id.includes('mistral')) {
            description = 'Mistral model';
          } else if (id.includes('phi')) {
            description = 'Microsoft Phi model';
          } else if (id.includes('qwen')) {
            description = 'Alibaba Qwen model';
          } else if (id.includes('codellama')) {
            description = 'Code-specialized Llama';
          } else if (id.includes('yi')) {
            description = '01-ai Yi model';
          } else if (id.includes('deepseek')) {
            description = 'DeepSeek model';
          }

          return {
            id: model.id,
            name: model.id,
            description,
          };
        });
      }
    } catch (error) {
      return [
        {
          id: 'connection-error',
          name: 'Connection Error',
          description: `Cannot connect to LMStudio at ${this.baseUrl}. Is LMStudio running?`,
        },
      ];
    }

    return [];
  }

  async complete({
    model,
    messages,
    temperature = 0.7,
    maxTokens = 8192,
    stream = false,
    onChunk,
  }) {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream,
      }),
    });

    if (!response.ok) {
      throw new Error('LMStudio request failed');
    }

    if (stream && onChunk) {
      return this.handleStream(response, onChunk);
    }

    const data = await response.json();
    return {
      content: data.choices[0].message.content,
      usage: {
        prompt_tokens: data.usage?.prompt_tokens || 0,
        completion_tokens: data.usage?.completion_tokens || 0,
      },
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
                completion_tokens: parsed.usage.completion_tokens,
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
    if (error.message?.includes('ECONNREFUSED')) {
      return `Cannot connect to LMStudio. Please ensure LMStudio is running at ${this.baseUrl}`;
    }
    if (error.message?.includes('model')) {
      return 'Model not loaded. Please load a model in LMStudio first';
    }
    return error.message || 'Unknown error occurred';
  }
}
