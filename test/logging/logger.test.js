import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { 
  Logger, 
  LogLevel, 
  getLogger, 
  closeAllLoggers,
  setGlobalLogLevel 
} from '../../src/logging/logger.js';
import { resetConfigManager } from '../../src/config/index.js';

describe('Logger', () => {
  let tempDir;
  let consoleLogSpy;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'taskwerk-logger-test-'));
    resetConfigManager();
    closeAllLoggers();
    
    // Spy on console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    closeAllLoggers();
    rmSync(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create logger with default category', () => {
      const logger = new Logger();
      expect(logger.category).toBe('general');
      expect(logger.level).toBe(LogLevel.INFO);
    });

    it('should create logger with custom category', () => {
      const logger = new Logger('test');
      expect(logger.category).toBe('test');
    });
  });

  describe('log levels', () => {
    it('should parse log levels correctly', () => {
      const logger = new Logger();
      expect(logger.parseLogLevel('error')).toBe(LogLevel.ERROR);
      expect(logger.parseLogLevel('WARN')).toBe(LogLevel.WARN);
      expect(logger.parseLogLevel('info')).toBe(LogLevel.INFO);
      expect(logger.parseLogLevel('DEBUG')).toBe(LogLevel.DEBUG);
      expect(logger.parseLogLevel('trace')).toBe(LogLevel.TRACE);
      expect(logger.parseLogLevel('invalid')).toBe(LogLevel.INFO);
    });

    it('should respect log level filtering', () => {
      const logger = new Logger();
      logger.level = LogLevel.WARN;
      logger.console = true;
      logger.file = false;
      logger.initialized = true;

      logger.error('error message');
      logger.warn('warn message');
      logger.info('info message');
      logger.debug('debug message');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledTimes(0);
    });
  });

  describe('message formatting', () => {
    it('should format messages correctly', () => {
      const logger = new Logger('test');
      const message = logger.formatMessage(LogLevel.INFO, 'Test message');
      
      expect(message).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
      expect(message).toContain('[INFO]');
      expect(message).toContain('[test]');
      expect(message).toContain('Test message');
    });

    it('should format messages with arguments', () => {
      const logger = new Logger();
      const message = logger.formatMessage(LogLevel.INFO, 'Hello %s %d', 'world', 123);
      
      expect(message).toContain('Hello world 123');
    });
  });

  describe('console output', () => {
    it('should log to console when enabled', () => {
      const logger = new Logger();
      logger.console = true;
      logger.file = false;
      logger.initialized = true;

      logger.error('error message');
      logger.warn('warn message');
      logger.info('info message');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    });

    it('should not log to console when disabled', () => {
      const logger = new Logger();
      logger.console = false;
      logger.file = false;
      logger.initialized = true;

      logger.info('test message');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('file output', () => {
    it('should create log file when enabled', async () => {
      const logger = new Logger();
      logger.config = { logDirectory: tempDir };
      logger.console = false;
      logger.file = true;
      
      logger.initFileLogging();
      logger.initialized = true;
      
      logger.info('test message');
      
      // Give time for write
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const date = new Date().toISOString().split('T')[0];
      const logFile = join(tempDir, `taskwerk-${date}.log`);
      
      expect(existsSync(logFile)).toBe(true);
      
      const content = readFileSync(logFile, 'utf8');
      expect(content).toContain('test message');
      expect(content).toContain('[INFO]');
    });
  });

  describe('getLogger', () => {
    it('should return same instance for same category', () => {
      const logger1 = getLogger('test');
      const logger2 = getLogger('test');
      expect(logger1).toBe(logger2);
    });

    it('should return different instances for different categories', () => {
      const logger1 = getLogger('test1');
      const logger2 = getLogger('test2');
      expect(logger1).not.toBe(logger2);
    });
  });

  describe('setGlobalLogLevel', () => {
    it('should update log level for all loggers', () => {
      const logger1 = getLogger('test1');
      const logger2 = getLogger('test2');
      
      logger1.initialized = true;
      logger2.initialized = true;
      
      setGlobalLogLevel(LogLevel.DEBUG);
      
      expect(logger1.level).toBe(LogLevel.DEBUG);
      expect(logger2.level).toBe(LogLevel.DEBUG);
    });

    it('should accept string log level', () => {
      const logger = getLogger('test');
      logger.initialized = true;
      
      setGlobalLogLevel('warn');
      
      expect(logger.level).toBe(LogLevel.WARN);
    });
  });
});