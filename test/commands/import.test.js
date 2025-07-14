import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { importCommand } from '../../src/commands/import.js';
import { setupCommandTest } from '../helpers/command-test-helper.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('import command', () => {
  let testSetup;
  let tempDir;

  beforeEach(async () => {
    testSetup = setupCommandTest(true); // Enable database
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'taskwerk-test-'));
  });

  afterEach(async () => {
    testSetup.cleanup();
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should create command with correct name and description', () => {
    const command = importCommand();
    expect(command.name()).toBe('import');
    expect(command.description()).toBe('Import tasks from a file');
  });

  it('should have required file argument', () => {
    const command = importCommand();
    const fileArg = command._args[0];
    expect(fileArg.name()).toBe('file');
    expect(fileArg.required).toBe(true);
  });

  it('should have all expected options', () => {
    const command = importCommand();
    const optionNames = command.options.map(opt => opt.long);

    expect(optionNames).toContain('--format');
    expect(optionNames).toContain('--update');
    expect(optionNames).toContain('--prefix');
    expect(optionNames).toContain('--dry-run');
  });

  it('should handle file not found error', async () => {
    const command = importCommand();
    
    // Mock process.exit to prevent test from exiting
    const originalExit = process.exit;
    process.exit = () => { throw new Error('Process exit called'); };
    
    try {
      await command.parseAsync(['nonexistent.md'], { from: 'user' });
    } catch (error) {
      expect(error.message).toBe('Process exit called');
    }
    
    process.exit = originalExit;
    
    expect(testSetup.consoleErrorSpy).toHaveBeenCalledWith(
      '❌ Import failed:',
      expect.stringContaining('File not found')
    );
  });

  it('should handle empty file', async () => {
    const emptyFile = path.join(tempDir, 'empty.md');
    await fs.writeFile(emptyFile, '');

    const command = importCommand();
    await command.parseAsync([emptyFile], { from: 'user' });

    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith('❌ File is empty');
  });

  it('should import markdown tasks successfully', async () => {
    const markdownFile = path.join(tempDir, 'tasks.md');
    const markdownContent = `# Test Tasks

## TASK-100: Test markdown import
- Status: todo
- Priority: high
- Assignee: tester
- Estimate: 2 hours
- Tags: test, import
- Category: testing

This is a test task description.

### Details
Additional task details here.

### Notes
- [2025-07-13 21:00:00] @tester: Initial note
- [2025-07-13 21:01:00] @admin: Admin note

---

## Simple Task
- Status: in-progress
- Priority: medium

Basic task without ID.

---`;

    await fs.writeFile(markdownFile, markdownContent);

    const command = importCommand();
    await command.parseAsync([markdownFile], { from: 'user' });

    // Check for success messages
    const successMessages = testSetup.consoleLogSpy.mock.calls
      .filter(call => call[0].includes('✅ Imported:'));
    
    expect(successMessages).toHaveLength(2);
    expect(successMessages[0][0]).toContain('TASK-100');
    expect(successMessages[1][0]).toContain('TASK-001'); // Auto-generated ID

    // Check summary
    const summaryCall = testSetup.consoleLogSpy.mock.calls
      .find(call => call[0].includes('📊 Import Summary:'));
    expect(summaryCall).toBeTruthy();
  });

  it('should import JSON tasks successfully', async () => {
    const jsonFile = path.join(tempDir, 'tasks.json');
    const jsonContent = JSON.stringify([
      {
        id: 'JSON-001',
        name: 'JSON test task',
        description: 'Test JSON import',
        status: 'todo',
        priority: 'medium',
        assignee: 'json-tester',
        estimate: 3,
        category: 'testing'
      },
      {
        id: 'JSON-002',
        name: 'Another JSON task',
        status: 'in-progress',
        priority: 'high'
      }
    ], null, 2);

    await fs.writeFile(jsonFile, jsonContent);

    const command = importCommand();
    await command.parseAsync([jsonFile, '--format', 'json'], { from: 'user' });

    // Check for success messages
    const successMessages = testSetup.consoleLogSpy.mock.calls
      .filter(call => call[0].includes('✅ Imported:'));
    
    expect(successMessages).toHaveLength(2);
    expect(successMessages[0][0]).toContain('JSON-001');
    expect(successMessages[1][0]).toContain('JSON-002');
  });

  it('should import CSV tasks successfully', async () => {
    const csvFile = path.join(tempDir, 'tasks.csv');
    const csvContent = `ID,Name,Description,Status,Priority,Assignee,Estimate,Category
CSV-001,"CSV test task","Test CSV import",todo,high,csv-tester,4,testing
CSV-002,"Another CSV task","",in-progress,medium,,2,`;

    await fs.writeFile(csvFile, csvContent);

    const command = importCommand();
    await command.parseAsync([csvFile, '--format', 'csv'], { from: 'user' });

    // Check for success messages
    const successMessages = testSetup.consoleLogSpy.mock.calls
      .filter(call => call[0].includes('✅ Imported:'));
    
    expect(successMessages).toHaveLength(2);
    expect(successMessages[0][0]).toContain('CSV-001');
    expect(successMessages[1][0]).toContain('CSV-002');
  });

  it('should preview import with dry run', async () => {
    const markdownFile = path.join(tempDir, 'preview.md');
    const markdownContent = `## TASK-200: Preview task
- Status: todo
- Priority: medium

Task for preview testing.`;

    await fs.writeFile(markdownFile, markdownContent);

    const command = importCommand();
    await command.parseAsync([markdownFile, '--dry-run'], { from: 'user' });

    // Check for preview output
    const previewCall = testSetup.consoleLogSpy.mock.calls
      .find(call => call[0].includes('📋 Import Preview'));
    expect(previewCall).toBeTruthy();
    
    const previewDetails = testSetup.consoleLogSpy.mock.calls
      .find(call => call[0].includes('1. TASK-200: Preview task'));
    expect(previewDetails).toBeTruthy();
  });

  it('should skip existing tasks by default', async () => {
    // First import
    const markdownFile = path.join(tempDir, 'duplicate.md');
    const markdownContent = `## TASK-300: Duplicate task
- Status: todo
- Priority: medium

Duplicate test task.`;

    await fs.writeFile(markdownFile, markdownContent);

    const command = importCommand();
    
    // Import once
    await command.parseAsync([markdownFile], { from: 'user' });
    
    // Clear console spy
    testSetup.consoleLogSpy.mockClear();
    
    // Import again
    await command.parseAsync([markdownFile], { from: 'user' });

    // Check for skip message
    const skipMessage = testSetup.consoleLogSpy.mock.calls
      .find(call => call[0].includes('⏭️  Skipped:'));
    expect(skipMessage).toBeTruthy();
    expect(skipMessage[0]).toContain('TASK-300');
  });

  it('should add prefix to task IDs', async () => {
    const markdownFile = path.join(tempDir, 'prefix.md');
    const markdownContent = `## TASK-400: Prefix task
- Status: todo
- Priority: medium

Task for prefix testing.`;

    await fs.writeFile(markdownFile, markdownContent);

    const command = importCommand();
    await command.parseAsync([markdownFile, '--prefix', 'TEST-'], { from: 'user' });

    // Check for prefixed ID  
    const successMessage = testSetup.consoleLogSpy.mock.calls
      .find(call => call[0] && call[0].includes('✅ Imported:'));
    expect(successMessage).toBeTruthy();
    expect(successMessage[0]).toContain('TEST-400'); // Prefix replaces TASK- with TEST-
  });

  it('should handle invalid JSON format', async () => {
    const jsonFile = path.join(tempDir, 'invalid.json');
    await fs.writeFile(jsonFile, '{ invalid json }');

    const command = importCommand();
    
    // Mock process.exit
    const originalExit = process.exit;
    process.exit = () => { throw new Error('Process exit called'); };
    
    try {
      await command.parseAsync([jsonFile, '--format', 'json'], { from: 'user' });
    } catch (error) {
      expect(error.message).toBe('Process exit called');
    }
    
    process.exit = originalExit;
    
    expect(testSetup.consoleErrorSpy).toHaveBeenCalledWith(
      '❌ Import failed:',
      expect.stringContaining('Invalid JSON format')
    );
  });

  it('should handle CSV with special characters', async () => {
    const csvFile = path.join(tempDir, 'special.csv');
    const csvContent = `ID,Name,Description
SPECIAL-001,"Task with, comma","Task with ""quotes"" and
newline"`;

    await fs.writeFile(csvFile, csvContent);

    const command = importCommand();
    await command.parseAsync([csvFile, '--format', 'csv'], { from: 'user' });

    // Check for success
    const successMessage = testSetup.consoleLogSpy.mock.calls
      .find(call => call[0].includes('✅ Imported:'));
    expect(successMessage).toBeTruthy();
    expect(successMessage[0]).toContain('Task with, comma');
  });
});
