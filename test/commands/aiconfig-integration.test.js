import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const cliPath = join(__dirname, '../../bin/taskwerk.js');

describe('aiconfig command integration', () => {
  it('should show help for aiconfig command', () => {
    return new Promise((resolve) => {
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
    return new Promise((resolve) => {
      const proc = spawn('node', [cliPath, 'aiconfig', '--list-providers']);
      let output = '';

      proc.stdout.on('data', data => {
        output += data.toString();
      });

      proc.on('close', code => {
        expect(code).toBe(0);
        expect(output).toContain('Available AI Providers');
        expect(output).toContain('anthropic');
        expect(output).toContain('openai');
        expect(output).toContain('ollama');
        resolve();
      });
    });
  });

  it('should show current configuration', () => {
    return new Promise((resolve) => {
      const proc = spawn('node', [cliPath, 'aiconfig', '--show']);
      let output = '';

      proc.stdout.on('data', data => {
        output += data.toString();
      });

      proc.on('close', code => {
        expect(code).toBe(0);
        expect(output).toContain('AI Configuration');
        expect(output).toContain('Current Provider');
        expect(output).toContain('Current Model');
        resolve();
      });
    });
  });
});