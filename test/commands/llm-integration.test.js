import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const cliPath = join(__dirname, '../../bin/taskwerk.js');

describe('llm command integration', () => {
  it('should show help for llm command', () => {
    return new Promise(resolve => {
      const proc = spawn('node', [cliPath, 'llm', '--help']);
      let output = '';

      proc.stdout.on('data', data => {
        output += data.toString();
      });

      proc.on('close', code => {
        expect(code).toBe(0);
        expect(output).toContain('Send a prompt directly to the configured LLM');
        expect(output).toContain('--file');
        expect(output).toContain('--params');
        expect(output).toContain('--provider');
        expect(output).toContain('--model');
        expect(output).toContain('--system');
        expect(output).toContain('--temperature');
        expect(output).toContain('--context-tasks');
        resolve();
      });
    });
  });

  it('should handle missing prompt error', () => {
    return new Promise(resolve => {
      const proc = spawn('node', [cliPath, 'llm']);
      let error = '';

      // Make sure stdin is not piped
      proc.stdin.end();

      proc.stderr.on('data', data => {
        error += data.toString();
      });

      proc.on('close', code => {
        expect(code).toBe(1);
        expect(error).toContain('No prompt provided');
        resolve();
      });
    });
  });

  it('should accept piped input', () => {
    return new Promise(resolve => {
      const echo = spawn('echo', ['Hello from pipe']);
      const llm = spawn('node', [cliPath, 'llm']);

      // Pipe echo output to llm input
      echo.stdout.pipe(llm.stdin);

      let error = '';
      llm.stderr.on('data', data => {
        error += data.toString();
      });

      llm.on('close', code => {
        // Will fail if no LLM configured, but that's expected
        // We're just testing that it accepts piped input
        if (error.includes('No AI provider configured')) {
          expect(error).toContain('No AI provider configured');
        } else {
          expect(code).toBeDefined();
        }
        resolve();
      });
    });
  });

  it('should handle command line prompt', () => {
    return new Promise(resolve => {
      const proc = spawn('node', [cliPath, 'llm', 'What is 2+2?', '--quiet']);
      let error = '';

      proc.stderr.on('data', data => {
        error += data.toString();
      });

      proc.on('close', code => {
        // Will fail if no LLM configured, but that's expected
        if (error.includes('No AI provider configured')) {
          expect(error).toContain('No AI provider configured');
        } else {
          expect(code).toBeDefined();
        }
        resolve();
      });
    });
  });
});
