export class TaskWerkToolRegistry {
  constructor(taskManager) {
    this.taskManager = taskManager;
    this.tools = this.defineTools();
  }

  defineTools() {
    return [
      {
        name: 'taskwerk_add',
        description: 'Add a new task to the task list',
        parameters: {
          type: 'object',
          properties: {
            description: {
              type: 'string',
              description: 'The task description',
            },
            priority: {
              type: 'string',
              enum: ['high', 'medium', 'low'],
              description: 'Task priority level',
            },
            category: {
              type: 'string',
              description: 'Task category (optional)',
            },
          },
          required: ['description'],
        },
      },
      {
        name: 'taskwerk_list',
        description: 'List tasks with optional filters',
        parameters: {
          type: 'object',
          properties: {
            priority: {
              type: 'string',
              enum: ['high', 'medium', 'low'],
              description: 'Filter by priority level',
            },
            category: {
              type: 'string',
              description: 'Filter by category (partial match)',
            },
            completed: {
              type: 'boolean',
              description: 'Show completed tasks instead of active',
            },
          },
          required: [],
        },
      },
      {
        name: 'taskwerk_start',
        description: 'Start working on a task (mark as in-progress)',
        parameters: {
          type: 'object',
          properties: {
            taskId: {
              type: 'string',
              description: 'Task ID (e.g., TASK-001)',
            },
          },
          required: ['taskId'],
        },
      },
      {
        name: 'taskwerk_complete',
        description: 'Mark a task as completed',
        parameters: {
          type: 'object',
          properties: {
            taskId: {
              type: 'string',
              description: 'Task ID (e.g., TASK-001)',
            },
            note: {
              type: 'string',
              description: 'Optional completion note',
            },
          },
          required: ['taskId'],
        },
      },
      {
        name: 'taskwerk_pause',
        description: 'Pause a task (return to todo state)',
        parameters: {
          type: 'object',
          properties: {
            taskId: {
              type: 'string',
              description: 'Task ID (e.g., TASK-001)',
            },
          },
          required: ['taskId'],
        },
      },
      {
        name: 'taskwerk_status',
        description: 'Show current session status and active tasks',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'taskwerk_stats',
        description: 'Show task statistics and overview',
        parameters: {
          type: 'object',
          properties: {
            format: {
              type: 'string',
              enum: ['markdown', 'plain'],
              description: 'Output format',
            },
          },
          required: [],
        },
      },
      {
        name: 'taskwerk_search',
        description: 'Search task descriptions',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query',
            },
          },
          required: ['query'],
        },
      },
    ];
  }

  async executeTool(toolName, parameters) {
    switch (toolName) {
      case 'taskwerk_add':
        return this.taskManager.addTask(
          parameters.description,
          parameters.priority || 'medium',
          parameters.category
        );

      case 'taskwerk_list':
        return this.taskManager.listTasks({
          priority: parameters.priority,
          category: parameters.category,
          completed: parameters.completed,
        });

      case 'taskwerk_start':
        return this.taskManager.startTask(parameters.taskId);

      case 'taskwerk_complete':
        return this.taskManager.completeTask(parameters.taskId, parameters.note);

      case 'taskwerk_pause':
        return this.taskManager.pauseTask(parameters.taskId);

      case 'taskwerk_status':
        return this.taskManager.getStatus();

      case 'taskwerk_stats':
        return this.taskManager.getStats(parameters.format);

      case 'taskwerk_search':
        return this.taskManager.searchTasks(parameters.query);

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  getToolSchemas() {
    return this.tools;
  }

  validateParameters(toolName, parameters) {
    const tool = this.tools.find(t => t.name === toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    for (const required of tool.parameters.required) {
      if (!(required in parameters)) {
        throw new Error(`Missing required parameter: ${required}`);
      }
    }

    return true;
  }
}
