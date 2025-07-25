import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exportCommand } from '../../src/commands/export.js';
import { setupCommandTest } from '../helpers/command-test-helper.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('export command', () => {
  let testSetup;
  let tempDir;

  beforeEach(async () => {
    testSetup = setupCommandTest(true); // Enable database
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'taskwerk-test-'));

    // Create test tasks
    const { TaskwerkAPI } = await import('../../src/api/taskwerk-api.js');
    const api = new TaskwerkAPI();

    // Create tasks with various statuses
    await api.createTask({
      id: 'TASK-100',
      name: 'Active task',
      description: 'This is an active task',
      status: 'in-progress',
      priority: 'high',
      assignee: 'john',
      estimate: 5,
      created_by: 'user',
    });

    await api.createTask({
      id: 'TASK-101',
      name: 'Todo task',
      status: 'todo',
      priority: 'medium',
      category: 'backend',
      created_by: 'user',
    });

    await api.createTask({
      id: 'TASK-102',
      name: 'Completed task',
      status: 'completed',
      priority: 'low',
      created_by: 'user',
    });

    // Add tags to first task
    await api.addTaskTags('TASK-100', ['feature', 'urgent'], 'user');

    // Add note to first task
    await api.addTaskNote(
      'TASK-100',
      'This needs review',
      'user',
      'Please check the implementation details'
    );
  });

  afterEach(async () => {
    testSetup.cleanup();
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should create command with correct name and description', () => {
    const command = exportCommand();
    expect(command.name()).toBe('export');
    expect(command.description()).toBe('Export tasks to a file');
  });

  it('should have all expected options', () => {
    const command = exportCommand();
    const optionNames = command.options.map(opt => opt.long);

    expect(optionNames).toContain('--format');
    expect(optionNames).toContain('--output');
    expect(optionNames).toContain('--status');
    expect(optionNames).toContain('--assignee');
    expect(optionNames).toContain('--all');
    expect(optionNames).toContain('--with-metadata');
  });

  it('should export to markdown file by default', async () => {
    const command = exportCommand();
    await command.parseAsync([], { from: 'user' });

    // Check for export success message
    const successMessage = testSetup.consoleLogSpy.mock.calls.find(call =>
      call[0].includes('✅ Exported')
    )?.[0];

    expect(successMessage).toBeTruthy();
    expect(successMessage).toMatch(/✅ Exported 2 tasks to tasks-export-\d{4}-\d{2}-\d{2}\.md/);

    // Extract filename from success message
    const filename = successMessage.match(/tasks-export-\d{4}-\d{2}-\d{2}\.md/)?.[0];
    expect(filename).toBeTruthy();

    // Read and verify file content
    const content = await fs.readFile(filename, 'utf8');
    expect(content).toContain('# Tasks Export');
    expect(content).toContain('## TASK-100: Active task');
    expect(content).toContain('## TASK-101: Todo task');
    // Should not include completed by default
    expect(content).not.toContain('## TASK-102: Completed task');

    // Clean up the generated file
    await fs.unlink(filename);
  });

  it('should include completed tasks with --all flag', async () => {
    const command = exportCommand();
    await command.parseAsync(['--all'], { from: 'user' });

    // Check for export success message
    const successMessage = testSetup.consoleLogSpy.mock.calls.find(call =>
      call[0].includes('✅ Exported')
    )?.[0];

    expect(successMessage).toBeTruthy();
    expect(successMessage).toMatch(/✅ Exported 3 tasks to tasks-export-\d{4}-\d{2}-\d{2}\.md/);

    // Extract filename from success message
    const filename = successMessage.match(/tasks-export-\d{4}-\d{2}-\d{2}\.md/)?.[0];
    const content = await fs.readFile(filename, 'utf8');
    expect(content).toContain('## TASK-102: Completed task');

    // Clean up
    await fs.unlink(filename);
  });

  it('should filter by status', async () => {
    const command = exportCommand();
    await command.parseAsync(['--status', 'in-progress'], { from: 'user' });

    // Check for export success message
    const successMessage = testSetup.consoleLogSpy.mock.calls.find(call =>
      call[0].includes('✅ Exported')
    )?.[0];

    expect(successMessage).toBeTruthy();
    expect(successMessage).toMatch(/✅ Exported 1 tasks to tasks-export-\d{4}-\d{2}-\d{2}\.md/);

    // Extract filename and verify content
    const filename = successMessage.match(/tasks-export-\d{4}-\d{2}-\d{2}\.md/)?.[0];
    const content = await fs.readFile(filename, 'utf8');
    expect(content).toContain('## TASK-100: Active task');
    expect(content).not.toContain('## TASK-101: Todo task');

    // Clean up
    await fs.unlink(filename);
  });

  it('should filter by assignee', async () => {
    const command = exportCommand();
    await command.parseAsync(['--assignee', 'john'], { from: 'user' });

    // Check for export success message
    const successMessage = testSetup.consoleLogSpy.mock.calls.find(call =>
      call[0].includes('✅ Exported')
    )?.[0];

    expect(successMessage).toBeTruthy();
    expect(successMessage).toMatch(/✅ Exported 1 tasks to tasks-export-\d{4}-\d{2}-\d{2}\.md/);

    // Extract filename and verify content
    const filename = successMessage.match(/tasks-export-\d{4}-\d{2}-\d{2}\.md/)?.[0];
    const content = await fs.readFile(filename, 'utf8');
    expect(content).toContain('## TASK-100: Active task');
    expect(content).not.toContain('## TASK-101: Todo task');

    // Clean up
    await fs.unlink(filename);
  });

  it('should export to JSON format', async () => {
    const command = exportCommand();
    await command.parseAsync(['--format', 'json'], { from: 'user' });

    // Check for export success message
    const successMessage = testSetup.consoleLogSpy.mock.calls.find(call =>
      call[0].includes('✅ Exported')
    )?.[0];

    expect(successMessage).toBeTruthy();
    expect(successMessage).toMatch(/✅ Exported 2 tasks to tasks-export-\d{4}-\d{2}-\d{2}\.json/);

    // Extract filename and verify content
    const filename = successMessage.match(/tasks-export-\d{4}-\d{2}-\d{2}\.json/)?.[0];
    const content = await fs.readFile(filename, 'utf8');
    const tasks = JSON.parse(content);

    expect(Array.isArray(tasks)).toBe(true);
    expect(tasks.length).toBe(2); // Active and todo tasks
    expect(tasks.find(t => t.id === 'TASK-100')).toBeTruthy();
    expect(tasks.find(t => t.id === 'TASK-101')).toBeTruthy();

    // Clean up
    await fs.unlink(filename);
  });

  it('should export to CSV format', async () => {
    const command = exportCommand();
    await command.parseAsync(['--format', 'csv'], { from: 'user' });

    // Check for export success message
    const successMessage = testSetup.consoleLogSpy.mock.calls.find(call =>
      call[0].includes('✅ Exported')
    )?.[0];

    expect(successMessage).toBeTruthy();
    expect(successMessage).toMatch(/✅ Exported 2 tasks to tasks-export-\d{4}-\d{2}-\d{2}\.csv/);

    // Extract filename and verify content
    const filename = successMessage.match(/tasks-export-\d{4}-\d{2}-\d{2}\.csv/)?.[0];
    const content = await fs.readFile(filename, 'utf8');
    const lines = content.split('\n');

    expect(lines[0]).toContain('ID,Name,Description,Status,Priority');
    expect(content).toContain('TASK-100,Active task');
    expect(content).toContain('TASK-101,Todo task');

    // Clean up
    await fs.unlink(filename);
  });

  it('should write to file when output specified', async () => {
    const outputFile = path.join(tempDir, 'export.md');
    const command = exportCommand();

    await command.parseAsync(['--output', outputFile], { from: 'user' });

    // Check for export success message in console log calls
    const successMessage = testSetup.consoleLogSpy.mock.calls.find(call =>
      call[0].includes('✅ Exported')
    )?.[0];

    expect(successMessage).toContain('✅ Exported 2 tasks to');
    expect(successMessage).toContain(outputFile);

    // Verify file was created
    const content = await fs.readFile(outputFile, 'utf8');
    expect(content).toContain('# Tasks Export');
    expect(content).toContain('TASK-100');
  });

  it('should include metadata with --with-metadata flag', async () => {
    const command = exportCommand();
    await command.parseAsync(['--format', 'markdown', '--with-metadata'], { from: 'user' });

    // Check for export success message
    const successMessage = testSetup.consoleLogSpy.mock.calls.find(call =>
      call[0].includes('✅ Exported')
    )?.[0];

    expect(successMessage).toBeTruthy();

    // Extract filename and verify content
    const filename = successMessage.match(/tasks-export-\d{4}-\d{2}-\d{2}\.md/)?.[0];
    const content = await fs.readFile(filename, 'utf8');

    expect(content).toContain('---');
    expect(content).toContain('title: Tasks Export');
    expect(content).toContain('taskCount: 2');

    // Clean up
    await fs.unlink(filename);
  });

  it('should include tags in markdown export', async () => {
    const command = exportCommand();
    await command.parseAsync(['--status', 'in-progress'], { from: 'user' });

    // Check for export success message and get filename
    const successMessage = testSetup.consoleLogSpy.mock.calls.find(call =>
      call[0].includes('✅ Exported')
    )?.[0];

    const filename = successMessage.match(/tasks-export-\d{4}-\d{2}-\d{2}\.md/)?.[0];
    const content = await fs.readFile(filename, 'utf8');

    expect(content).toContain('- Tags: feature, urgent');

    // Clean up
    await fs.unlink(filename);
  });

  it('should include notes in markdown export', async () => {
    const command = exportCommand();
    await command.parseAsync(['--status', 'in-progress'], { from: 'user' });

    // Check for export success message and get filename
    const successMessage = testSetup.consoleLogSpy.mock.calls.find(call =>
      call[0].includes('✅ Exported')
    )?.[0];

    const filename = successMessage.match(/tasks-export-\d{4}-\d{2}-\d{2}\.md/)?.[0];
    const content = await fs.readFile(filename, 'utf8');

    expect(content).toContain('### Notes');
    expect(content).toContain('@user: This needs review');
    expect(content).toContain('Please check the implementation details');

    // Clean up
    await fs.unlink(filename);
  });

  it('should handle no tasks found', async () => {
    const command = exportCommand();
    await command.parseAsync(['--status', 'blocked'], { from: 'user' });

    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith('No tasks found matching the criteria.');
  });

  it('should output to stdout with --stdout flag', async () => {
    const command = exportCommand();
    await command.parseAsync(['--stdout'], { from: 'user' });

    // Find the markdown output in stdout
    const output = testSetup.consoleLogSpy.mock.calls.find(call =>
      call[0].includes('# Tasks Export')
    )?.[0];

    expect(output).toBeTruthy();
    expect(output).toContain('# Tasks Export');
    expect(output).toContain('## TASK-100: Active task');
    expect(output).toContain('## TASK-101: Todo task');
    // Should not include completed by default
    expect(output).not.toContain('## TASK-102: Completed task');
  });

  it('should output JSON to stdout with --stdout flag', async () => {
    const command = exportCommand();
    await command.parseAsync(['--format', 'json', '--stdout'], { from: 'user' });

    // Find the JSON output in the console log calls
    const output = testSetup.consoleLogSpy.mock.calls.find(call => {
      try {
        // Try to parse as JSON to verify it's valid
        const parsed = JSON.parse(call[0]);
        return Array.isArray(parsed);
      } catch {
        return false;
      }
    })?.[0];

    expect(output).toBeTruthy();

    const tasks = JSON.parse(output);
    expect(Array.isArray(tasks)).toBe(true);
    expect(tasks.length).toBe(2); // Active and todo tasks
    expect(tasks.find(t => t.id === 'TASK-100')).toBeTruthy();
    expect(tasks.find(t => t.id === 'TASK-101')).toBeTruthy();
  });

  it('should output CSV to stdout with --stdout flag', async () => {
    const command = exportCommand();
    await command.parseAsync(['--format', 'csv', '--stdout'], { from: 'user' });

    // Find the CSV output in the console log calls
    const output = testSetup.consoleLogSpy.mock.calls.find(call =>
      call[0].includes('ID,Name,Description')
    )?.[0];

    expect(output).toBeTruthy();
    const lines = output.split('\n');
    expect(lines[0]).toContain('ID,Name,Description,Status,Priority');
    expect(output).toContain('TASK-100,Active task');
    expect(output).toContain('TASK-101,Todo task');
  });

  it('should escape CSV values properly', async () => {
    // Create task with special CSV characters
    const { TaskwerkAPI } = await import('../../src/api/taskwerk-api.js');
    const api = new TaskwerkAPI();

    await api.createTask({
      id: 'TASK-103',
      name: 'Task with, comma',
      description: 'Task with "quotes" and\nnewline',
      status: 'todo',
      created_by: 'user',
    });

    const command = exportCommand();
    await command.parseAsync(['--format', 'csv'], { from: 'user' });

    // Check for export success message and get filename
    const successMessage = testSetup.consoleLogSpy.mock.calls.find(call =>
      call[0].includes('✅ Exported')
    )?.[0];

    const filename = successMessage.match(/tasks-export-\d{4}-\d{2}-\d{2}\.csv/)?.[0];
    const content = await fs.readFile(filename, 'utf8');

    expect(content).toContain('"Task with, comma"');
    expect(content).toContain('"Task with ""quotes"" and\nnewline"');

    // Clean up
    await fs.unlink(filename);
  });
});
