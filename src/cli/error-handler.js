/**
 * TaskWerk v3 Error Handler
 *
 * Centralized error handling system with user-friendly messages
 */

import chalk from 'chalk';
import { getConfigValue } from '../utils/config.js';
import { ErrorRecovery } from './error-recovery.js';

/**
 * Error types and their corresponding messages
 */
const ERROR_TYPES = {
  // Database errors
  DATABASE_NOT_FOUND: {
    code: 'E001',
    message: 'Database not found',
    suggestion: 'Run "taskwerk init" to create a new database',
  },
  DATABASE_LOCKED: {
    code: 'E002',
    message: 'Database is locked',
    suggestion: 'Another process may be using the database. Try again in a moment',
  },
  DATABASE_CORRUPT: {
    code: 'E003',
    message: 'Database appears to be corrupted',
    suggestion: 'Try restoring from a backup or run "taskwerk init --force" to recreate',
  },

  // Task errors
  TASK_NOT_FOUND: {
    code: 'E101',
    message: 'Task not found',
    suggestion: 'Check the task ID and try again. Use "taskwerk list" to see all tasks',
  },
  TASK_ALREADY_EXISTS: {
    code: 'E102',
    message: 'Task already exists',
    suggestion: 'Use a different task ID or update the existing task',
  },
  INVALID_TASK_STATUS: {
    code: 'E103',
    message: 'Invalid task status',
    suggestion: 'Valid statuses are: todo, in_progress, completed, archived',
  },
  INVALID_TASK_PRIORITY: {
    code: 'E104',
    message: 'Invalid task priority',
    suggestion: 'Valid priorities are: high, medium, low',
  },

  // Configuration errors
  CONFIG_NOT_FOUND: {
    code: 'E201',
    message: 'Configuration file not found',
    suggestion: 'Run "taskwerk config --reset" to create a default configuration',
  },
  CONFIG_INVALID: {
    code: 'E202',
    message: 'Invalid configuration',
    suggestion:
      'Check your configuration file for syntax errors or run "taskwerk config --validate"',
  },
  CONFIG_KEY_NOT_FOUND: {
    code: 'E203',
    message: 'Configuration key not found',
    suggestion: 'Use "taskwerk config --list" to see available configuration keys',
  },

  // File system errors
  FILE_NOT_FOUND: {
    code: 'E301',
    message: 'File not found',
    suggestion: 'Check the file path and try again',
  },
  FILE_ACCESS_DENIED: {
    code: 'E302',
    message: 'Permission denied',
    suggestion: 'Check file permissions or run with appropriate privileges',
  },
  DIRECTORY_NOT_FOUND: {
    code: 'E303',
    message: 'Directory not found',
    suggestion: 'Check the directory path and ensure it exists',
  },

  // Command errors
  COMMAND_NOT_FOUND: {
    code: 'E401',
    message: 'Command not found',
    suggestion: 'Use "taskwerk --help" to see available commands',
  },
  INVALID_ARGUMENTS: {
    code: 'E402',
    message: 'Invalid arguments',
    suggestion: 'Check command usage with "taskwerk <command> --help"',
  },
  MISSING_REQUIRED_ARG: {
    code: 'E403',
    message: 'Missing required argument',
    suggestion: 'This command requires additional arguments. Use --help for details',
  },

  // Network errors
  NETWORK_ERROR: {
    code: 'E501',
    message: 'Network error',
    suggestion: 'Check your internet connection and try again',
  },
  API_ERROR: {
    code: 'E502',
    message: 'API error',
    suggestion: 'The API returned an error. Check your API key and try again',
  },

  // General errors
  UNKNOWN_ERROR: {
    code: 'E999',
    message: 'An unexpected error occurred',
    suggestion: 'Try running with --debug for more information',
  },
};

/**
 * Enhanced error class with TaskWerk-specific features
 */
export class TaskWerkError extends Error {
  constructor(type, details = {}) {
    const errorInfo = ERROR_TYPES[type] || ERROR_TYPES.UNKNOWN_ERROR;
    super(details.message || errorInfo.message);

    this.name = 'TaskWerkError';
    this.code = errorInfo.code;
    this.type = type;
    this.suggestion = details.suggestion || errorInfo.suggestion;
    this.details = details;
    this.timestamp = new Date().toISOString();

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TaskWerkError);
    }
  }
}

/**
 * Error handler singleton
 */
class ErrorHandler {
  constructor() {
    this.debugMode = false;
    this.errorLog = [];
    this.maxErrorLog = 100;
  }

  /**
   * Initialize error handler
   */
  async initialize() {
    try {
      this.debugMode = getConfigValue('debug', false) || process.env.DEBUG === 'true';
    } catch (error) {
      // Config not available yet, use environment variable
      this.debugMode = process.env.DEBUG === 'true';
    }
  }

  /**
   * Handle an error with appropriate formatting
   */
  handle(error, context = {}) {
    // Log error for debugging
    this.logError(error, context);

    // Format and display error
    if (this.debugMode) {
      this.displayDebugError(error, context);
    } else {
      this.displayUserError(error, context);
    }

    // Return exit code
    return this.getExitCode(error);
  }

  /**
   * Display user-friendly error message
   */
  displayUserError(error, context = {}) {
    console.error();

    // Error header
    const isTaskWerkError = error instanceof TaskWerkError;
    const errorCode = isTaskWerkError ? error.code : 'E999';
    const errorType = isTaskWerkError ? error.type : 'UNKNOWN_ERROR';

    console.error(chalk.red.bold(`✖ Error [${errorCode}]: ${error.message}`));

    // Additional details
    if (error.details && Object.keys(error.details).length > 0) {
      console.error();
      for (const [key, value] of Object.entries(error.details)) {
        if (key !== 'message' && key !== 'suggestion' && value) {
          console.error(chalk.gray(`  ${key}: ${value}`));
        }
      }
    }

    // Suggestion
    const suggestion = error.suggestion || ERROR_TYPES[errorType]?.suggestion;
    if (suggestion) {
      console.error();
      console.error(chalk.yellow('💡 Suggestion:'), suggestion);
    }

    // Recovery suggestions
    const recoverySuggestions = ErrorRecovery.getSuggestions(error, context);
    if (recoverySuggestions.length > 0) {
      console.error(ErrorRecovery.formatSuggestions(recoverySuggestions));
    }

    // Context information
    if (context.command) {
      console.error();
      console.error(chalk.gray(`Command: ${context.command}`));
    }

    // Debug mode hint
    if (!this.debugMode && !isTaskWerkError) {
      console.error();
      console.error(chalk.gray('Run with --debug for more details'));
    }

    console.error();
  }

  /**
   * Display detailed debug error
   */
  displayDebugError(error, context = {}) {
    console.error();
    console.error(chalk.red.bold('═══ DEBUG ERROR INFORMATION ═══'));

    // Basic error info
    console.error(chalk.red(`\nError Type: ${error.name || 'Error'}`));
    console.error(chalk.red(`Message: ${error.message}`));

    if (error instanceof TaskWerkError) {
      console.error(chalk.red(`Code: ${error.code}`));
      console.error(chalk.red(`Type: ${error.type}`));
      console.error(chalk.red(`Timestamp: ${error.timestamp}`));
    }

    // Error details
    if (error.details) {
      console.error(chalk.yellow('\nDetails:'));
      console.error(JSON.stringify(error.details, null, 2));
    }

    // Context
    if (Object.keys(context).length > 0) {
      console.error(chalk.yellow('\nContext:'));
      console.error(JSON.stringify(context, null, 2));
    }

    // Stack trace
    if (error.stack) {
      console.error(chalk.yellow('\nStack Trace:'));
      console.error(chalk.gray(error.stack));
    }

    // Environment
    console.error(chalk.yellow('\nEnvironment:'));
    console.error(chalk.gray(`  Node Version: ${process.version}`));
    console.error(chalk.gray(`  Platform: ${process.platform}`));
    console.error(chalk.gray(`  Architecture: ${process.arch}`));
    console.error(chalk.gray(`  Working Directory: ${process.cwd()}`));

    // Recent errors
    if (this.errorLog.length > 1) {
      console.error(chalk.yellow('\nRecent Errors:'));
      this.errorLog.slice(-5).forEach((log, index) => {
        console.error(chalk.gray(`  ${index + 1}. [${log.timestamp}] ${log.error.message}`));
      });
    }

    console.error(chalk.red.bold('\n═══════════════════════════════\n'));
  }

  /**
   * Log error for debugging
   */
  logError(error, context) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
        type: error.type,
        stack: error.stack,
      },
      context,
    };

    this.errorLog.push(logEntry);

    // Keep log size manageable
    if (this.errorLog.length > this.maxErrorLog) {
      this.errorLog = this.errorLog.slice(-this.maxErrorLog);
    }
  }

  /**
   * Get appropriate exit code for error
   */
  getExitCode(error) {
    if (error instanceof TaskWerkError) {
      const codePrefix = error.code.charAt(1);
      switch (codePrefix) {
        case '0':
          return 10; // Database errors
        case '1':
          return 11; // Task errors
        case '2':
          return 12; // Config errors
        case '3':
          return 13; // File system errors
        case '4':
          return 14; // Command errors
        case '5':
          return 15; // Network errors
        default:
          return 1; // General errors
      }
    }
    return 1;
  }

  /**
   * Create a TaskWerk error
   */
  createError(type, details = {}) {
    return new TaskWerkError(type, details);
  }

  /**
   * Wrap an external error
   */
  wrapError(error, type = 'UNKNOWN_ERROR', details = {}) {
    if (error instanceof TaskWerkError) {
      return error;
    }

    const wrappedDetails = {
      ...details,
      originalError: error.message,
      originalStack: error.stack,
    };

    // Try to determine error type from error properties
    if (error.code === 'ENOENT') {
      return new TaskWerkError('FILE_NOT_FOUND', {
        ...wrappedDetails,
        message: `File not found: ${error.path || details.path || 'unknown'}`,
      });
    }

    if (error.code === 'EACCES') {
      return new TaskWerkError('FILE_ACCESS_DENIED', {
        ...wrappedDetails,
        message: `Permission denied: ${error.path || details.path || 'unknown'}`,
      });
    }

    if (error.code === 'SQLITE_BUSY') {
      return new TaskWerkError('DATABASE_LOCKED', wrappedDetails);
    }

    if (error.code === 'SQLITE_CORRUPT') {
      return new TaskWerkError('DATABASE_CORRUPT', wrappedDetails);
    }

    return new TaskWerkError(type, wrappedDetails);
  }

  /**
   * Clear error log
   */
  clearErrorLog() {
    this.errorLog = [];
  }

  /**
   * Get error log
   */
  getErrorLog() {
    return [...this.errorLog];
  }
}

// Export singleton instance
export const errorHandler = new ErrorHandler();

// Export error types for external use
export { ERROR_TYPES };

// Helper function to handle errors in CLI commands
export function handleCommandError(error, command) {
  const context = {
    command: command?.name() || 'unknown',
    args: process.argv.slice(2),
  };

  const exitCode = errorHandler.handle(error, context);
  process.exit(exitCode);
}

// Install global error handlers
export function installGlobalErrorHandlers() {
  process.on('uncaughtException', error => {
    errorHandler.handle(error, { type: 'uncaughtException' });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    errorHandler.handle(error, { type: 'unhandledRejection', promise });
    process.exit(1);
  });
}
