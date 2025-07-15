import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { statusCommand } from '../../src/commands/status.js';
import { setupCommandTest } from '../helpers/command-test-helper.js';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { TaskwerkDatabase } from '../../src/db/database.js';
import { applySchema } from '../../src/db/schema.js';

describe('status command', () => {
  let testSetup;

  beforeEach(() => {
    testSetup = setupCommandTest(true); // Enable database

    // Create .taskwerk directory and database file in current directory for the test
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

    // Clean up test directory
    const taskwerkDir = '.taskwerk';
    if (existsSync(taskwerkDir)) {
      rmSync(taskwerkDir, { recursive: true, force: true });
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
