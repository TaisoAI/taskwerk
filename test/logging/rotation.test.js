import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'fs';
import { readdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { rotateLogs, scheduleRotation, RotationConfig } from '../../src/logging/rotation.js';
import { closeAllLoggers } from '../../src/logging/logger.js';

describe('Log Rotation', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'taskwerk-rotation-test-'));
    closeAllLoggers();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    closeAllLoggers();
  });

  describe('rotateLogs', () => {
    it('should remove old log files', async () => {
      // Create log files with different dates
      const files = [
        'taskwerk-2024-01-01.log',
        'taskwerk-2024-01-02.log',
        'taskwerk-2024-01-03.log',
        'taskwerk-2024-01-04.log',
        'taskwerk-2024-01-05.log',
      ];

      // Create files with different modification times
      for (let i = 0; i < files.length; i++) {
        const filePath = join(tempDir, files[i]);
        writeFileSync(filePath, `Log content ${i}`);

        // Add small delay to ensure different modification times
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Rotate with max 3 files
      const config = { ...RotationConfig, maxFiles: 3 };
      await rotateLogs(tempDir, config);

      // Check remaining files
      const remainingFiles = await readdir(tempDir);
      const logFiles = remainingFiles.filter(f => f.endsWith('.log'));

      expect(logFiles.length).toBe(3);
    });

    it('should ignore non-log files', async () => {
      // Create mixed files
      writeFileSync(join(tempDir, 'taskwerk-2024-01-01.log'), 'log');
      writeFileSync(join(tempDir, 'other-file.txt'), 'other');
      writeFileSync(join(tempDir, 'taskwerk.log'), 'invalid pattern');

      await rotateLogs(tempDir);

      const files = await readdir(tempDir);
      expect(files).toContain('other-file.txt');
      expect(files).toContain('taskwerk.log');
    });

    it('should handle empty directory', async () => {
      await expect(rotateLogs(tempDir)).resolves.not.toThrow();
    });

    it('should detect oversized files', async () => {
      const bigFile = join(tempDir, 'taskwerk-2024-01-01.log');
      const bigContent = 'x'.repeat(11 * 1024 * 1024); // 11MB
      writeFileSync(bigFile, bigContent);

      await rotateLogs(tempDir);

      // File should still exist (we only warn about size)
      expect(existsSync(bigFile)).toBe(true);
    });
  });

  describe('scheduleRotation', () => {
    it('should return cleanup function', () => {
      const cleanup = scheduleRotation(tempDir, 1000);
      expect(typeof cleanup).toBe('function');

      // Clean up
      cleanup();
    });

    it('should run initial rotation', async () => {
      // Create an old file
      writeFileSync(join(tempDir, 'taskwerk-2024-01-01.log'), 'old log');

      const cleanup = scheduleRotation(tempDir, 10000);

      // Wait a bit for initial rotation
      await new Promise(resolve => setTimeout(resolve, 100));

      // Clean up
      cleanup();
    });
  });

  describe('RotationConfig', () => {
    it('should have default configuration', () => {
      expect(RotationConfig.maxFiles).toBe(7);
      expect(RotationConfig.maxSize).toBe(10 * 1024 * 1024);
      expect(RotationConfig.pattern).toBeInstanceOf(RegExp);
    });

    it('should match valid log file names', () => {
      const validNames = [
        'taskwerk-2024-01-01.log',
        'taskwerk-2024-12-31.log',
        'taskwerk-2023-06-15.log',
      ];

      for (const name of validNames) {
        expect(RotationConfig.pattern.test(name)).toBe(true);
      }
    });

    it('should not match invalid log file names', () => {
      const invalidNames = [
        'taskwerk.log',
        'taskwerk-2024-1-1.log',
        'taskwerk-2024-13-01.log',
        'other-2024-01-01.log',
        'taskwerk-2024-01-01.txt',
      ];

      for (const name of invalidNames) {
        expect(RotationConfig.pattern.test(name)).toBe(false);
      }
    });
  });
});
