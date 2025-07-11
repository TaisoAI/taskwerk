import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorResponse, ErrorHandler } from '../../src/errors/error-handler.js';
import { TaskwerkError } from '../../src/errors/base-error.js';

describe('Error Handler', () => {
  let consoleErrorSpy;
  let consoleLogSpy;
  let consoleWarnSpy;
  let processExitSpy;
  let originalArgv;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
    originalArgv = [...process.argv];
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    processExitSpy.mockRestore();
    process.argv = originalArgv;
  });

  describe('ErrorResponse', () => {
    it('should create error response with all fields', () => {
      const response = new ErrorResponse(
        'error',
        'TEST_ERROR',
        'Something went wrong',
        'A test error occurred',
        { extra: 'info' }
      );

      expect(response.status).toBe('error');
      expect(response.code).toBe('TEST_ERROR');
      expect(response.reason).toBe('Something went wrong');
      expect(response.description).toBe('A test error occurred');
      expect(response.details).toEqual({ extra: 'info' });
      expect(response.timestamp).toBeTruthy();
    });

    it('should serialize to JSON', () => {
      const response = new ErrorResponse('error', 'TEST_ERROR', 'Test', 'Test description');
      const json = response.toJSON();

      expect(json).toHaveProperty('status');
      expect(json).toHaveProperty('code');
      expect(json).toHaveProperty('reason');
      expect(json).toHaveProperty('description');
      expect(json).toHaveProperty('details');
      expect(json).toHaveProperty('timestamp');
    });

    it('should return JSON string when --verbose-error is present', () => {
      process.argv.push('--verbose-error');
      const response = new ErrorResponse('error', 'TEST_ERROR', 'Test', 'Test description');
      const str = response.toString();

      expect(str).toContain('"status": "error"');
      expect(str).toContain('"code": "TEST_ERROR"');
    });

    it('should return simple string when --verbose-error is not present', () => {
      const response = new ErrorResponse('error', 'TEST_ERROR', 'Test reason', 'Test description');
      const str = response.toString();

      expect(str).toBe('ERROR: Test reason');
    });
  });

  describe('ErrorHandler', () => {
    describe('handle', () => {
      it('should handle TaskwerkError', () => {
        const error = new TaskwerkError('Test error', 'TEST_ERROR', 400);
        ErrorHandler.handle(error);

        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(processExitSpy).toHaveBeenCalledWith(1);
      });

      it('should handle regular Error', () => {
        const error = new Error('Regular error');
        ErrorHandler.handle(error);

        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(processExitSpy).toHaveBeenCalledWith(1);
      });

      it('should handle non-Error objects', () => {
        ErrorHandler.handle('String error');

        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(processExitSpy).toHaveBeenCalledWith(1);
      });

      it('should output JSON when --verbose-error is present', () => {
        process.argv.push('--verbose-error');
        const error = new TaskwerkError('Test error', 'TEST_ERROR');
        ErrorHandler.handle(error);

        const call = consoleErrorSpy.mock.calls[0][0];
        expect(call).toContain('"status": "error"');
        expect(call).toContain('"code": "TEST_ERROR"');
      });
    });

    describe('success', () => {
      it('should create success response', () => {
        const response = ErrorHandler.success('Operation completed', { id: '123' });

        expect(response.status).toBe('success');
        expect(response.code).toBe('SUCCESS');
        expect(response.reason).toBe('Operation completed');
        expect(response.details).toEqual({ id: '123' });
      });

      it('should log JSON when --verbose-error is present', () => {
        process.argv.push('--verbose-error');
        ErrorHandler.success('Operation completed');

        expect(consoleLogSpy).toHaveBeenCalled();
        const call = consoleLogSpy.mock.calls[0][0];
        expect(call).toContain('"status": "success"');
      });
    });

    describe('warning', () => {
      it('should create warning response', () => {
        const response = ErrorHandler.warning('DEPRECATED', 'Feature is deprecated');

        expect(response.status).toBe('warning');
        expect(response.code).toBe('DEPRECATED');
        expect(response.reason).toBe('Feature is deprecated');
      });

      it('should log JSON when --verbose-error is present', () => {
        process.argv.push('--verbose-error');
        ErrorHandler.warning('DEPRECATED', 'Feature is deprecated');

        expect(consoleWarnSpy).toHaveBeenCalled();
        const call = consoleWarnSpy.mock.calls[0][0];
        expect(call).toContain('"status": "warning"');
      });

      it('should log simple warning when --verbose-error is not present', () => {
        ErrorHandler.warning('DEPRECATED', 'Feature is deprecated');

        expect(consoleWarnSpy).toHaveBeenCalledWith('Warning: Feature is deprecated');
      });
    });

    describe('getErrorDescription', () => {
      it('should return description for known error codes', () => {
        expect(ErrorHandler.getErrorDescription('VALIDATION_ERROR')).toBe(
          'Input validation failed'
        );
        expect(ErrorHandler.getErrorDescription('TASK_NOT_FOUND')).toBe(
          'The specified task does not exist'
        );
        expect(ErrorHandler.getErrorDescription('DATABASE_ERROR')).toBe(
          'Database operation failed'
        );
      });

      it('should return default description for unknown codes', () => {
        expect(ErrorHandler.getErrorDescription('UNKNOWN_CODE')).toBe('An error occurred');
      });
    });
  });
});
