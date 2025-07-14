export class BaseProvider {
  constructor(config = {}) {
    this.config = config;
    this.name = this.constructor.name.replace('Provider', '').toLowerCase();
  }

  /**
   * Test if the provider is properly configured and accessible
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async testConnection() {
    throw new Error('testConnection must be implemented by provider');
  }

  /**
   * List available models from this provider
   * @returns {Promise<Array<{id: string, name: string, description?: string}>>}
   */
  async listModels() {
    throw new Error('listModels must be implemented by provider');
  }

  /**
   * Send a completion request to the provider
   * @param {Object} _params - Request parameters
   * @param {string} _params.model - Model ID
   * @param {Array<{role: string, content: string}>} _params.messages - Chat messages
   * @param {number} [_params.temperature] - Temperature (0-2)
   * @param {number} [_params.maxTokens] - Max tokens to generate
   * @param {boolean} [_params.stream] - Whether to stream the response
   * @param {Function} [_params.onChunk] - Callback for streaming chunks
   * @returns {Promise<{content: string, usage?: {prompt_tokens: number, completion_tokens: number}}>}
   */
  async complete(_params) {
    throw new Error('complete must be implemented by provider');
  }

  /**
   * Validate provider configuration
   * @returns {boolean}
   */
  isConfigured() {
    throw new Error('isConfigured must be implemented by provider');
  }

  /**
   * Get required configuration keys
   * @returns {Array<{key: string, description: string, required: boolean}>}
   */
  getRequiredConfig() {
    return [];
  }

  /**
   * Format messages for the provider's API
   * @param {Array<{role: string, content: string}>} messages
   * @returns {Array}
   */
  formatMessages(messages) {
    return messages;
  }

  /**
   * Parse error responses from the provider
   * @param {Error} error
   * @returns {string}
   */
  parseError(error) {
    return error.message || 'Unknown error';
  }
}
