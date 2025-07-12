import { readdir, stat, unlink } from 'fs/promises';
import { join } from 'path';
import { getLogger } from './logger.js';

const logger = getLogger('rotation');

/**
 * Log rotation configuration
 */
export const RotationConfig = {
  maxFiles: 7, // Keep 7 days of logs by default
  maxSize: 10 * 1024 * 1024, // 10MB max file size
  pattern: /^taskwerk-\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\.log$/,
};

/**
 * Rotate log files based on age and size
 */
export async function rotateLogs(logDir, config = RotationConfig) {
  try {
    logger.debug('Starting log rotation in %s', logDir);
    
    // Get all log files
    const files = await readdir(logDir);
    const logFiles = files.filter(file => config.pattern.test(file));
    
    if (logFiles.length === 0) {
      logger.debug('No log files to rotate');
      return;
    }
    
    // Get file stats and sort by date
    const fileStats = await Promise.all(
      logFiles.map(async (file) => {
        const filePath = join(logDir, file);
        const stats = await stat(filePath);
        return {
          file,
          path: filePath,
          mtime: stats.mtime,
          size: stats.size,
        };
      })
    );
    
    // Sort by modification time (newest first)
    fileStats.sort((a, b) => b.mtime - a.mtime);
    
    // Remove old files beyond maxFiles
    if (fileStats.length > config.maxFiles) {
      const filesToDelete = fileStats.slice(config.maxFiles);
      
      for (const fileInfo of filesToDelete) {
        logger.info('Deleting old log file: %s', fileInfo.file);
        await unlink(fileInfo.path);
      }
    }
    
    // Check for files that are too large
    for (const fileInfo of fileStats) {
      if (fileInfo.size > config.maxSize) {
        logger.warn('Log file %s exceeds max size (%d bytes)', fileInfo.file, fileInfo.size);
        // In a real implementation, we might want to compress or archive these
      }
    }
    
    logger.debug('Log rotation completed');
  } catch (error) {
    logger.error('Failed to rotate logs: %s', error.message);
    throw error;
  }
}

/**
 * Schedule log rotation
 */
export function scheduleRotation(logDir, intervalMs = 24 * 60 * 60 * 1000) {
  // Run rotation immediately
  rotateLogs(logDir).catch(error => {
    logger.error('Initial rotation failed: %s', error.message);
  });
  
  // Schedule periodic rotation
  const intervalId = setInterval(() => {
    rotateLogs(logDir).catch(error => {
      logger.error('Scheduled rotation failed: %s', error.message);
    });
  }, intervalMs);
  
  // Return cleanup function
  return () => clearInterval(intervalId);
}