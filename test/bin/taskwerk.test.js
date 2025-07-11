import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('bin/taskwerk.js', () => {
  it('should exist and be a valid entry point', () => {
    const binPath = join(__dirname, '../../bin/taskwerk.js');
    expect(existsSync(binPath)).toBe(true);
  });

  it('should have proper shebang', () => {
    const binPath = join(__dirname, '../../bin/taskwerk.js');
    const content = readFileSync(binPath, 'utf8');
    expect(content.startsWith('#!/usr/bin/env node')).toBe(true);
  });

  it('should import the CLI module', () => {
    const binPath = join(__dirname, '../../bin/taskwerk.js');
    const content = readFileSync(binPath, 'utf8');
    expect(content).toContain("import '../src/cli/index.js'");
  });
});
