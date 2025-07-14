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
        
        if (!data.models || data.models.length === 0) {
          return [{
            id: 'no-models',
            name: 'No models available',
            description: 'Run "ollama pull <model>" to download models'
          }];
        }
        
        return data.models
          .map(model => {
            // Parse model name to get base name and tag
            const [baseName, tag = 'latest'] = model.name.split(':');
            const displayName = tag === 'latest' ? baseName : model.name;
            
            // Determine model family for better descriptions
            let description = `Size: ${this.formatSize(model.size)}`;
            
            if (baseName.includes('llama')) {
              description += ` • Llama family model`;
            } else if (baseName.includes('gemma')) {
              description += ` • Google Gemma model`;
            } else if (baseName.includes('mistral')) {
              description += ` • Mistral model`;
            } else if (baseName.includes('phi')) {
              description += ` • Microsoft Phi model`;
            } else if (baseName.includes('qwen')) {
              description += ` • Alibaba Qwen model`;
            } else if (baseName.includes('codellama')) {
              description += ` • Code-specialized Llama`;
            }
            
            description += ` • Modified: ${new Date(model.modified_at).toLocaleDateString()}`;
            
            return {
              id: model.name,
              name: displayName,
              description
            };
          })
          .sort((a, b) => {
            // Sort by model family preference and size
            const getScore = (name) => {
              const lower = name.toLowerCase();
              if (lower.includes('llama3.2')) {return 100;}
              if (lower.includes('llama3.1')) {return 95;}
              if (lower.includes('llama3')) {return 90;}
              if (lower.includes('gemma2')) {return 85;}
              if (lower.includes('qwen2.5')) {return 80;}
              if (lower.includes('mistral')) {return 75;}
              if (lower.includes('phi3')) {return 70;}
              if (lower.includes('codellama')) {return 65;}
              return 50;
            };
            return getScore(b.name) - getScore(a.name);
          });
      }
    } catch (error) {
      return [{
        id: 'connection-error',
        name: 'Connection Error',
        description: `Cannot connect to Ollama at ${this.baseUrl}. Is Ollama running?`
      }];
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