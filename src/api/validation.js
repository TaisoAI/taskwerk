import { ValidationError } from '../errors/base-error.js';
import { isValidTaskId } from '../db/task-id.js';

export class ValidationRules {
  static TASK_STATUS = [
    'todo',
    'in-progress',
    'in_progress',
    'blocked',
    'done',
    'completed',
    'cancelled',
  ];
  static TASK_PRIORITY = ['low', 'medium', 'high', 'critical'];
  static TASK_ID_PATTERN = /^[A-Z]+-\d+(\.\d+)?$/;
  static EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  static URL_PATTERN = /^https?:\/\/.+/;
}

export class Validator {
  constructor() {
    this.errors = [];
  }

  /**
   * Reset validation errors
   */
  reset() {
    this.errors = [];
    return this;
  }

  /**
   * Add validation error
   * @param {string} field - Field name
   * @param {string} message - Error message
   */
  addError(field, message) {
    this.errors.push({ field, message });
  }

  /**
   * Check if validation has errors
   * @returns {boolean}
   */
  hasErrors() {
    return this.errors.length > 0;
  }

  /**
   * Get all validation errors
   * @returns {Array}
   */
  getErrors() {
    return this.errors;
  }

  /**
   * Throw validation error if there are any errors
   */
  throwIfErrors() {
    if (this.hasErrors()) {
      const messages = this.errors.map(err => `${err.field}: ${err.message}`);
      throw new ValidationError(`Validation failed: ${messages.join(', ')}`);
    }
  }

  /**
   * Validate required field
   * @param {string} field - Field name
   * @param {*} value - Field value
   * @returns {Validator}
   */
  required(field, value) {
    if (value === null || value === undefined || value === '') {
      this.addError(field, 'is required');
    }
    return this;
  }

  /**
   * Validate string length
   * @param {string} field - Field name
   * @param {string} value - Field value
   * @param {number} min - Minimum length
   * @param {number} max - Maximum length
   * @returns {Validator}
   */
  length(field, value, min = 0, max = null) {
    if (typeof value !== 'string') {
      this.addError(field, 'must be a string');
      return this;
    }

    if (value.length < min) {
      this.addError(field, `must be at least ${min} characters long`);
    }

    if (max !== null && value.length > max) {
      this.addError(field, `must be no more than ${max} characters long`);
    }

    return this;
  }

  /**
   * Validate number range
   * @param {string} field - Field name
   * @param {number} value - Field value
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {Validator}
   */
  range(field, value, min = null, max = null) {
    if (typeof value !== 'number' || isNaN(value)) {
      this.addError(field, 'must be a valid number');
      return this;
    }

    if (min !== null && value < min) {
      this.addError(field, `must be at least ${min}`);
    }

    if (max !== null && value > max) {
      this.addError(field, `must be no more than ${max}`);
    }

    return this;
  }

  /**
   * Validate value is in allowed list
   * @param {string} field - Field name
   * @param {*} value - Field value
   * @param {Array} allowed - Allowed values
   * @returns {Validator}
   */
  oneOf(field, value, allowed) {
    if (!allowed.includes(value)) {
      this.addError(field, `must be one of: ${allowed.join(', ')}`);
    }
    return this;
  }

  /**
   * Validate pattern match
   * @param {string} field - Field name
   * @param {string} value - Field value
   * @param {RegExp} pattern - Pattern to match
   * @param {string} message - Custom error message
   * @returns {Validator}
   */
  pattern(field, value, pattern, message = 'has invalid format') {
    if (typeof value !== 'string' || !pattern.test(value)) {
      this.addError(field, message);
    }
    return this;
  }

  /**
   * Validate task ID format
   * @param {string} field - Field name
   * @param {string} value - Field value
   * @returns {Validator}
   */
  taskId(field, value) {
    if (!isValidTaskId(value)) {
      this.addError(field, 'must be a valid task ID (e.g., TASK-123)');
    }
    return this;
  }

  /**
   * Validate email format
   * @param {string} field - Field name
   * @param {string} value - Field value
   * @returns {Validator}
   */
  email(field, value) {
    return this.pattern(
      field,
      value,
      ValidationRules.EMAIL_PATTERN,
      'must be a valid email address'
    );
  }

  /**
   * Validate URL format
   * @param {string} field - Field name
   * @param {string} value - Field value
   * @returns {Validator}
   */
  url(field, value) {
    return this.pattern(field, value, ValidationRules.URL_PATTERN, 'must be a valid URL');
  }

  /**
   * Validate date format
   * @param {string} field - Field name
   * @param {string} value - Field value
   * @returns {Validator}
   */
  date(field, value) {
    if (typeof value !== 'string' || isNaN(Date.parse(value))) {
      this.addError(field, 'must be a valid date');
    }
    return this;
  }

  /**
   * Validate JSON string
   * @param {string} field - Field name
   * @param {string} value - Field value
   * @returns {Validator}
   */
  json(field, value) {
    if (typeof value !== 'string') {
      this.addError(field, 'must be a JSON string');
      return this;
    }

    try {
      JSON.parse(value);
    } catch (error) {
      this.addError(field, 'must be valid JSON');
    }

    return this;
  }
}

/**
 * Task data validator
 */
export class TaskValidator {
  /**
   * Validate task creation data
   * @param {Object} taskData - Task data to validate
   * @returns {Object} Validation result
   */
  static validateCreate(taskData) {
    const validator = new Validator();

    // Required fields
    validator.required('name', taskData.name);

    // Name validation
    if (taskData.name) {
      validator.length('name', taskData.name, 1, 255);
    }

    // Optional field validations
    if (taskData.id) {
      validator.taskId('id', taskData.id);
    }

    if (taskData.description) {
      validator.length('description', taskData.description, 0, 1000);
    }

    if (taskData.status) {
      validator.oneOf('status', taskData.status, ValidationRules.TASK_STATUS);
    }

    if (taskData.priority) {
      validator.oneOf('priority', taskData.priority, ValidationRules.TASK_PRIORITY);
    }

    if (taskData.assignee) {
      validator.length('assignee', taskData.assignee, 1, 100);
    }

    if (taskData.estimate !== null && taskData.estimate !== undefined) {
      validator.range('estimate', taskData.estimate, 0);
    }

    if (taskData.actual !== null && taskData.actual !== undefined) {
      validator.range('actual', taskData.actual, 0);
    }

    if (taskData.progress !== null && taskData.progress !== undefined) {
      validator.range('progress', taskData.progress, 0, 100);
    }

    if (taskData.parent_id) {
      validator.taskId('parent_id', taskData.parent_id);
    }

    if (taskData.due_date) {
      validator.date('due_date', taskData.due_date);
    }

    if (taskData.content) {
      validator.length('content', taskData.content, 0, 10000);
    }

    if (taskData.category) {
      validator.length('category', taskData.category, 1, 50);
    }

    if (taskData.metadata) {
      if (typeof taskData.metadata === 'string') {
        validator.json('metadata', taskData.metadata);
      } else if (typeof taskData.metadata !== 'object') {
        validator.addError('metadata', 'must be an object or JSON string');
      }
    }

    if (taskData.context) {
      if (typeof taskData.context === 'string') {
        validator.json('context', taskData.context);
      } else if (typeof taskData.context !== 'object') {
        validator.addError('context', 'must be an object or JSON string');
      }
    }

    return {
      isValid: !validator.hasErrors(),
      errors: validator.getErrors(),
    };
  }

  /**
   * Validate task update data
   * @param {Object} updateData - Update data to validate
   * @returns {Object} Validation result
   */
  static validateUpdate(updateData) {
    const validator = new Validator();

    // Cannot update ID
    if (updateData.id !== undefined) {
      validator.addError('id', 'cannot be updated');
    }

    // Field validations (same as create but all optional)
    if (updateData.name !== undefined) {
      validator.required('name', updateData.name);
      if (updateData.name) {
        validator.length('name', updateData.name, 1, 255);
      }
    }

    if (updateData.description !== undefined && updateData.description !== null) {
      validator.length('description', updateData.description, 0, 1000);
    }

    if (updateData.status !== undefined) {
      validator.oneOf('status', updateData.status, ValidationRules.TASK_STATUS);
    }

    if (updateData.priority !== undefined) {
      validator.oneOf('priority', updateData.priority, ValidationRules.TASK_PRIORITY);
    }

    if (updateData.assignee !== undefined && updateData.assignee !== null) {
      validator.length('assignee', updateData.assignee, 1, 100);
    }

    if (updateData.estimate !== undefined && updateData.estimate !== null) {
      validator.range('estimate', updateData.estimate, 0);
    }

    if (updateData.actual !== undefined && updateData.actual !== null) {
      validator.range('actual', updateData.actual, 0);
    }

    if (updateData.progress !== undefined && updateData.progress !== null) {
      validator.range('progress', updateData.progress, 0, 100);
    }

    if (updateData.parent_id !== undefined && updateData.parent_id !== null) {
      validator.taskId('parent_id', updateData.parent_id);
    }

    if (updateData.due_date !== undefined && updateData.due_date !== null) {
      validator.date('due_date', updateData.due_date);
    }

    if (updateData.content !== undefined && updateData.content !== null) {
      validator.length('content', updateData.content, 0, 10000);
    }

    if (updateData.category !== undefined && updateData.category !== null) {
      validator.length('category', updateData.category, 1, 50);
    }

    if (updateData.metadata !== undefined) {
      if (typeof updateData.metadata === 'string') {
        validator.json('metadata', updateData.metadata);
      } else if (updateData.metadata !== null && typeof updateData.metadata !== 'object') {
        validator.addError('metadata', 'must be an object or JSON string');
      }
    }

    if (updateData.context !== undefined) {
      if (typeof updateData.context === 'string') {
        validator.json('context', updateData.context);
      } else if (updateData.context !== null && typeof updateData.context !== 'object') {
        validator.addError('context', 'must be an object or JSON string');
      }
    }

    return {
      isValid: !validator.hasErrors(),
      errors: validator.getErrors(),
    };
  }
}
