import { BaseTool, ToolPermissions } from '../base-tool.js';
import { TaskwerkAPI } from '../../../api/taskwerk-api.js';

export class UpdateTaskTool extends BaseTool {
  constructor(config = {}) {
    super({
      ...config,
      description: 'Update an existing task',
      permissions: [ToolPermissions.MODIFY_TASKS],
    });
    this.api = new TaskwerkAPI();
  }

  getParameters() {
    return {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Task ID to update',
        },
        name: {
          type: 'string',
          description: 'New task name',
        },
        status: {
          type: 'string',
          enum: ['todo', 'in-progress', 'done', 'blocked', 'cancelled'],
          description: 'New status',
        },
        priority: {
          type: 'string',
          enum: ['high', 'medium', 'low'],
          description: 'New priority',
        },
        assignee: {
          type: 'string',
          description: 'New assignee',
        },
        category: {
          type: 'string',
          description: 'New category',
        },
        add_tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags to add',
        },
        remove_tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags to remove',
        },
        add_note: {
          type: 'string',
          description: 'Note to add to the task',
        },
      },
      required: ['id'],
    };
  }

  async execute(params) {
    const { id, add_tags, remove_tags, add_note, ...updates } = params;

    // Update basic fields
    if (Object.keys(updates).length > 0) {
      await this.api.updateTask(id, updates);
    }

    // Handle tags
    if (add_tags && add_tags.length > 0) {
      await this.api.addTags(id, add_tags);
    }
    if (remove_tags && remove_tags.length > 0) {
      await this.api.removeTags(id, remove_tags);
    }

    // Add note
    if (add_note) {
      await this.api.addNote(id, add_note);
    }

    // Get updated task
    const task = await this.api.getTask(id);

    return {
      id: task.id,
      name: task.name,
      status: task.status,
      priority: task.priority,
      updated: true,
    };
  }

  requiresPermission(params) {
    const actions = [];
    if (params.name) {
      actions.push('rename');
    }
    if (params.status) {
      actions.push(`change status to ${params.status}`);
    }
    if (params.priority) {
      actions.push(`change priority to ${params.priority}`);
    }

    return `Update task ${params.id}: ${actions.join(', ')}`;
  }
}
