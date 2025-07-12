import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { format } from 'util';
import { getConfigManager } from '../config/index.js';

// Log levels
export const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4,
};

// Log level names
const LOG_LEVEL_NAMES = {
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.TRACE]: 'TRACE',
};

// Default log directory
const DEFAULT_LOG_DIR = join(homedir(), '.taskwerk', 'logs');

/**
 * Logger class for Taskwerk
 */
export class Logger {
  constructor(category = 'general') {
    this.category = category;
    this.config = null;
    this.stream = null;
    this.level = LogLevel.INFO;
    this.console = true;
    this.file = true;
    this.initialized = false;
  }

  /**
   * Initialize the logger
   */
  init() {
    if (this.initialized) {
      return;
    }

    try {
      // Load configuration
      const configManager = getConfigManager();
      this.config = configManager.get('developer', {});
      
      // Set log level
      this.level = this.parseLogLevel(this.config.logLevel || 'info');
      
      // Set output options
      this.console = this.config.logConsole !== false;
      this.file = this.config.logFile !== false;
      
      // Initialize file logging if enabled
      if (this.file) {
        this.initFileLogging();
      }
      
      this.initialized = true;
    } catch (error) {
      // If initialization fails, fall back to console logging
      console.error('Failed to initialize logger:', error);
      this.console = true;
      this.file = false;
    }
  }

  /**
   * Initialize file logging
   */
  initFileLogging() {
    try {
      const logDir = this.config.logDirectory || DEFAULT_LOG_DIR;
      
      // Ensure log directory exists
      if (!existsSync(logDir)) {
        mkdirSync(logDir, { recursive: true });
      }
      
      // Create log file path with date
      const date = new Date().toISOString().split('T')[0];
      const logFile = join(logDir, `taskwerk-${date}.log`);
      
      // Open write stream
      this.stream = createWriteStream(logFile, { flags: 'a' });
      
      // Handle stream errors
      this.stream.on('error', (error) => {
        console.error('Log file write error:', error);
        this.file = false;
        this.stream = null;
      });
    } catch (error) {
      console.error('Failed to initialize file logging:', error);
      this.file = false;
    }
  }

  /**
   * Parse log level from string
   */
  parseLogLevel(level) {
    const levelStr = level.toUpperCase();
    switch (levelStr) {
      case 'ERROR': return LogLevel.ERROR;
      case 'WARN': return LogLevel.WARN;
      case 'INFO': return LogLevel.INFO;
      case 'DEBUG': return LogLevel.DEBUG;
      case 'TRACE': return LogLevel.TRACE;
      default: return LogLevel.INFO;
    }
  }

  /**
   * Format log message
   */
  formatMessage(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const levelName = LOG_LEVEL_NAMES[level] || 'UNKNOWN';
    const formattedMessage = args.length > 0 ? format(message, ...args) : message;
    
    return `[${timestamp}] [${levelName}] [${this.category}] ${formattedMessage}`;
  }

  /**
   * Log a message
   */
  log(level, message, ...args) {
    // Initialize if needed
    if (!this.initialized) {
      this.init();
    }

    // Check log level
    if (level > this.level) {
      return;
    }

    const formattedMessage = this.formatMessage(level, message, ...args);

    // Console output
    if (this.console) {
      switch (level) {
        case LogLevel.ERROR:
          console.error(formattedMessage);
          break;
        case LogLevel.WARN:
          console.warn(formattedMessage);
          break;
        default:
          console.log(formattedMessage);
      }
    }

    // File output
    if (this.file && this.stream) {
      this.stream.write(formattedMessage + '\n');
    }
  }

  /**
   * Log error message
   */
  error(message, ...args) {
    this.log(LogLevel.ERROR, message, ...args);
  }

  /**
   * Log warning message
   */
  warn(message, ...args) {
    this.log(LogLevel.WARN, message, ...args);
  }

  /**
   * Log info message
   */
  info(message, ...args) {
    this.log(LogLevel.INFO, message, ...args);
  }

  /**
   * Log debug message
   */
  debug(message, ...args) {
    this.log(LogLevel.DEBUG, message, ...args);
  }

  /**
   * Log trace message
   */
  trace(message, ...args) {
    this.log(LogLevel.TRACE, message, ...args);
  }

  /**
   * Close the logger
   */
  close() {
    if (this.stream) {
      this.stream.end();
      this.stream = null;
    }
  }
}

// Logger instances cache
const loggers = new Map();

/**
 * Get or create a logger for a category
 */
export function getLogger(category = 'general') {
  if (!loggers.has(category)) {
    loggers.set(category, new Logger(category));
  }
  return loggers.get(category);
}

/**
 * Close all loggers
 */
export function closeAllLoggers() {
  for (const logger of loggers.values()) {
    logger.close();
  }
  loggers.clear();
}

/**
 * Set global log level
 */
export function setGlobalLogLevel(level) {
  const parsedLevel = typeof level === 'string' 
    ? new Logger().parseLogLevel(level)
    : level;
    
  for (const logger of loggers.values()) {
    logger.level = parsedLevel;
  }
}