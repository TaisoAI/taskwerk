import { getLogger } from './logger.js';

/**
 * Structured logger that outputs JSON format
 */
export class StructuredLogger {
  constructor(category = 'general') {
    this.category = category;
    this.baseLogger = getLogger(category);
    this.context = {};
  }

  /**
   * Set context that will be included in all log messages
   */
  setContext(context) {
    this.context = { ...this.context, ...context };
  }

  /**
   * Clear context
   */
  clearContext() {
    this.context = {};
  }

  /**
   * Create a log entry object
   */
  createEntry(level, message, data = {}) {
    return {
      timestamp: new Date().toISOString(),
      level,
      category: this.category,
      message,
      ...this.context,
      ...data,
    };
  }

  /**
   * Log structured data
   */
  log(level, message, data = {}) {
    const entry = this.createEntry(level, message, data);
    const jsonMessage = JSON.stringify(entry);

    // Use the base logger to output the JSON
    this.baseLogger.log(level, jsonMessage);
  }

  /**
   * Log error with structured data
   */
  error(message, data = {}) {
    this.log('ERROR', message, data);
  }

  /**
   * Log warning with structured data
   */
  warn(message, data = {}) {
    this.log('WARN', message, data);
  }

  /**
   * Log info with structured data
   */
  info(message, data = {}) {
    this.log('INFO', message, data);
  }

  /**
   * Log debug with structured data
   */
  debug(message, data = {}) {
    this.log('DEBUG', message, data);
  }

  /**
   * Log trace with structured data
   */
  trace(message, data = {}) {
    this.log('TRACE', message, data);
  }

  /**
   * Log an operation with timing
   */
  async logOperation(operationName, operation, metadata = {}) {
    const startTime = Date.now();
    const operationId = Math.random().toString(36).substring(7);

    this.info(`${operationName} started`, {
      operation: operationName,
      operationId,
      ...metadata,
    });

    try {
      const result = await operation();
      const duration = Date.now() - startTime;

      this.info(`${operationName} completed`, {
        operation: operationName,
        operationId,
        duration,
        success: true,
        ...metadata,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.error(`${operationName} failed`, {
        operation: operationName,
        operationId,
        duration,
        success: false,
        error: error.message,
        stack: error.stack,
        ...metadata,
      });

      throw error;
    }
  }
}

// Structured logger instances cache
const structuredLoggers = new Map();

/**
 * Get or create a structured logger for a category
 */
export function getStructuredLogger(category = 'general') {
  if (!structuredLoggers.has(category)) {
    structuredLoggers.set(category, new StructuredLogger(category));
  }
  return structuredLoggers.get(category);
}
