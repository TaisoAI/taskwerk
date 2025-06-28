export class LMStudioModel {
  constructor(modelName, config = {}) {
    this.modelName = modelName;
    this.baseUrl = config.baseUrl || 'http://localhost:1234';
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
      temperature: 0.1,
      max_tokens: 1000,
      stream: false,
    };

    // Add tool support if LM Studio supports it
    if (tools.length > 0) {
      requestBody.tools = tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));
      requestBody.tool_choice = 'auto';
    }

    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LM Studio API error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      const message = data.choices?.[0]?.message;

      if (!message) {
        throw new Error('No response from LM Studio API');
      }

      return {
        content: message.content,
        toolCalls: message.tool_calls || [],
        usage: data.usage || {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        },
      };
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('LM Studio request timed out');
      }
      throw new Error(`Failed to process with LM Studio: ${error.message}`);
    }
  }

  async isAvailable() {
    try {
      const response = await fetch(`${this.baseUrl}/v1/models`, {
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
      const response = await fetch(`${this.baseUrl}/v1/models`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      throw new Error(`Failed to list LM Studio models: ${error.message}`);
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
