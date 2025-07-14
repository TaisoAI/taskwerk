import { Logger } from '../logging/logger.js';
import { ToolRegistry } from './tools/tool-registry.js';

// Import all tools
import { ListTasksTool } from './tools/taskwerk/list-tasks.js';
import { AddTaskTool } from './tools/taskwerk/add-task.js';
import { UpdateTaskTool } from './tools/taskwerk/update-task.js';
import { ReadFileTool } from './tools/filesystem/read-file.js';
import { WriteFileTool } from './tools/filesystem/write-file.js';
import { ListFilesTool } from './tools/filesystem/list-files.js';

/**
 * Executes tool calls from LLM responses
 */
export class ToolExecutor {
  constructor(config = {}) {
    this.logger = new Logger('tool-executor');
    this.registry = new ToolRegistry();
    this.workDir = config.workDir || process.cwd();
    this.mode = config.mode || 'ask'; // 'ask', 'agent', or 'yolo'
    this.confirmPermission = config.confirmPermission;
    
    // Initialize tools
    this.initializeTools();
  }

  initializeTools() {
    const toolConfig = { workDir: this.workDir };
    
    // Taskwerk tools
    this.registry.register('list_tasks', new ListTasksTool(toolConfig));
    this.registry.register('add_task', new AddTaskTool(toolConfig));
    this.registry.register('update_task', new UpdateTaskTool(toolConfig));
    
    // File system tools
    this.registry.register('read_file', new ReadFileTool(toolConfig));
    this.registry.register('list_files', new ListFilesTool(toolConfig));
    
    // Only register write tools in agent mode
    if (this.mode === 'agent' || this.mode === 'yolo') {
      this.registry.register('write_file', new WriteFileTool(toolConfig));
    }
    
    this.logger.info(`Initialized ${this.registry.getAll().size} tools for ${this.mode} mode`);
  }

  /**
   * Get tool specifications for LLM
   * @returns {Object[]} Tool specifications
   */
  getToolSpecs() {
    // Get permissions based on mode
    const permissions = this.getPermissionsForMode();
    return this.registry.getSpecs(permissions);
  }

  /**
   * Execute tool calls from LLM response
   * @param {Object[]} toolCalls - Tool calls from LLM
   * @returns {Promise<Object[]>} Tool results
   */
  async executeTools(toolCalls) {
    const results = [];
    
    for (const toolCall of toolCalls) {
      const { id, function: func } = toolCall;
      const { name, arguments: args } = func;
      
      this.logger.info(`Executing tool: ${name}`);
      
      try {
        const params = typeof args === 'string' ? JSON.parse(args) : args;
        const context = {
          mode: this.mode,
          confirmPermission: this.confirmPermission,
          workDir: this.workDir
        };
        
        const result = await this.registry.execute(name, params, context);
        
        results.push({
          tool_call_id: id,
          content: JSON.stringify(result)
        });
      } catch (error) {
        this.logger.error(`Tool ${name} failed:`, error);
        results.push({
          tool_call_id: id,
          content: JSON.stringify({
            success: false,
            error: error.message
          })
        });
      }
    }
    
    return results;
  }

  /**
   * Get permissions based on mode
   * @returns {string[]} Allowed permissions
   */
  getPermissionsForMode() {
    const ToolPermissions = {
      READ_FILES: 'read_files',
      WRITE_FILES: 'write_files',
      DELETE_FILES: 'delete_files',
      EXECUTE_COMMANDS: 'execute_commands',
      MODIFY_TASKS: 'modify_tasks',
      NETWORK_ACCESS: 'network_access',
      MCP_ACCESS: 'mcp_access'
    };
    
    switch (this.mode) {
      case 'ask':
        return [
          ToolPermissions.READ_FILES,
          ToolPermissions.MODIFY_TASKS
        ];
      
      case 'agent':
      case 'yolo':
        return [
          ToolPermissions.READ_FILES,
          ToolPermissions.WRITE_FILES,
          ToolPermissions.DELETE_FILES,
          ToolPermissions.MODIFY_TASKS,
          ToolPermissions.EXECUTE_COMMANDS,
          ToolPermissions.MCP_ACCESS,
          ToolPermissions.NETWORK_ACCESS
        ];
      
      default:
        return [];
    }
  }

  /**
   * Format tool results for display
   * @param {Object[]} results - Tool execution results
   * @returns {string} Formatted results
   */
  formatResults(results) {
    const formatted = [];
    
    for (const result of results) {
      const data = JSON.parse(result.content);
      if (data.success) {
        formatted.push(`✅ ${JSON.stringify(data.result, null, 2)}`);
      } else {
        formatted.push(`❌ Error: ${data.error}`);
      }
    }
    
    return formatted.join('\n\n');
  }
}