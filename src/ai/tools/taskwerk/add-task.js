import { BaseTool, ToolPermissions } from '../base-tool.js';
import { TaskwerkAPI } from '../../../api/taskwerk-api.js';

export class AddTaskTool extends BaseTool {
  constructor(config = {}) {
    super({
      ...config,
      description: 'Create a new task',
      permissions: [ToolPermissions.MODIFY_TASKS],
    });
    this.api = new TaskwerkAPI();
  }

  getParameters() {
    return {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Task name/description',
        },
        priority: {
          type: 'string',
          enum: ['high', 'medium', 'low'],
          description: 'Task priority',
          default: 'medium',
        },
        assignee: {
          type: 'string',
          description: 'Person assigned to the task',
        },
        category: {
          type: 'string',
          description: 'Task category',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Task tags',
        },
        parent_id: {
          type: 'string',
          description: 'Parent task ID for subtasks',
        },
        notes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Initial notes for the task',
        },
      },
      required: ['name'],
    };
  }

  async execute(params) {
    const task = await this.api.createTask({
      name: params.name,
      priority: params.priority || 'medium',
      assignee: params.assignee,
      category: params.category,
      parent_id: params.parent_id,
    });

    // Add tags if provided
    if (params.tags && params.tags.length > 0) {
      await this.api.addTags(task.id, params.tags);
    }

    // Add notes if provided
    if (params.notes && params.notes.length > 0) {
      for (const note of params.notes) {
        await this.api.addNote(task.id, note);
      }
    }

    return {
      id: task.id,
      name: task.name,
      status: task.status,
      priority: task.priority,
      created: true,
    };
  }

  requiresPermission(params) {
    return `Create task: "${params.name}"`;
  }
}
