export class OllamaModel {
  constructor(modelName, config = {}) {
    this.modelName = modelName;
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.timeout = config.timeout || 30000;
  }

  async process(input, context = {}) {
    const systemPrompt = this.buildSystemPrompt(context);
    const tools = context.tools || [];

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: input },
    ];

    const requestBody = {
      model: this.modelName,
      messages,
      stream: false,
      options: {
        temperature: 0.1,
        num_predict: 1000,
      },
    };

    // Add tool support if available
    if (tools.length > 0) {
      requestBody.tools = tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} ${errorText}`);
      }

      const data = await response.json();

      if (!data.message) {
        throw new Error('No response from Ollama API');
      }

      return {
        content: data.message.content,
        toolCalls: data.message.tool_calls || [],
        usage: {
          prompt_tokens: data.prompt_eval_count || 0,
          completion_tokens: data.eval_count || 0,
          total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        },
      };
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Ollama request timed out');
      }
      throw new Error(`Failed to process with Ollama: ${error.message}`);
    }
  }

  async isAvailable() {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async listAvailableModels() {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }

      const data = await response.json();
      return data.models || [];
    } catch (error) {
      throw new Error(`Failed to list Ollama models: ${error.message}`);
    }
  }

  async pullModel(modelName, progressCallback) {
    const requestBody = {
      name: modelName,
      stream: true,
    };

    try {
      const response = await fetch(`${this.baseUrl}/api/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Failed to pull model: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (progressCallback && data.status) {
              progressCallback(data);
            }
          } catch (parseError) {
            // Skip invalid JSON lines
          }
        }
      }

      return true;
    } catch (error) {
      throw new Error(`Failed to pull model from Ollama: ${error.message}`);
    }
  }

  buildSystemPrompt(context) {
    const sessionInfo = context.session
      ? `Current session: ${JSON.stringify(context.session, null, 2)}`
      : '';

    return `You are TaskWerk Assistant, an AI helper for task management.
You have access to TaskWerk commands via function calls.
Convert user requests to appropriate TaskWerk actions.

${sessionInfo}

Guidelines:
- Always use function calls to execute TaskWerk commands when possible
- Provide helpful summaries of actions taken
- Ask for clarification when requests are ambiguous
- Be concise and focused on task management
- When listing tasks, format the output clearly
- Maintain context about current tasks and session state

Available TaskWerk functions will be provided as tools. Use them to help users manage their tasks effectively.`;
  }
}
