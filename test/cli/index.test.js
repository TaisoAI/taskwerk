import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const cliPath = join(__dirname, '../../bin/taskwerk.js');

describe('CLI Entry Point', () => {
  it('should display version when --version flag is used', () => {
    return new Promise((resolve) => {
      const proc = spawn('node', [cliPath, '--version']);
      let output = '';

      proc.stdout.on('data', data => {
        output += data.toString();
      });

      proc.on('close', code => {
        expect(code).toBe(0);
        expect(output.trim()).toMatch(/^\d+\.\d+\.\d+(\.\d+)?$/);
        resolve();
      });
    });
  });

  it('should display help when --help flag is used', () => {
    return new Promise((resolve) => {
      const proc = spawn('node', [cliPath, '--help']);
      let output = '';

      proc.stdout.on('data', data => {
        output += data.toString();
      });

      proc.on('close', code => {
        expect(code).toBe(0);
        expect(output).toContain('Usage: taskwerk');
        expect(output).toContain('A task management CLI');
        expect(output).toContain('Commands:');
        expect(output).toContain('about');
        resolve();
      });
    });
  });

  it('should execute about command', () => {
    return new Promise((resolve) => {
      const proc = spawn('node', [cliPath, 'about']);
      let output = '';

      proc.stdout.on('data', data => {
        output += data.toString();
      });

      proc.on('close', code => {
        expect(code).toBe(0);
        expect(output).toContain('taskwerk');
        expect(output).toContain('0.6.5');
        resolve();
      });
    });
  });

  it('should display error for unknown command', () => {
    return new Promise((resolve) => {
      const proc = spawn('node', [cliPath, 'unknown']);
      let error = '';

      proc.stderr.on('data', data => {
        error += data.toString();
      });

      proc.on('close', code => {
        expect(code).toBe(1);
        expect(error).toContain("error: unknown command 'unknown'");
        resolve();
      });
    });
  });
});
