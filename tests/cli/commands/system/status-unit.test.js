/**
 * Status Command Unit Tests
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { makeStatusCommand } from '../../../../src/cli/commands/system/status.js';

test('Status command unit tests', async (t) => {
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

  await t.test('makeStatusCommand creates a command', () => {
    const cmd = makeStatusCommand();
    assert.equal(cmd.name(), 'status');
    assert.ok(cmd.description().includes('status'));
  });

  await t.test('status fails when not initialized', async () => {
    const cmd = makeStatusCommand();
    
    try {
      await cmd.parseAsync(['node', 'status'], { from: 'user' });
      assert.fail('Should have thrown');
    } catch (err) {
      assert.equal(exitCode, 1);
      const errorLogs = consoleOutput.filter(([type]) => type === 'error');
      assert.ok(errorLogs.some(log => log.join(' ').includes('not initialized')));
    }
  });

  await t.test('status shows info when initialized', async () => {
    // Create .taskwerk directory
    mkdirSync(join(tempDir, '.taskwerk'), { recursive: true });
    
    const cmd = makeStatusCommand();
    await cmd.parseAsync(['node', 'status'], { from: 'user' });
    
    const logs = consoleOutput.filter(([type]) => type === 'log');
    assert.ok(logs.some(log => log.join(' ').includes('Taskwerk Status')));
    assert.ok(logs.some(log => log.join(' ').includes('✓ Taskwerk initialized')));
    assert.ok(logs.some(log => log.join(' ').includes('.taskwerk/')));
  });
});