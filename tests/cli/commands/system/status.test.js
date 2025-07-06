/**
 * Status Command Tests
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync, existsSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliPath = join(__dirname, '../../../../src/cli/index.js');

test('Status command', async (t) => {
  let tempDir;

  t.beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'taskwerk-test-'));
    process.chdir(tempDir);
  });

  t.afterEach(() => {
    process.chdir(__dirname);
    rmSync(tempDir, { recursive: true, force: true });
  });

  await t.test('fails when not initialized', () => {
    assert.throws(() => {
      execSync(`node ${cliPath} status`, {
        cwd: tempDir,
        stdio: 'pipe'
      });
    }, 'Should throw when not initialized');
  });

  await t.test('shows status when initialized', () => {
    // Initialize first
    execSync(`node ${cliPath} init`, {
      cwd: tempDir,
      stdio: 'pipe'
    });

    // Check status
    const output = execSync(`node ${cliPath} status`, {
      cwd: tempDir,
      encoding: 'utf-8'
    });

    assert.ok(output.includes('Taskwerk Status'));
    assert.ok(output.includes('✓ Taskwerk initialized'));
    assert.ok(output.includes('.taskwerk/'));
  });
});