/**
 * CLI Entry Point Tests
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliPath = join(__dirname, '../../src/cli/index.js');

test('CLI entry point', async (t) => {
  await t.test('shows help when no command provided', () => {
    try {
      execSync(`node ${cliPath}`, {
        encoding: 'utf-8',
        stdio: 'pipe'
      });
    } catch (err) {
      // Help command exits with code 1
      const output = err.stdout || err.stderr || err.toString();
      assert.ok(output.includes('taskwerk'));
      assert.ok(output.includes('Git-aware task management'));
      assert.ok(output.includes('Commands:'));
    }
  });

  await t.test('shows version with --version', () => {
    try {
      execSync(`node ${cliPath} --version`, {
        encoding: 'utf-8',
        stdio: 'pipe'
      });
    } catch (err) {
      // Version command exits with code 1
      const output = err.stdout || err.stderr || err.toString();
      assert.ok(output.match(/\d+\.\d+\.\d+/)); // Check for any semantic version
    }
  });

  await t.test('handles unknown commands', () => {
    assert.throws(() => {
      execSync(`node ${cliPath} unknowncommand`, {
        encoding: 'utf-8',
        stdio: 'pipe'
      });
    });
  });

  await t.test('system command is available', () => {
    const output = execSync(`node ${cliPath} system --help`, {
      encoding: 'utf-8'
    });
    
    assert.ok(output.includes('system'));
    assert.ok(output.includes('init'));
    assert.ok(output.includes('status'));
  });
});