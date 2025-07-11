import { TaskwerkError, ValidationError, DatabaseError } from './base-error.js';

/**
 * Task-specific validation errors
 */
export class InvalidTaskIdError extends ValidationError {
  constructor(taskId) {
    super(`Invalid task ID format: ${taskId}`, 'id', taskId);
    this.code = 'INVALID_TASK_ID';
  }
}

export class InvalidTaskStatusError extends ValidationError {
  constructor(status) {
    super(
      `Invalid task status: ${status}. Must be one of: todo, in-progress, blocked, done`,
      'status',
      status
    );
    this.code = 'INVALID_STATUS';
  }
}

export class InvalidTaskPriorityError extends ValidationError {
  constructor(priority) {
    super(
      `Invalid task priority: ${priority}. Must be one of: low, medium, high, critical`,
      'priority',
      priority
    );
    this.code = 'INVALID_PRIORITY';
  }
}

export class MissingTaskNameError extends ValidationError {
  constructor() {
    super('Task name is required', 'name', null);
    this.code = 'MISSING_REQUIRED_FIELD';
  }
}

export class InvalidProgressError extends ValidationError {
  constructor(progress) {
    super(`Invalid progress value: ${progress}. Must be between 0 and 100`, 'progress', progress);
    this.code = 'VALIDATION_ERROR';
  }
}

/**
 * Task database errors
 */
export class TaskNotFoundError extends DatabaseError {
  constructor(taskId) {
    super(`Task not found: ${taskId}`, 'SELECT', null);
    this.code = 'TASK_NOT_FOUND';
    this.statusCode = 404;
  }
}

export class DuplicateTaskIdError extends DatabaseError {
  constructor(taskId) {
    super(`Task with ID ${taskId} already exists`, 'INSERT', null);
    this.code = 'DUPLICATE_TASK_ID';
    this.statusCode = 409;
  }
}

export class TaskDependencyError extends DatabaseError {
  constructor(taskId, dependsOnId, reason) {
    super(
      `Cannot create dependency: ${taskId} -> ${dependsOnId}. ${reason}`,
      'INSERT',
      'task_dependencies'
    );
    this.code = 'INVALID_DEPENDENCY';
    this.details.taskId = taskId;
    this.details.dependsOnId = dependsOnId;
  }
}

/**
 * Task operation errors
 */
export class TaskOperationError extends TaskwerkError {
  constructor(message, operation, taskId) {
    super(message, 'TASK_OPERATION_ERROR', 400, { operation, taskId });
  }
}

export class CannotDeleteTaskError extends TaskOperationError {
  constructor(taskId, reason) {
    super(`Cannot delete task ${taskId}: ${reason}`, 'DELETE', taskId);
  }
}

export class CannotUpdateTaskError extends TaskOperationError {
  constructor(taskId, reason) {
    super(`Cannot update task ${taskId}: ${reason}`, 'UPDATE', taskId);
  }
}

export class CircularDependencyError extends TaskOperationError {
  constructor(taskId, dependsOnId) {
    super(
      `Circular dependency detected between ${taskId} and ${dependsOnId}`,
      'ADD_DEPENDENCY',
      taskId
    );
    this.details.dependsOnId = dependsOnId;
  }
}
