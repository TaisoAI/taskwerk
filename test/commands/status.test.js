import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { statusCommand } from '../../src/commands/status.js';
import { setupCommandTest } from '../helpers/command-test-helper.js';
import { existsSync, mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { TaskwerkDatabase } from '../../src/db/database.js';
import { applySchema } from '../../src/db/schema.js';

describe('status command', () => {
  let testSetup;
  let tempDir;
  let originalCwd;

  beforeEach(() => {
    testSetup = setupCommandTest(true); // Enable database

    // Create a temporary directory and change to it
    tempDir = mkdtempSync(join(tmpdir(), 'taskwerk-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);

    // Create .taskwerk directory and database file in temp directory for the test
    const taskwerkDir = '.taskwerk';
    if (!existsSync(taskwerkDir)) {
      mkdirSync(taskwerkDir, { recursive: true });
    }

    // Create the database file that the status command expects
    const dbPath = join(taskwerkDir, 'taskwerk.db');
    const db = new TaskwerkDatabase(dbPath);
    const connection = db.connect();
    applySchema(connection);
    db.close();

    // Create a minimal config file
    const configPath = join(taskwerkDir, 'config.yml');
    writeFileSync(configPath, 'general:\n  version: 1.0.0\n');
  });

  afterEach(() => {
    testSetup.cleanup();

    // Change back to original directory
    process.chdir(originalCwd);

    // Clean up temp directory
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should create command with correct name and description', () => {
    const command = statusCommand();
    expect(command.name()).toBe('status');
    expect(command.description()).toBe('Show taskwerk repository status');
  });

  it('should have format option', () => {
    const command = statusCommand();
    const optionNames = command.options.map(opt => opt.long);
    expect(optionNames).toContain('--format');
  });

  it('should show taskwerk status when executed', async () => {
    const command = statusCommand();
    await command.parseAsync(['status'], { from: 'user' });

    // Check for status output
    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('📊 Taskwerk Status')
    );
  });
});
