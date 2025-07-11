// Base error classes
export {
  TaskwerkError,
  ValidationError,
  DatabaseError,
  FileSystemError,
  ConfigurationError,
  CLIError,
} from './base-error.js';

// Task-specific errors
export {
  InvalidTaskIdError,
  InvalidTaskStatusError,
  InvalidTaskPriorityError,
  MissingTaskNameError,
  InvalidProgressError,
  TaskNotFoundError,
  DuplicateTaskIdError,
  TaskDependencyError,
  TaskOperationError,
  CannotDeleteTaskError,
  CannotUpdateTaskError,
  CircularDependencyError,
} from './task-errors.js';

// Error handling utilities
export {
  ErrorResponse,
  ErrorHandler,
  withErrorHandling,
  errorMiddleware,
} from './error-handler.js';

// Error logging
export { ErrorLogger, getErrorLogger, withErrorLogging } from './error-logger.js';

// Error recovery
export { ErrorRecovery, withRetry, CircuitBreaker } from './error-recovery.js';
