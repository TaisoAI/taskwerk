import {
  existsSync,
  mkdirSync,
  appendFileSync,
  readFileSync,
  unlinkSync,
  statSync,
  renameSync,
} from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

/**
 * Error logger for persistent error tracking
 */
export class ErrorLogger {
  constructor(logDir = null) {
    this.logDir = logDir || join(homedir(), '.taskwerk', 'logs');
    this.errorLogPath = join(this.logDir, 'errors.log');
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }
  }

  log(error, context = {}) {
    const logEntry = this.formatLogEntry(error, context);

    try {
      appendFileSync(this.errorLogPath, logEntry + '\n');
    } catch (writeError) {
      // If we can't write to the log file, at least output to stderr
      console.error('Failed to write to error log:', writeError.message);
      console.error('Original error:', logEntry);
    }
  }

  formatLogEntry(error, context) {
    const timestamp = new Date().toISOString();
    const entry = {
      timestamp,
      level: 'ERROR',
      name: error.name || 'Error',
      code: error.code || 'UNKNOWN',
      message: error.message,
      context,
    };

    // Add error-specific details
    if (error.details) {
      entry.details = error.details;
    }

    // Add stack trace for non-production environments
    if (process.env.NODE_ENV !== 'production' && error.stack) {
      entry.stack = error.stack;
    }

    // Add system information
    entry.system = {
      platform: process.platform,
      nodeVersion: process.version,
      taskwerkVersion: this.getTaskwerkVersion(),
    };

    return JSON.stringify(entry);
  }

  getTaskwerkVersion() {
    try {
      // Use injected version if available, otherwise try reading package.json
      if (global.__PACKAGE_VERSION__) {
        return global.__PACKAGE_VERSION__;
      }

      const packagePath = join(
        dirname(import.meta.url).replace('file://', ''),
        '../../../package.json'
      );
      if (existsSync(packagePath)) {
        const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
        return pkg.version;
      }
    } catch (e) {
      // Ignore errors
    }
    return 'unknown';
  }

  /**
   * Get recent errors from the log
   */
  getRecentErrors(limit = 10) {
    if (!existsSync(this.errorLogPath)) {
      return [];
    }

    try {
      const content = readFileSync(this.errorLogPath, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      const recent = lines.slice(-limit);

      return recent.map(line => {
        try {
          return JSON.parse(line);
        } catch (e) {
          return { raw: line, parseError: e.message };
        }
      });
    } catch (error) {
      return [];
    }
  }

  /**
   * Clear error log
   */
  clear() {
    if (existsSync(this.errorLogPath)) {
      unlinkSync(this.errorLogPath);
    }
  }

  /**
   * Get log file size
   */
  getLogSize() {
    if (!existsSync(this.errorLogPath)) {
      return 0;
    }

    try {
      const stats = statSync(this.errorLogPath);
      return stats.size;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Rotate log file if it exceeds max size
   */
  rotateIfNeeded(maxSizeBytes = 10 * 1024 * 1024) {
    // 10MB default
    const size = this.getLogSize();
    if (size > maxSizeBytes) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rotatedPath = join(this.logDir, `errors-${timestamp}.log`);

      try {
        renameSync(this.errorLogPath, rotatedPath);
        console.log(`Error log rotated to: ${rotatedPath}`);
      } catch (error) {
        console.error('Failed to rotate error log:', error.message);
      }
    }
  }
}

// Singleton instance
let loggerInstance = null;

export function getErrorLogger() {
  if (!loggerInstance) {
    loggerInstance = new ErrorLogger();
  }
  return loggerInstance;
}

/**
 * Middleware to automatically log errors
 */
export function withErrorLogging(fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      const logger = getErrorLogger();
      logger.log(error, {
        function: fn.name,
        arguments: args,
      });
      throw error;
    }
  };
}
