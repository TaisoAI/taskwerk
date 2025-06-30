import { buildTaskwerkSystemPrompt } from '../system-prompt.js';

export class OpenAIModel {
  constructor(modelName, config) {
    this.modelName = modelName || 'gpt-3.5-turbo';
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';

    if (!this.apiKey) {
      throw new Error('OpenAI API key is required');
    }
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
    };

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
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const message = data.choices[0]?.message;

      if (!message) {
        throw new Error('No response from OpenAI API');
      }

      return {
        content: message.content,
        toolCalls: message.tool_calls || [],
        usage: data.usage,
      };
    } catch (error) {
      throw new Error(`Failed to process with OpenAI: ${error.message}`);
    }
  }

  buildSystemPrompt(context) {
    return buildTaskwerkSystemPrompt(context);
  }
}
