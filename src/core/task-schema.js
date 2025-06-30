/**
 * TaskWerk v2.0 Task Schema Definition
 *
 * Defines the complete v2 task structure with validation, defaults,
 * and schema enforcement for enhanced task management.
 */

export class TaskSchema {
  /**
   * Get the complete v2 task schema definition
   */
  static getV2Schema() {
    return {
      // Core identification and metadata
      id: {
        type: 'string',
        required: true,
        pattern: /^TASK-\d{3}$/,
        description: 'Unique task identifier (e.g., TASK-001)',
      },

      description: {
        type: 'string',
        required: true,
        minLength: 1,
        maxLength: 200,
        description: 'Brief task description',
      },

      // Status and lifecycle
      status: {
        type: 'string',
        required: true,
        enum: ['todo', 'in_progress', 'completed', 'blocked', 'archived'],
        default: 'todo',
        description: 'Current task status',
      },

      priority: {
        type: 'string',
        required: false,
        enum: ['high', 'medium', 'low'],
        default: 'medium',
        description: 'Task priority level',
      },

      category: {
        type: 'string',
        required: false,
        enum: ['bugs', 'features', 'docs', 'refactor', 'test', 'chore'],
        description: 'Task category for organization',
      },

      // Timestamps and versioning
      created: {
        type: 'date',
        required: true,
        description: 'Task creation timestamp',
      },

      updated: {
        type: 'date',
        required: false,
        description: 'Last modification timestamp',
      },

      // Assignment and ownership
      assignee: {
        type: 'string',
        required: false,
        pattern: /^@[\w-]+$/,
        description: 'Assigned team member (e.g., @johndoe)',
      },

      // Dependencies and relationships
      dependencies: {
        type: 'array',
        required: false,
        items: {
          type: 'string',
          pattern: /^TASK-\d{3}$/,
        },
        default: [],
        description: 'Array of task IDs this task depends on',
      },

      // Time estimation and tracking
      estimated: {
        type: 'string',
        required: false,
        pattern: /^\d+[hdwm]$/,
        description: 'Time estimate (e.g., 2h, 3d, 1w)',
      },

      // Timeline and audit trail
      timeline: {
        type: 'array',
        required: false,
        items: {
          type: 'object',
          properties: {
            timestamp: { type: 'string', format: 'date-time' },
            action: {
              type: 'string',
              enum: [
                'created',
                'started',
                'paused',
                'resumed',
                'completed',
                'blocked',
                'unblocked',
                'archived',
              ],
            },
            note: { type: 'string' },
            user: { type: 'string' },
          },
        },
        default: [],
        description: 'Chronological timeline of task events',
      },

      // Git integration
      git: {
        type: 'object',
        required: false,
        properties: {
          commits: {
            type: 'array',
            items: { type: 'string' },
            default: [],
          },
          branch: { type: 'string' },
          pullRequest: { type: 'string' },
        },
        default: { commits: [] },
        description: 'Git-related metadata',
      },

      // File tracking
      files: {
        type: 'array',
        required: false,
        items: { type: 'string' },
        default: [],
        description: 'Files associated with this task',
      },

      // Subtask hierarchy
      subtasks: {
        type: 'array',
        required: false,
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', pattern: /^TASK-\d{3}\.\d+$/ },
            description: { type: 'string' },
            status: { type: 'string', enum: ['todo', 'in_progress', 'completed', 'blocked'] },
            assignee: { type: 'string' },
          },
        },
        default: [],
        description: 'Subtasks for breaking down complex work',
      },

      // Content and documentation
      markdownContent: {
        type: 'string',
        required: false,
        description: 'Full markdown content (acceptance criteria, notes, etc.)',
      },

      // Status-specific fields for completed tasks
      completedAt: {
        type: 'date',
        required: false,
        description: 'Completion timestamp (for completed tasks)',
      },

      note: {
        type: 'string',
        required: false,
        description: 'Completion or status notes',
      },

      filesChanged: {
        type: 'array',
        required: false,
        items: { type: 'string' },
        description: 'Files modified during task completion',
      },

      // Status-specific fields for archived tasks
      archivedAt: {
        type: 'date',
        required: false,
        description: 'Archive timestamp (for archived tasks)',
      },

      archiveReason: {
        type: 'string',
        required: false,
        description: 'Reason for archiving the task',
      },

      supersededBy: {
        type: 'string',
        required: false,
        pattern: /^TASK-\d{3}$/,
        description: 'Task ID that supersedes this one',
      },

      // Format tracking
      format: {
        type: 'string',
        required: false,
        enum: ['v1', 'v2'],
        default: 'v2',
        description: 'Task format version for migration tracking',
      },
    };
  }

  /**
   * Create a new v2 task with defaults
   */
  static createV2Task(data = {}) {
    const now = new Date();
    const schema = this.getV2Schema();

    // Start with schema defaults
    const task = {};
    Object.keys(schema).forEach(key => {
      if (schema[key].default !== undefined) {
        task[key] = Array.isArray(schema[key].default)
          ? [...schema[key].default]
          : typeof schema[key].default === 'object'
            ? { ...schema[key].default }
            : schema[key].default;
      }
    });

    // Apply required defaults
    task.created = now;
    task.format = 'v2';

    // Override with provided data
    Object.assign(task, data);

    // Ensure dates are Date objects
    if (task.created && typeof task.created === 'string') {
      task.created = new Date(task.created);
    }
    if (task.updated && typeof task.updated === 'string') {
      task.updated = new Date(task.updated);
    }
    if (task.completedAt && typeof task.completedAt === 'string') {
      task.completedAt = new Date(task.completedAt);
    }
    if (task.archivedAt && typeof task.archivedAt === 'string') {
      task.archivedAt = new Date(task.archivedAt);
    }

    return task;
  }

  /**
   * Validate a v2 task against the schema
   */
  static validateV2Task(task) {
    // Handle null/undefined input
    if (!task || typeof task !== 'object' || Array.isArray(task)) {
      return {
        valid: false,
        errors: ['Task must be a valid object'],
      };
    }

    const schema = this.getV2Schema();
    const errors = [];

    // Check required fields
    Object.keys(schema).forEach(key => {
      const fieldSchema = schema[key];
      const value = task[key];

      if (fieldSchema.required && (value === undefined || value === null)) {
        errors.push(`Field '${key}' is required`);
        return;
      }

      if (value === undefined || value === null) {
        return; // Skip optional fields that are not set
      }

      // Type validation
      if (!this.validateFieldType(value, fieldSchema, key)) {
        errors.push(`Field '${key}' has invalid type or format`);
      }
    });

    // Status-specific validation
    const statusErrors = this.validateStatusSpecificFields(task);
    errors.push(...statusErrors);

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate field type and format
   */
  static validateFieldType(value, fieldSchema, fieldName) {
    switch (fieldSchema.type) {
      case 'string':
        if (typeof value !== 'string') {
          return false;
        }
        if (fieldSchema.minLength && value.length < fieldSchema.minLength) {
          return false;
        }
        if (fieldSchema.maxLength && value.length > fieldSchema.maxLength) {
          return false;
        }
        if (fieldSchema.pattern && !fieldSchema.pattern.test(value)) {
          return false;
        }
        if (fieldSchema.enum && !fieldSchema.enum.includes(value)) {
          return false;
        }
        return true;

      case 'array':
        if (!Array.isArray(value)) {
          return false;
        }
        if (fieldSchema.items) {
          return value.every(item =>
            this.validateFieldType(item, fieldSchema.items, `${fieldName}[]`)
          );
        }
        return true;

      case 'object':
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          return false;
        }
        if (fieldSchema.properties) {
          return Object.keys(fieldSchema.properties).every(prop => {
            if (value[prop] === undefined) {
              return true;
            } // Optional properties
            return this.validateFieldType(
              value[prop],
              fieldSchema.properties[prop],
              `${fieldName}.${prop}`
            );
          });
        }
        return true;

      case 'date':
        return value instanceof Date || !isNaN(Date.parse(value));

      default:
        return true;
    }
  }

  /**
   * Validate status-specific field requirements
   */
  static validateStatusSpecificFields(task) {
    const errors = [];

    switch (task.status) {
      case 'completed':
        if (!task.completedAt) {
          errors.push("Completed tasks must have 'completedAt' timestamp");
        }
        break;

      case 'archived':
        if (!task.archivedAt) {
          errors.push("Archived tasks must have 'archivedAt' timestamp");
        }
        if (!task.archiveReason) {
          errors.push("Archived tasks must have 'archiveReason'");
        }
        break;
    }

    return errors;
  }

  /**
   * Get field description for help/documentation
   */
  static getFieldDescription(fieldName) {
    const schema = this.getV2Schema();
    return schema[fieldName]?.description || 'No description available';
  }

  /**
   * Get all valid values for enum fields
   */
  static getValidValues(fieldName) {
    const schema = this.getV2Schema();
    return schema[fieldName]?.enum || null;
  }

  /**
   * Check if field is required
   */
  static isFieldRequired(fieldName) {
    const schema = this.getV2Schema();
    return schema[fieldName]?.required === true;
  }

  /**
   * Get default value for a field
   */
  static getFieldDefault(fieldName) {
    const schema = this.getV2Schema();
    return schema[fieldName]?.default;
  }

  /**
   * Sanitize and normalize task data
   */
  static sanitizeTask(task) {
    const sanitized = { ...task };

    // Normalize status
    if (sanitized.status) {
      sanitized.status = sanitized.status.toLowerCase();
    }

    // Normalize priority
    if (sanitized.priority) {
      sanitized.priority = sanitized.priority.toLowerCase();
    }

    // Normalize category
    if (sanitized.category) {
      sanitized.category = sanitized.category.toLowerCase();
    }

    // Ensure arrays exist
    if (!sanitized.dependencies) {
      sanitized.dependencies = [];
    }
    if (!sanitized.timeline) {
      sanitized.timeline = [];
    }
    if (!sanitized.files) {
      sanitized.files = [];
    }
    if (!sanitized.subtasks) {
      sanitized.subtasks = [];
    }
    if (!sanitized.git) {
      sanitized.git = { commits: [] };
    }
    if (!sanitized.git.commits) {
      sanitized.git.commits = [];
    }

    // Remove empty strings and null values
    Object.keys(sanitized).forEach(key => {
      if (sanitized[key] === '' || sanitized[key] === null) {
        delete sanitized[key];
      }
    });

    return sanitized;
  }

  /**
   * Convert legacy v1 task to v2 schema
   */
  static convertV1ToV2(v1Task) {
    const v2Task = this.createV2Task({
      id: v1Task.id,
      description: v1Task.description,
      status: v1Task.status,
      priority: v1Task.priority || 'medium',
      category: v1Task.category,
      created: v1Task.created || new Date(),
    });

    // Handle status-specific fields
    if (v1Task.status === 'completed' && v1Task.completedAt) {
      v2Task.completedAt = new Date(v1Task.completedAt);
      v2Task.note = v1Task.note;
      v2Task.filesChanged = v1Task.filesChanged || [];
      v2Task.files = v1Task.filesChanged || [];
    }

    if (v1Task.status === 'archived' && v1Task.archivedAt) {
      v2Task.archivedAt = new Date(v1Task.archivedAt);
      v2Task.archiveReason = v1Task.archiveReason || 'Migrated from v1';
      v2Task.supersededBy = v1Task.supersededBy;
      v2Task.note = v1Task.note;
    }

    return v2Task;
  }
}
