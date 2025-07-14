import { Logger } from '../../logging/logger.js';

/**
 * Registry for managing available tools
 */
export class ToolRegistry {
  constructor() {
    this.tools = new Map();
    this.logger = new Logger('tool-registry');
  }

  /**
   * Register a tool
   * @param {string} name - Tool name
   * @param {BaseTool} tool - Tool instance
   */
  register(name, tool) {
    if (this.tools.has(name)) {
      this.logger.warn(`Tool ${name} already registered, overwriting`);
    }
    this.tools.set(name, tool);
    // Only log registration in debug mode
    this.logger.debug(`Registered tool: ${name}`);
  }

  /**
   * Get a tool by name
   * @param {string} name - Tool name
   * @returns {BaseTool} Tool instance
   */
  get(name) {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }
    return tool;
  }

  /**
   * Get all tools
   * @returns {Map<string, BaseTool>} All registered tools
   */
  getAll() {
    return this.tools;
  }

  /**
   * Get tool specifications for LLM
   * @param {string[]} permissions - Allowed permissions
   * @returns {Object[]} Tool specifications
   */
  getSpecs(permissions = []) {
    const specs = [];

    for (const [name, tool] of this.tools) {
      // Check if tool's required permissions are allowed
      const toolPermissions = tool.permissions || [];
      const hasPermission = toolPermissions.every(p => permissions.includes(p));

      if (hasPermission) {
        specs.push({
          type: 'function',
          function: {
            name: name,
            description: tool.description,
            parameters: tool.getParameters(),
          },
        });
      }
    }

    return specs;
  }

  /**
   * Execute a tool
   * @param {string} name - Tool name
   * @param {Object} params - Tool parameters
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Tool result
   */
  async execute(name, params, context) {
    const tool = this.get(name);

    // Check permissions
    const requiredPermission = tool.requiresPermission(params);
    if (requiredPermission && context.mode !== 'yolo') {
      if (!context.confirmPermission) {
        throw new Error('Permission confirmation callback required');
      }

      const granted = await context.confirmPermission(name, requiredPermission, params);
      if (!granted) {
        return {
          success: false,
          error: 'Permission denied by user',
        };
      }
    }

    try {
      const result = await tool.execute(params, context);
      return {
        success: true,
        result: result,
      };
    } catch (error) {
      this.logger.error(`Tool ${name} execution failed:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Clear all tools
   */
  clear() {
    this.tools.clear();
  }
}
