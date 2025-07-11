import { describe, it, expect } from 'vitest';
import {
  InvalidTaskIdError,
  InvalidTaskStatusError,
  InvalidTaskPriorityError,
  MissingTaskNameError,
  InvalidProgressError,
  TaskNotFoundError,
  DuplicateTaskIdError,
  TaskDependencyError,
  CannotDeleteTaskError,
  CannotUpdateTaskError,
  CircularDependencyError,
} from '../../src/errors/task-errors.js';

describe('Task Error Classes', () => {
  describe('Validation Errors', () => {
    it('should create InvalidTaskIdError', () => {
      const error = new InvalidTaskIdError('invalid-id');

      expect(error.message).toBe('Invalid task ID format: invalid-id');
      expect(error.code).toBe('INVALID_TASK_ID');
      expect(error.statusCode).toBe(400);
      expect(error.details.field).toBe('id');
      expect(error.details.value).toBe('invalid-id');
    });

    it('should create InvalidTaskStatusError', () => {
      const error = new InvalidTaskStatusError('invalid');

      expect(error.message).toContain('Invalid task status: invalid');
      expect(error.message).toContain('Must be one of: todo, in-progress, blocked, done');
      expect(error.code).toBe('INVALID_STATUS');
    });

    it('should create InvalidTaskPriorityError', () => {
      const error = new InvalidTaskPriorityError('urgent');

      expect(error.message).toContain('Invalid task priority: urgent');
      expect(error.message).toContain('Must be one of: low, medium, high, critical');
      expect(error.code).toBe('INVALID_PRIORITY');
    });

    it('should create MissingTaskNameError', () => {
      const error = new MissingTaskNameError();

      expect(error.message).toBe('Task name is required');
      expect(error.code).toBe('MISSING_REQUIRED_FIELD');
      expect(error.details.field).toBe('name');
    });

    it('should create InvalidProgressError', () => {
      const error = new InvalidProgressError(150);

      expect(error.message).toBe('Invalid progress value: 150. Must be between 0 and 100');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details.field).toBe('progress');
      expect(error.details.value).toBe(150);
    });
  });

  describe('Database Errors', () => {
    it('should create TaskNotFoundError', () => {
      const error = new TaskNotFoundError('TASK-123');

      expect(error.message).toBe('Task not found: TASK-123');
      expect(error.code).toBe('TASK_NOT_FOUND');
      expect(error.statusCode).toBe(404);
      expect(error.details.operation).toBe('SELECT');
    });

    it('should create DuplicateTaskIdError', () => {
      const error = new DuplicateTaskIdError('TASK-123');

      expect(error.message).toBe('Task with ID TASK-123 already exists');
      expect(error.code).toBe('DUPLICATE_TASK_ID');
      expect(error.statusCode).toBe(409);
      expect(error.details.operation).toBe('INSERT');
    });

    it('should create TaskDependencyError', () => {
      const error = new TaskDependencyError('TASK-123', 'TASK-456', 'Task does not exist');

      expect(error.message).toBe(
        'Cannot create dependency: TASK-123 -> TASK-456. Task does not exist'
      );
      expect(error.code).toBe('INVALID_DEPENDENCY');
      expect(error.details.taskId).toBe('TASK-123');
      expect(error.details.dependsOnId).toBe('TASK-456');
    });
  });

  describe('Operation Errors', () => {
    it('should create CannotDeleteTaskError', () => {
      const error = new CannotDeleteTaskError('TASK-123', 'Has active dependencies');

      expect(error.message).toBe('Cannot delete task TASK-123: Has active dependencies');
      expect(error.code).toBe('TASK_OPERATION_ERROR');
      expect(error.details.operation).toBe('DELETE');
      expect(error.details.taskId).toBe('TASK-123');
    });

    it('should create CannotUpdateTaskError', () => {
      const error = new CannotUpdateTaskError('TASK-123', 'Task is locked');

      expect(error.message).toBe('Cannot update task TASK-123: Task is locked');
      expect(error.code).toBe('TASK_OPERATION_ERROR');
      expect(error.details.operation).toBe('UPDATE');
      expect(error.details.taskId).toBe('TASK-123');
    });

    it('should create CircularDependencyError', () => {
      const error = new CircularDependencyError('TASK-123', 'TASK-456');

      expect(error.message).toBe('Circular dependency detected between TASK-123 and TASK-456');
      expect(error.code).toBe('TASK_OPERATION_ERROR');
      expect(error.details.operation).toBe('ADD_DEPENDENCY');
      expect(error.details.taskId).toBe('TASK-123');
      expect(error.details.dependsOnId).toBe('TASK-456');
    });
  });
});
