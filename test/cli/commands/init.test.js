/**
 * Init Command Tests
 * 
 * @description Tests for the init command
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeInitCommand } from '../../../src/cli/commands/system/init.js';
import { join } from 'path';
import { rmSync, existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Init Command', () => {
  const testDir = join(__dirname, '../../temp/test-init');
  const taskwerkDir = join(testDir, '.taskwerk');
  let originalCwd;
  let consoleLogSpy;
  let consoleErrorSpy;
  let processExitSpy;
  
  beforeEach(() => {
    // Save original cwd
    originalCwd = process.cwd();
    
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    
    // Create test directory and change to it
    rmSync(testDir, { recursive: true, force: true });
    require('fs').mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);
    
    // Mock console and process.exit
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });
  
  afterEach(() => {
    // Restore mocks
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
    
    // Restore cwd
    process.chdir(originalCwd);
    
    // Clean up
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should initialize taskwerk project', async () => {
    const command = makeInitCommand();
    await command.parseAsync(['node', 'test']);
    
    // Check directory was created
    expect(existsSync(taskwerkDir)).toBe(true);
    
    // Check rules file was created
    const rulesPath = join(taskwerkDir, 'taskwerk_rules.md');
    expect(existsSync(rulesPath)).toBe(true);
    
    const rulesContent = readFileSync(rulesPath, 'utf-8');
    expect(rulesContent).toContain('# Taskwerk Project Rules');
    
    // Check database was created
    const dbPath = join(taskwerkDir, 'taskwerk.db');
    expect(existsSync(dbPath)).toBe(true);
    
    // Verify database schema
    const db = new Database(dbPath);
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all();
    db.close();
    
    const tableNames = tables.map(t => t.name);
    expect(tableNames).toContain('tasks');
    expect(tableNames).toContain('schema_version');
    
    // Check success message
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('✓ Taskwerk initialized successfully!'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Created .taskwerk/taskwerk.db'));
  });

  it('should fail if already initialized', async () => {
    // First init
    const command1 = makeInitCommand();
    await command1.parseAsync(['node', 'test']);
    
    // Second init should fail
    const command2 = makeInitCommand();
    
    await expect(async () => {
      await command2.parseAsync(['node', 'test']);
    }).rejects.toThrow('process.exit called');
    
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error: Taskwerk is already initialized'));
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should force reinitialize with --force', async () => {
    // First init
    const command1 = makeInitCommand();
    await command1.parseAsync(['node', 'test']);
    
    // Clear mocks
    consoleLogSpy.mockClear();
    
    // Force reinit
    const command2 = makeInitCommand();
    await command2.parseAsync(['node', 'test', '--force']);
    
    // Should succeed
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('✓ Taskwerk initialized successfully!'));
    expect(processExitSpy).not.toHaveBeenCalled();
  });
});