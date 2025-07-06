/**
 * Init Command Unit Tests
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { makeInitCommand } from '../../../../src/cli/commands/system/init.js';

test('Init command unit tests', async (t) => {
  let tempDir;
  let originalCwd;
  let originalExit;
  let exitCode;
  let consoleOutput;
  let originalConsoleLog;
  let originalConsoleError;

  t.beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'taskwerk-test-'));
    originalCwd = process.cwd();
    originalExit = process.exit;
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    
    process.chdir(tempDir);
    exitCode = null;
    consoleOutput = [];
    
    process.exit = (code) => { 
      exitCode = code; 
      throw new Error(`Process exit with code ${code}`);
    };
    console.log = (...args) => consoleOutput.push(['log', ...args]);
    console.error = (...args) => consoleOutput.push(['error', ...args]);
  });

  t.afterEach(() => {
    process.chdir(originalCwd);
    process.exit = originalExit;
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    rmSync(tempDir, { recursive: true, force: true });
  });

  await t.test('makeInitCommand creates a command', () => {
    const cmd = makeInitCommand();
    assert.equal(cmd.name(), 'init');
    assert.ok(cmd.description().includes('Initialize'));
  });

  await t.test('init creates .taskwerk directory', async () => {
    const cmd = makeInitCommand();
    await cmd.parseAsync(['node', 'init'], { from: 'user' });

    assert.ok(existsSync(join(tempDir, '.taskwerk')));
    assert.ok(existsSync(join(tempDir, '.taskwerk/taskwerk_rules.md')));
    
    // Check success message
    const successLogs = consoleOutput.filter(([type]) => type === 'log');
    assert.ok(successLogs.some(log => log.join(' ').includes('✓ Taskwerk initialized')));
  });

  await t.test('init fails if already exists', async () => {
    const cmd = makeInitCommand();
    
    // First init
    await cmd.parseAsync(['node', 'init'], { from: 'user' });
    
    // Reset console output
    consoleOutput = [];
    
    // Second init should fail
    try {
      await cmd.parseAsync(['node', 'init'], { from: 'user' });
      assert.fail('Should have thrown');
    } catch (err) {
      assert.equal(exitCode, 1);
      const errorLogs = consoleOutput.filter(([type]) => type === 'error');
      assert.ok(errorLogs.some(log => log.join(' ').includes('already initialized')));
    }
  });

  await t.test('init with --force reinitializes', async () => {
    const cmd = makeInitCommand();
    
    // First init
    await cmd.parseAsync(['node', 'init'], { from: 'user' });
    
    // Reset state
    consoleOutput = [];
    exitCode = null;
    
    // Force init should succeed
    await cmd.parseAsync(['node', 'init', '--force'], { from: 'user' });
    
    assert.ok(existsSync(join(tempDir, '.taskwerk')));
    assert.equal(exitCode, null); // Should not exit with error
  });
});