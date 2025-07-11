import { TaskwerkError } from './base-error.js';

/**
 * Error response structure for verbose error output
 */
export class ErrorResponse {
  constructor(status, code, reason, description, details = {}) {
    this.status = status; // 'success', 'warning', 'error'
    this.code = code;
    this.reason = reason;
    this.description = description;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      status: this.status,
      code: this.code,
      reason: this.reason,
      description: this.description,
      details: this.details,
      timestamp: this.timestamp,
    };
  }

  toString() {
    if (process.env.TASKWERK_OUTPUT_FORMAT === 'json' || this.isVerboseError()) {
      return JSON.stringify(this.toJSON(), null, 2);
    }
    return `${this.status.toUpperCase()}: ${this.reason}`;
  }

  isVerboseError() {
    // Check if --verbose-error flag was passed
    return process.argv.includes('--verbose-error');
  }
}

/**
 * Global error handler for the CLI
 */
export class ErrorHandler {
  static handle(error, _command = null) {
    let response;

    if (error instanceof TaskwerkError) {
      response = new ErrorResponse(
        'error',
        error.code,
        error.message,
        this.getErrorDescription(error.code),
        error.details
      );
    } else if (error instanceof Error) {
      response = new ErrorResponse(
        'error',
        'UNKNOWN_ERROR',
        error.message,
        'An unexpected error occurred',
        { stack: error.stack }
      );
    } else {
      response = new ErrorResponse(
        'error',
        'UNKNOWN_ERROR',
        String(error),
        'An unexpected error occurred',
        {}
      );
    }

    // Check if verbose error output is requested
    if (process.argv.includes('--verbose-error')) {
      console.error(JSON.stringify(response.toJSON(), null, 2));
    } else {
      console.error(response.reason);
    }

    // Set appropriate exit code
    process.exit(response.code === 'SUCCESS' ? 0 : 1);
  }

  static success(message, details = {}) {
    const response = new ErrorResponse(
      'success',
      'SUCCESS',
      message,
      'Operation completed successfully',
      details
    );

    if (process.argv.includes('--verbose-error')) {
      console.log(JSON.stringify(response.toJSON(), null, 2));
    }

    return response;
  }

  static warning(code, message, details = {}) {
    const response = new ErrorResponse(
      'warning',
      code,
      message,
      this.getErrorDescription(code),
      details
    );

    if (process.argv.includes('--verbose-error')) {
      console.warn(JSON.stringify(response.toJSON(), null, 2));
    } else {
      console.warn(`Warning: ${message}`);
    }

    return response;
  }

  static getErrorDescription(code) {
    const descriptions = {
      // Validation errors
      VALIDATION_ERROR: 'Input validation failed',
      INVALID_TASK_ID: 'Task ID format is invalid',
      MISSING_REQUIRED_FIELD: 'A required field is missing',
      INVALID_STATUS: 'Task status value is invalid',
      INVALID_PRIORITY: 'Task priority value is invalid',

      // Database errors
      DATABASE_ERROR: 'Database operation failed',
      DATABASE_CONNECTION_ERROR: 'Could not connect to database',
      DATABASE_QUERY_ERROR: 'Database query execution failed',
      TASK_NOT_FOUND: 'The specified task does not exist',
      DUPLICATE_TASK_ID: 'A task with this ID already exists',

      // File system errors
      FILESYSTEM_ERROR: 'File system operation failed',
      FILE_NOT_FOUND: 'The specified file does not exist',
      PERMISSION_DENIED: 'Permission denied for file operation',
      DIRECTORY_NOT_FOUND: 'The specified directory does not exist',

      // Configuration errors
      CONFIGURATION_ERROR: 'Configuration is invalid or missing',
      CONFIG_FILE_NOT_FOUND: 'Configuration file not found',
      INVALID_CONFIG_FORMAT: 'Configuration file format is invalid',
      MISSING_CONFIG_KEY: 'Required configuration key is missing',

      // CLI errors
      CLI_ERROR: 'Command line interface error',
      INVALID_COMMAND: 'The specified command is invalid',
      INVALID_ARGUMENTS: 'Command arguments are invalid',
      MISSING_ARGUMENTS: 'Required command arguments are missing',

      // Git errors
      GIT_ERROR: 'Git operation failed',
      NOT_GIT_REPOSITORY: 'Not in a git repository',
      UNCOMMITTED_CHANGES: 'There are uncommitted changes',
      BRANCH_EXISTS: 'Branch already exists',

      // General errors
      UNKNOWN_ERROR: 'An unexpected error occurred',
      NOT_IMPLEMENTED: 'This feature is not yet implemented',
      SUCCESS: 'Operation completed successfully',
    };

    return descriptions[code] || 'An error occurred';
  }
}

/**
 * Wraps async functions with error handling
 */
export function withErrorHandling(fn) {
  return async (...args) => {
    try {
      const result = await fn(...args);
      return result;
    } catch (error) {
      ErrorHandler.handle(error);
    }
  };
}

/**
 * Express middleware for error handling (if we add API later)
 */
export function errorMiddleware(err, req, res, _next) {
  if (err instanceof TaskwerkError) {
    res.status(err.statusCode).json({
      status: 'error',
      code: err.code,
      message: err.message,
      details: err.details,
      timestamp: err.timestamp,
    });
  } else {
    res.status(500).json({
      status: 'error',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
    });
  }
}
