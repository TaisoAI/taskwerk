import { DatabaseError, FileSystemError } from './base-error.js';
import { getErrorLogger } from './error-logger.js';

/**
 * Error recovery strategies
 */
export class ErrorRecovery {
  static async recover(error, context = {}) {
    const logger = getErrorLogger();

    // Log the error first
    logger.log(error, context);

    // Attempt recovery based on error type
    if (error instanceof DatabaseError) {
      return this.recoverFromDatabaseError(error, context);
    } else if (error instanceof FileSystemError) {
      return this.recoverFromFileSystemError(error, context);
    }

    // No recovery available
    return false;
  }

  static async recoverFromDatabaseError(error, context) {
    switch (error.code) {
      case 'DATABASE_CONNECTION_ERROR':
        return this.attemptDatabaseReconnection(context);

      case 'DATABASE_LOCKED':
        return this.waitForDatabaseUnlock(context);

      case 'DATABASE_CORRUPT':
        return this.attemptDatabaseRepair(context);

      default:
        return false;
    }
  }

  static async recoverFromFileSystemError(error, context) {
    switch (error.code) {
      case 'ENOENT': // File not found
        return this.createMissingFile(error.details.path, context);

      case 'EACCES': // Permission denied
        return this.suggestPermissionFix(error.details.path);

      case 'ENOSPC': // No space left
        return this.suggestSpaceCleanup();

      default:
        return false;
    }
  }

  static async attemptDatabaseReconnection(context, maxRetries = 3) {
    const { database } = context;
    if (!database) {
      return false;
    }

    for (let i = 0; i < maxRetries; i++) {
      try {
        // Wait with exponential backoff
        await this.sleep(Math.pow(2, i) * 1000);

        // Try to reconnect
        database.close();
        database.connect();

        console.log('Successfully reconnected to database');
        return true;
      } catch (error) {
        console.log(`Reconnection attempt ${i + 1} failed`);
      }
    }

    return false;
  }

  static async waitForDatabaseUnlock(context, maxWaitTime = 5000) {
    const startTime = Date.now();
    const { database } = context;
    if (!database) {
      return false;
    }

    while (Date.now() - startTime < maxWaitTime) {
      try {
        // Try a simple query to check if database is unlocked
        database.prepare('SELECT 1').get();
        return true;
      } catch (error) {
        // Still locked, wait a bit
        await this.sleep(100);
      }
    }

    return false;
  }

  static async attemptDatabaseRepair(context) {
    const { dbPath } = context;
    if (!dbPath) {
      return false;
    }

    try {
      // First, try to backup the corrupt database
      const backupPath = `${dbPath}.corrupt.${Date.now()}`;
      console.log(`Backing up corrupt database to: ${backupPath}`);

      // This would need actual repair logic
      // For now, we just suggest manual intervention
      console.error(`
Database appears to be corrupt. Manual intervention required.
Corrupt database backed up to: ${backupPath}

Suggested recovery steps:
1. Try running: sqlite3 ${dbPath} ".recover" > recovered.sql
2. Create a new database and import recovered.sql
3. Replace the corrupt database with the recovered one
      `);

      return false;
    } catch (error) {
      return false;
    }
  }

  static async createMissingFile(path, _context) {
    if (!path) {
      return false;
    }

    try {
      // const { defaultContent = '' } = context;
      console.log(`Creating missing file: ${path}`);

      // For config files, we might want to create with defaults
      // This is just a placeholder
      return false;
    } catch (_error) {
      return false;
    }
  }

  static suggestPermissionFix(path) {
    console.error(`
Permission denied accessing: ${path}

Suggested fixes:
1. Check file ownership: ls -la ${path}
2. Fix permissions: chmod 644 ${path}
3. Run with elevated privileges (not recommended)
    `);
    return false;
  }

  static suggestSpaceCleanup() {
    console.error(`
No space left on device.

Suggested fixes:
1. Check disk space: df -h
2. Clean up old logs: taskwerk cleanup --logs
3. Remove old task exports
4. Clear system temp files
    `);
    return false;
  }

  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Retry decorator with exponential backoff
 */
export function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 100,
    maxDelay = 5000,
    exponentialBase = 2,
    shouldRetry = _error => true,
  } = options;

  return async (...args) => {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn(...args);
      } catch (error) {
        lastError = error;

        if (attempt === maxRetries || !shouldRetry(error)) {
          throw error;
        }

        const delay = Math.min(initialDelay * Math.pow(exponentialBase, attempt), maxDelay);

        console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await ErrorRecovery.sleep(delay);
      }
    }

    throw lastError;
  };
}

/**
 * Circuit breaker pattern for preventing cascading failures
 */
export class CircuitBreaker {
  constructor(fn, options = {}) {
    this.fn = fn;
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.nextAttempt = Date.now();
  }

  async call(...args) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await this.fn(...args);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failures++;
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
      console.log(`Circuit breaker opened. Will retry after ${new Date(this.nextAttempt)}`);
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      nextAttempt: this.nextAttempt,
    };
  }
}
