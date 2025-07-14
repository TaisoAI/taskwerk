import { BaseProvider } from './base-provider.js';

export class AnthropicProvider extends BaseProvider {
  constructor(config = {}) {
    super(config);
    this.baseUrl = 'https://api.anthropic.com/v1';
    this.fallbackModels = [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (Latest)', description: 'Latest and most capable model' },
      { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet', description: 'Highly capable model' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Most capable model for complex reasoning' },
      { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', description: 'Balanced performance and speed' },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: 'Fastest model for simple tasks' }
    ];
    this.cachedModels = null;
    this.cacheExpiry = null;
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
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
    if (!this.isConfigured()) {
      return [];
    }

    // Check cache first
    if (this.cachedModels && this.cacheExpiry && Date.now() < this.cacheExpiry) {
      return this.cachedModels;
    }

    try {
      // Anthropic doesn't have a public models API, but we can try to detect available models
      // by making test requests with very small token limits
      const availableModels = [];
      
      for (const model of this.fallbackModels) {
        try {
          const response = await fetch(`${this.baseUrl}/messages`, {
            method: 'POST',
            headers: {
              'anthropic-version': '2023-06-01',
              'x-api-key': this.config.api_key,
              'content-type': 'application/json'
            },
            body: JSON.stringify({
              model: model.id,
              messages: [{ role: 'user', content: 'Hi' }],
              max_tokens: 1
            })
          });

          if (response.ok || response.status === 400) {
            // 400 might be due to too few tokens, which means model exists
            availableModels.push(model);
          }
        } catch (error) {
          // Skip models that error
          continue;
        }
      }

      // Cache results
      this.cachedModels = availableModels.length > 0 ? availableModels : this.fallbackModels;
      this.cacheExpiry = Date.now() + this.cacheTimeout;
      
      return this.cachedModels;
    } catch (error) {
      // Fall back to static list on error
      return this.fallbackModels;
    }
  }

  async complete({ model, messages, temperature = 0.7, maxTokens = 8192, stream = false, onChunk, tools }) {
    if (!this.isConfigured()) {
      throw new Error('Anthropic provider not configured');
    }

    const body = {
      model,
      messages: this.formatMessages(messages),
      temperature,
      max_tokens: maxTokens,
      stream
    };

    // Add tools if provided
    if (tools && tools.length > 0) {
      body.tools = tools;
    }

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'anthropic-version': '2023-06-01',
        'x-api-key': this.config.api_key,
        'content-type': 'application/json'
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
    
    // Handle tool use
    const result = {
      content: '',
      tool_calls: [],
      usage: {
        prompt_tokens: data.usage.input_tokens,
        completion_tokens: data.usage.output_tokens
      }
    };
    
    // Process content blocks
    for (const block of data.content) {
      if (block.type === 'text') {
        result.content += block.text;
      } else if (block.type === 'tool_use') {
        result.tool_calls.push({
          id: block.id,
          type: 'function',
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input)
          }
        });
      }
    }
    
    return result;
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
      } else if (msg.role === 'tool') {
        // Format tool results
        formatted.push({
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: msg.tool_call_id,
            content: msg.content
          }]
        });
        lastRole = 'user';
      } else if (msg.role === 'assistant' && msg.tool_calls) {
        // Format assistant message with tool calls
        const content = [];
        if (msg.content) {
          content.push({ type: 'text', text: msg.content });
        }
        for (const toolCall of msg.tool_calls) {
          content.push({
            type: 'tool_use',
            id: toolCall.id,
            name: toolCall.function.name,
            input: JSON.parse(toolCall.function.arguments)
          });
        }
        formatted.push({
          role: 'assistant',
          content
        });
        lastRole = 'assistant';
      } else if (msg.role === lastRole && msg.role !== 'assistant') {
        // Combine consecutive messages from same role (except assistant)
        const last = formatted[formatted.length - 1];
        if (typeof last.content === 'string') {
          last.content += `\n\n${msg.content}`;
        } else {
          last.content.push({ type: 'text', text: msg.content });
        }
      } else {
        formatted.push({
          role: msg.role,
          content: msg.content
        });
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