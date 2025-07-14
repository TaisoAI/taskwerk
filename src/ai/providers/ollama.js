import { BaseProvider } from './base-provider.js';

export class OllamaProvider extends BaseProvider {
  constructor(config = {}) {
    super(config);
    this.baseUrl = config.base_url || 'http://localhost:11434';
  }

  isConfigured() {
    // Ollama doesn't require API keys, just needs to be running
    return true;
  }

  getRequiredConfig() {
    return [
      { key: 'base_url', description: 'Ollama API URL (default: http://localhost:11434)', required: false }
    ];
  }

  async testConnection() {
    try {
      const response = await fetch(`${this.baseUrl}/api/version`);
      
      if (response.ok) {
        const data = await response.json();
        return { success: true, message: `Connected to Ollama ${data.version}` };
      } else {
        return { success: false, message: 'Ollama server not responding' };
      }
    } catch (error) {
      return { success: false, message: `Cannot connect to Ollama at ${this.baseUrl}. Is Ollama running?` };
    }
  }

  async listModels() {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      
      if (response.ok) {
        const data = await response.json();
        return data.models.map(model => ({
          id: model.name,
          name: model.name,
          description: `Size: ${this.formatSize(model.size)}, Modified: ${new Date(model.modified_at).toLocaleDateString()}`
        }));
      }
    } catch (error) {
      // Return empty array if can't connect
    }

    return [];
  }

  async complete({ model, messages, temperature = 0.7, maxTokens, stream = false, onChunk }) {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages,
        stream,
        options: {
          temperature,
          num_predict: maxTokens
        }
      })
    });

    if (!response.ok) {
      throw new Error('Ollama request failed');
    }

    if (stream && onChunk) {
      return this.handleStream(response, onChunk);
    }

    const data = await response.json();
    return {
      content: data.message.content,
      usage: {
        prompt_tokens: data.prompt_eval_count || 0,
        completion_tokens: data.eval_count || 0
      }
    };
  }

  async handleStream(response, onChunk) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';
    let promptTokens = 0;
    let completionTokens = 0;

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
        if (line.trim()) {
          try {
            const parsed = JSON.parse(line);
            
            if (parsed.message?.content) {
              const chunk = parsed.message.content;
              fullContent += chunk;
              onChunk(chunk);
            }

            if (parsed.prompt_eval_count) {
              promptTokens = parsed.prompt_eval_count;
            }
            if (parsed.eval_count) {
              completionTokens = parsed.eval_count;
            }
          } catch (e) {
            // Ignore parsing errors
          }
        }
      }
    }

    return {
      content: fullContent,
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens
      }
    };
  }

  formatSize(bytes) {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) {
      return '0 B';
    }
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  }

  parseError(error) {
    if (error.message?.includes('ECONNREFUSED')) {
      return `Cannot connect to Ollama. Please ensure Ollama is running at ${this.baseUrl}`;
    }
    if (error.message?.includes('model')) {
      return 'Model not found. Please pull the model first using: ollama pull <model>';
    }
    return error.message || 'Unknown error occurred';
  }
}