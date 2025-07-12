import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StructuredLogger, getStructuredLogger } from '../../src/logging/structured.js';
import { closeAllLoggers } from '../../src/logging/logger.js';

describe('StructuredLogger', () => {
  let mockBaseLogger;

  beforeEach(() => {
    closeAllLoggers();
    
    // Mock the base logger
    mockBaseLogger = {
      log: vi.fn(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create structured logger with category', () => {
      const logger = new StructuredLogger('test');
      expect(logger.category).toBe('test');
      expect(logger.context).toEqual({});
    });
  });

  describe('context management', () => {
    it('should set context', () => {
      const logger = new StructuredLogger();
      logger.setContext({ userId: '123', sessionId: 'abc' });
      
      expect(logger.context).toEqual({
        userId: '123',
        sessionId: 'abc',
      });
    });

    it('should merge context', () => {
      const logger = new StructuredLogger();
      logger.setContext({ userId: '123' });
      logger.setContext({ sessionId: 'abc' });
      
      expect(logger.context).toEqual({
        userId: '123',
        sessionId: 'abc',
      });
    });

    it('should clear context', () => {
      const logger = new StructuredLogger();
      logger.setContext({ userId: '123' });
      logger.clearContext();
      
      expect(logger.context).toEqual({});
    });
  });

  describe('createEntry', () => {
    it('should create log entry with all fields', () => {
      const logger = new StructuredLogger('test');
      logger.setContext({ userId: '123' });
      
      const entry = logger.createEntry('INFO', 'Test message', { extra: 'data' });
      
      expect(entry).toHaveProperty('timestamp');
      expect(entry.level).toBe('INFO');
      expect(entry.category).toBe('test');
      expect(entry.message).toBe('Test message');
      expect(entry.userId).toBe('123');
      expect(entry.extra).toBe('data');
    });

    it('should override context with data', () => {
      const logger = new StructuredLogger();
      logger.setContext({ userId: '123' });
      
      const entry = logger.createEntry('INFO', 'Test', { userId: '456' });
      
      expect(entry.userId).toBe('456');
    });
  });

  describe('logging methods', () => {
    it('should have all log level methods', () => {
      const logger = new StructuredLogger();
      logger.baseLogger = mockBaseLogger;
      
      logger.error('error message', { code: 'ERR001' });
      logger.warn('warn message', { threshold: 80 });
      logger.info('info message', { status: 'ok' });
      logger.debug('debug message', { details: 'verbose' });
      logger.trace('trace message', { stack: 'deep' });
      
      expect(mockBaseLogger.log).toHaveBeenCalledTimes(5);
    });
  });

  describe('logOperation', () => {
    it('should log successful operation', async () => {
      const logger = new StructuredLogger();
      logger.baseLogger = mockBaseLogger;
      
      const result = await logger.logOperation(
        'testOperation',
        async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'success';
        },
        { user: 'test' }
      );
      
      expect(result).toBe('success');
      expect(mockBaseLogger.log).toHaveBeenCalledTimes(2);
      
      // Check start log
      const startCall = mockBaseLogger.log.mock.calls[0];
      const startEntry = JSON.parse(startCall[1]);
      expect(startEntry.message).toBe('testOperation started');
      expect(startEntry.operation).toBe('testOperation');
      expect(startEntry.user).toBe('test');
      expect(startEntry.operationId).toBeDefined();
      
      // Check completion log
      const endCall = mockBaseLogger.log.mock.calls[1];
      const endEntry = JSON.parse(endCall[1]);
      expect(endEntry.message).toBe('testOperation completed');
      expect(endEntry.success).toBe(true);
      expect(endEntry.duration).toBeGreaterThan(0);
    });

    it('should log failed operation', async () => {
      const logger = new StructuredLogger();
      logger.baseLogger = mockBaseLogger;
      
      const error = new Error('Test error');
      
      await expect(
        logger.logOperation(
          'failingOperation',
          async () => {
            throw error;
          }
        )
      ).rejects.toThrow('Test error');
      
      expect(mockBaseLogger.log).toHaveBeenCalledTimes(2);
      
      // Check failure log
      const endCall = mockBaseLogger.log.mock.calls[1];
      const endEntry = JSON.parse(endCall[1]);
      expect(endEntry.message).toBe('failingOperation failed');
      expect(endEntry.success).toBe(false);
      expect(endEntry.error).toBe('Test error');
      expect(endEntry.stack).toBeDefined();
    });
  });

  describe('getStructuredLogger', () => {
    it('should return same instance for same category', () => {
      const logger1 = getStructuredLogger('test');
      const logger2 = getStructuredLogger('test');
      expect(logger1).toBe(logger2);
    });

    it('should return different instances for different categories', () => {
      const logger1 = getStructuredLogger('test1');
      const logger2 = getStructuredLogger('test2');
      expect(logger1).not.toBe(logger2);
    });
  });
});