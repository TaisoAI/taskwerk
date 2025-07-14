import { BaseProvider } from './base-provider.js';

export class AnthropicProvider extends BaseProvider {
  constructor(config = {}) {
    super(config);
    this.baseUrl = 'https://api.anthropic.com/v1';
    this.models = [
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Most capable model, best for complex tasks' },
      { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', description: 'Balanced performance and speed' },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: 'Fastest model, best for simple tasks' },
      { id: 'claude-2.1', name: 'Claude 2.1', description: 'Previous generation model' },
      { id: 'claude-2.0', name: 'Claude 2.0', description: 'Legacy model' }
    ];
  }

  isConfigured() {
    return !!this.config.api_key;
  }

  getRequiredConfig() {
    return [
      { key: 'api_key', description: 'Anthropic API key (starts with sk-ant-)', required: true }
    ];
  }

  async testConnection() {
    if (!this.isConfigured()) {
      return { success: false, message: 'API key not configured' };
    }

    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'anthropic-version': '2023-06-01',
          'x-api-key': this.config.api_key,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 10
        })
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
    // Only return models if provider is configured
    if (!this.isConfigured()) {
      return [];
    }
    return this.models;
  }

  async complete({ model, messages, temperature = 0.7, maxTokens = 2000, stream = false, onChunk }) {
    if (!this.isConfigured()) {
      throw new Error('Anthropic provider not configured');
    }

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'anthropic-version': '2023-06-01',
        'x-api-key': this.config.api_key,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: this.formatMessages(messages),
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
      content: data.content[0].text,
      usage: {
        prompt_tokens: data.usage.input_tokens,
        completion_tokens: data.usage.output_tokens
      }
    };
  }

  formatMessages(messages) {
    // Ensure messages alternate between user and assistant
    const formatted = [];
    let lastRole = null;

    for (const msg of messages) {
      if (msg.role === 'system') {
        // Convert system messages to user messages with context
        formatted.push({
          role: 'user',
          content: `System: ${msg.content}`
        });
        lastRole = 'user';
      } else if (msg.role === lastRole) {
        // Combine consecutive messages from same role
        formatted[formatted.length - 1].content += `\n\n${msg.content}`;
      } else {
        formatted.push(msg);
        lastRole = msg.role;
      }
    }

    // Ensure conversation starts with user
    if (formatted.length > 0 && formatted[0].role !== 'user') {
      formatted.unshift({ role: 'user', content: 'Continue the conversation' });
    }

    // Ensure conversation ends with user
    if (formatted.length > 0 && formatted[formatted.length - 1].role !== 'user') {
      formatted.push({ role: 'user', content: 'Please respond' });
    }

    return formatted;
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
            
            if (parsed.type === 'content_block_delta') {
              const chunk = parsed.delta.text;
              fullContent += chunk;
              onChunk(chunk);
            } else if (parsed.type === 'message_delta' && parsed.usage) {
              usage = {
                prompt_tokens: parsed.usage.input_tokens,
                completion_tokens: parsed.usage.output_tokens
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
      return 'Invalid API key. Please check your Anthropic API key.';
    }
    if (error.message?.includes('rate_limit')) {
      return 'Rate limit exceeded. Please try again later.';
    }
    if (error.message?.includes('model')) {
      return 'Invalid model selected. Please choose a valid Claude model.';
    }
    return error.message || 'Unknown error occurred';
  }
}