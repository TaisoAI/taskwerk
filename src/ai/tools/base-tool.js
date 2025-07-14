/**
 * Base class for all AI tools
 */
export class BaseTool {
  constructor(config = {}) {
    this.name = this.constructor.name;
    this.description = config.description || 'No description provided';
    this.permissions = config.permissions || [];
    this.workDir = config.workDir || process.cwd();
  }

  /**
   * Get tool metadata for LLM
   * @returns {Object} Tool specification
   */
  getSpec() {
    return {
      name: this.name,
      description: this.description,
      parameters: this.getParameters(),
      permissions: this.permissions
    };
  }

  /**
   * Get parameter specification
   * @returns {Object} JSON Schema for parameters
   */
  getParameters() {
    throw new Error('getParameters must be implemented by subclass');
  }

  /**
   * Execute the tool
   * @param {Object} params - Tool parameters
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Tool result
   */
  async execute(params, _context = {}) {
    throw new Error('execute must be implemented by subclass');
  }

  /**
   * Check if tool requires permission for given parameters
   * @param {Object} params - Tool parameters
   * @returns {boolean|string} false if no permission needed, or permission description
   */
  requiresPermission(_params) {
    return false;
  }

  /**
   * Format result for display
   * @param {Object} result - Tool execution result
   * @returns {string} Formatted result
   */
  formatResult(result) {
    if (typeof result === 'string') {
      return result;
    }
    return JSON.stringify(result, null, 2);
  }
}

/**
 * Tool categories for permission management
 */
export const ToolPermissions = {
  READ_FILES: 'read_files',
  WRITE_FILES: 'write_files',
  DELETE_FILES: 'delete_files',
  EXECUTE_COMMANDS: 'execute_commands',
  MODIFY_TASKS: 'modify_tasks',
  NETWORK_ACCESS: 'network_access',
  MCP_ACCESS: 'mcp_access'
};