import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const cliPath = join(__dirname, '../../bin/taskwerk.js');

describe('aiconfig command integration', () => {
  let tempDir;
  let originalHome;

  beforeEach(() => {
    // Save original HOME
    originalHome = process.env.HOME;

    // Create temp directory
    tempDir = mkdtempSync(join(tmpdir(), 'taskwerk-aiconfig-test-'));
  });

  afterEach(() => {
    // Restore HOME
    process.env.HOME = originalHome;

    // Clean up
    rmSync(tempDir, { recursive: true, force: true });
  });
  it('should show help for aiconfig command', () => {
    return new Promise(resolve => {
      const proc = spawn('node', [cliPath, 'aiconfig', '--help']);
      let output = '';

      proc.stdout.on('data', data => {
        output += data.toString();
      });

      proc.on('close', code => {
        expect(code).toBe(0);
        expect(output).toContain('Configure AI/LLM settings');
        expect(output).toContain('--set');
        expect(output).toContain('--list-providers');
        expect(output).toContain('--choose');
        expect(output).toContain('--test');
        expect(output).toContain('--show');
        resolve();
      });
    });
  });

  it('should list providers', () => {
    return new Promise((resolve, reject) => {
      const proc = spawn('node', [cliPath, 'aiconfig', '--list-providers'], {
        env: { ...process.env, HOME: tempDir },
      });
      let output = '';
      let error = '';

      proc.stdout.on('data', data => {
        output += data.toString();
      });

      proc.stderr.on('data', data => {
        error += data.toString();
      });

      proc.on('close', code => {
        if (code !== 0) {
          reject(new Error(`Process exited with code ${code}: ${error}`));
        } else {
          expect(output).toContain('Available AI Providers');
          expect(output).toContain('anthropic');
          expect(output).toContain('openai');
          expect(output).toContain('ollama');
          resolve();
        }
      });

      proc.on('error', reject);
    });
  }, 10000); // 10 second timeout

  it('should show current configuration', () => {
    return new Promise((resolve, reject) => {
      const proc = spawn('node', [cliPath, 'aiconfig', '--show'], {
        env: { ...process.env, HOME: tempDir },
      });
      let output = '';
      let error = '';

      proc.stdout.on('data', data => {
        output += data.toString();
      });

      proc.stderr.on('data', data => {
        error += data.toString();
      });

      proc.on('close', code => {
        if (code !== 0) {
          reject(new Error(`Process exited with code ${code}: ${error}`));
        } else {
          expect(output).toContain('AI Configuration');
          expect(output).toContain('Current Provider');
          expect(output).toContain('Current Model');
          resolve();
        }
      });

      proc.on('error', reject);
    });
  }, 10000); // 10 second timeout
});
