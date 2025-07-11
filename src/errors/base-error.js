/**
 * Base error class for all Taskwerk errors
 */
export class TaskwerkError extends Error {
  constructor(message, code, statusCode = 500, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();

    // Maintain proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }

  toString() {
    return `${this.name} [${this.code}]: ${this.message}`;
  }
}

/**
 * Base class for validation errors
 */
export class ValidationError extends TaskwerkError {
  constructor(message, field = null, value = null) {
    const details = {};
    if (field) {
      details.field = field;
    }
    if (value !== null) {
      details.value = value;
    }

    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

/**
 * Base class for database errors
 */
export class DatabaseError extends TaskwerkError {
  constructor(message, operation = null, query = null) {
    const details = {};
    if (operation) {
      details.operation = operation;
    }
    if (query) {
      details.query = query;
    }

    super(message, 'DATABASE_ERROR', 500, details);
  }
}

/**
 * Base class for file system errors
 */
export class FileSystemError extends TaskwerkError {
  constructor(message, path = null, operation = null) {
    const details = {};
    if (path) {
      details.path = path;
    }
    if (operation) {
      details.operation = operation;
    }

    super(message, 'FILESYSTEM_ERROR', 500, details);
  }
}

/**
 * Base class for configuration errors
 */
export class ConfigurationError extends TaskwerkError {
  constructor(message, configKey = null, configValue = null) {
    const details = {};
    if (configKey) {
      details.configKey = configKey;
    }
    if (configValue !== undefined) {
      details.configValue = configValue;
    }

    super(message, 'CONFIGURATION_ERROR', 500, details);
  }
}

/**
 * Base class for CLI errors
 */
export class CLIError extends TaskwerkError {
  constructor(message, command = null, args = null) {
    const details = {};
    if (command) {
      details.command = command;
    }
    if (args) {
      details.args = args;
    }

    super(message, 'CLI_ERROR', 400, details);
  }
}
