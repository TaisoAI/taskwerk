import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorRecovery, withRetry, CircuitBreaker } from '../../src/errors/error-recovery.js';
import { DatabaseError, FileSystemError } from '../../src/errors/base-error.js';

describe('Error Recovery', () => {
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('ErrorRecovery', () => {
    it('should attempt database error recovery', async () => {
      const error = new DatabaseError('Connection failed');
      error.code = 'DATABASE_CONNECTION_ERROR';

      const mockDatabase = {
        close: vi.fn(),
        connect: vi.fn(),
      };

      await ErrorRecovery.recover(error, { database: mockDatabase });

      expect(mockDatabase.close).toHaveBeenCalled();
      expect(mockDatabase.connect).toHaveBeenCalled();
    });

    it('should handle filesystem permission errors', async () => {
      const error = new FileSystemError('Permission denied', '/tmp/test.txt');
      error.code = 'EACCES';

      await ErrorRecovery.recover(error);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const errorMessage = consoleErrorSpy.mock.calls[0][0];
      expect(errorMessage).toContain('Permission denied');
      expect(errorMessage).toContain('chmod');
    });

    it('should handle no space left errors', async () => {
      const error = new FileSystemError('No space left');
      error.code = 'ENOSPC';

      await ErrorRecovery.recover(error);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const errorMessage = consoleErrorSpy.mock.calls[0][0];
      expect(errorMessage).toContain('No space left');
      expect(errorMessage).toContain('df -h');
    });

    it('should wait for database unlock', async () => {
      const mockDatabase = {
        prepare: vi.fn().mockImplementation(() => ({
          get: vi
            .fn()
            .mockRejectedValueOnce(new Error('locked'))
            .mockResolvedValueOnce({ result: 1 }),
        })),
      };

      const result = await ErrorRecovery.waitForDatabaseUnlock({ database: mockDatabase }, 1000);

      expect(result).toBe(true);
      expect(mockDatabase.prepare).toHaveBeenCalledWith('SELECT 1');
    });
  });

  describe('withRetry', () => {
    it('should retry failed operations', async () => {
      let attempts = 0;
      const fn = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      });

      const retryFn = withRetry(fn, { maxRetries: 3, initialDelay: 10 });
      const result = await retryFn();

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Persistent failure'));

      const retryFn = withRetry(fn, { maxRetries: 2, initialDelay: 10 });

      await expect(retryFn()).rejects.toThrow('Persistent failure');
      expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it('should respect shouldRetry predicate', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Non-retryable'));

      const retryFn = withRetry(fn, {
        maxRetries: 3,
        initialDelay: 10,
        shouldRetry: error => error.message !== 'Non-retryable',
      });

      await expect(retryFn()).rejects.toThrow('Non-retryable');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('CircuitBreaker', () => {
    it('should open circuit after failure threshold', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Service unavailable'));
      const breaker = new CircuitBreaker(fn, { failureThreshold: 2, resetTimeout: 100 });

      // First two calls should fail and open the circuit
      await expect(breaker.call()).rejects.toThrow('Service unavailable');
      await expect(breaker.call()).rejects.toThrow('Service unavailable');

      expect(breaker.getState().state).toBe('OPEN');
      expect(fn).toHaveBeenCalledTimes(2);

      // Next call should fail immediately without calling the function
      await expect(breaker.call()).rejects.toThrow('Circuit breaker is OPEN');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should reset circuit after timeout', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValueOnce('success');

      const breaker = new CircuitBreaker(fn, { failureThreshold: 2, resetTimeout: 50 });

      // Open the circuit
      await expect(breaker.call()).rejects.toThrow('Fail 1');
      await expect(breaker.call()).rejects.toThrow('Fail 2');
      expect(breaker.getState().state).toBe('OPEN');

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 60));

      // Circuit should be half-open and allow one attempt
      const result = await breaker.call();
      expect(result).toBe('success');
      expect(breaker.getState().state).toBe('CLOSED');
    });

    it('should track state correctly', () => {
      const fn = vi.fn();
      const breaker = new CircuitBreaker(fn);

      const state = breaker.getState();
      expect(state.state).toBe('CLOSED');
      expect(state.failures).toBe(0);
      expect(state.nextAttempt).toBeDefined();
    });
  });
});
