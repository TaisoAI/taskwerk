import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('CLI Index Structure Tests', () => {
  const cliPath = join(__dirname, '../../src/cli/index.js');

  it('should exist', () => {
    expect(existsSync(cliPath)).toBe(true);
  });

  it('should import commander', () => {
    const content = readFileSync(cliPath, 'utf8');
    expect(content).toContain("import { Command } from 'commander'");
  });

  it('should import about command', () => {
    const content = readFileSync(cliPath, 'utf8');
    expect(content).toContain("import { aboutCommand } from '../commands/about.js'");
  });

  it('should create a program instance', () => {
    const content = readFileSync(cliPath, 'utf8');
    expect(content).toContain('const program = new Command()');
  });

  it('should configure program name and description', () => {
    const content = readFileSync(cliPath, 'utf8');
    expect(content).toContain('.name(');
    expect(content).toContain('.description(');
    expect(content).toContain('.version(');
  });

  it('should add about command', () => {
    const content = readFileSync(cliPath, 'utf8');
    expect(content).toContain('program.addCommand(aboutCommand())');
  });

  it('should parse process.argv', () => {
    const content = readFileSync(cliPath, 'utf8');
    expect(content).toContain('program.parse(process.argv)');
  });
});