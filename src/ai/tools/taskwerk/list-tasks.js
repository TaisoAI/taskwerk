import { BaseTool } from '../base-tool.js';
import { TaskwerkAPI } from '../../../api/taskwerk-api.js';

export class ListTasksTool extends BaseTool {
  constructor(config = {}) {
    super({
      ...config,
      description: 'List tasks with optional filters',
      permissions: [], // Read-only, no permissions needed
    });
    this.api = new TaskwerkAPI();
  }

  getParameters() {
    return {
      type: 'object',
      properties: {
        status: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['todo', 'in-progress', 'done', 'blocked', 'cancelled'],
          },
          description: 'Filter by status',
        },
        priority: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['high', 'medium', 'low'],
          },
          description: 'Filter by priority',
        },
        assignee: {
          type: 'string',
          description: 'Filter by assignee',
        },
        category: {
          type: 'string',
          description: 'Filter by category',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by tags',
        },
        limit: {
          type: 'integer',
          description: 'Maximum number of results',
          minimum: 1,
          maximum: 100,
          default: 20,
        },
      },
    };
  }

  async execute(params) {
    const tasks = this.api.listTasks({
      status: params.status,
      priority: params.priority,
      assignee: params.assignee,
      category: params.category,
      tags: params.tags,
      limit: params.limit || 20,
      orderBy: 'created_at',
      orderDir: 'DESC',
    });

    return tasks.map(task => ({
      id: task.id,
      name: task.name,
      status: task.status,
      priority: task.priority,
      assignee: task.assignee,
      category: task.category,
      tags: task.tags || [],
      created: task.created_at,
      updated: task.updated_at,
    }));
  }
}
