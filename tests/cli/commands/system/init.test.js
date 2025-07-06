/**
 * Init Command Tests
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('Init command', async (t) => {
  // Create a temporary directory for each test
  let tempDir;

  t.beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'taskwerk-test-'));
    process.chdir(tempDir);
  });

  t.afterEach(() => {
    process.chdir(__dirname);
    rmSync(tempDir, { recursive: true, force: true });
  });

  await t.test('initializes taskwerk in current directory', () => {
    // Run init command
    execSync('node ' + join(__dirname, '../../../../src/cli/index.js') + ' init', {
      cwd: tempDir
    });

    // Check that .taskwerk directory was created
    assert.ok(existsSync(join(tempDir, '.taskwerk')));
    assert.ok(existsSync(join(tempDir, '.taskwerk/taskwerk_rules.md')));
  });

  await t.test('fails if already initialized', () => {
    // First init
    execSync('node ' + join(__dirname, '../../../../src/cli/index.js') + ' init', {
      cwd: tempDir
    });

    // Second init should fail
    assert.throws(() => {
      execSync('node ' + join(__dirname, '../../../../src/cli/index.js') + ' init', {
        cwd: tempDir
      });
    }, 'Should throw when already initialized');
  });

  await t.test('force flag allows reinitializing', () => {
    // First init
    execSync('node ' + join(__dirname, '../../../../src/cli/index.js') + ' init', {
      cwd: tempDir
    });

    // Second init with force should work
    execSync('node ' + join(__dirname, '../../../../src/cli/index.js') + ' init --force', {
      cwd: tempDir
    });

    assert.ok(existsSync(join(tempDir, '.taskwerk')));
  });
});