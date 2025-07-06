import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeExportCommand } from '../../../src/cli/commands/export.js';
import { initializeStorage } from '../../../src/storage/index.js';
import { TaskwerkAPI } from '../../../src/core/api.js';
import { readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('export command', () => {
  let testDir;
  let storage;
  let api;
  
  beforeEach(async () => {
    testDir = join(tmpdir(), `taskwerk-test-${Date.now()}`);
    
    // Create directory first
    const { mkdirSync } = await import('fs');
    mkdirSync(testDir, { recursive: true });
    
    process.chdir(testDir);
    storage = await initializeStorage(testDir);
    api = new TaskwerkAPI({ database: storage.db });
    
    // Create test data
    await api.createTask({
      name: 'Export test 1',
      description: 'Test task for export',
      status: 'active',
      priority: 'high',
      tags: ['test', 'export']
    });
    
    await api.createTask({
      name: 'Export test 2',
      status: 'completed',
      priority: 'medium'
    });
    
    // Add notes
    await api.addNote('TASK-001', 'Test note 1');
    await api.addNote('TASK-001', { content: 'Test note 2', metadata: { type: 'update' } });
  });
  
  afterEach(() => {
    if (storage?.db) {
      storage.close();
    }
    rmSync(testDir, { recursive: true, force: true });
  });
  
  it('should export to JSON format', async () => {
    const command = makeExportCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    const outputFile = join(testDir, 'export.json');
    await command.parseAsync(['node', 'test', outputFile]);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('✓'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Exported 2 tasks'));
    
    // Verify file contents
    const content = readFileSync(outputFile, 'utf8');
    const data = JSON.parse(content);
    
    expect(data).toHaveLength(2);
    expect(data[0].name).toBe('Export test 1');
    expect(data[0].notes).toHaveLength(2);
    expect(data[1].name).toBe('Export test 2');
    
    consoleLog.mockRestore();
  });
  
  it('should export to Markdown format', async () => {
    const command = makeExportCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    const outputFile = join(testDir, 'export.md');
    await command.parseAsync(['node', 'test', outputFile, '--format', 'markdown']);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Exported 2 tasks'));
    
    // Verify file contents
    const content = readFileSync(outputFile, 'utf8');
    
    expect(content).toContain('# Taskwerk Export');
    expect(content).toContain('## TASK-001: Export test 1');
    expect(content).toContain('- **Status:** active');
    expect(content).toContain('- **Priority:** high');
    expect(content).toContain('- **Tags:** test, export');
    expect(content).toContain('## TASK-002: Export test 2');
    
    consoleLog.mockRestore();
  });
  
  it('should export to YAML format', async () => {
    const command = makeExportCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    const outputFile = join(testDir, 'export.yaml');
    await command.parseAsync(['node', 'test', outputFile, '--format', 'yaml']);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Exported 2 tasks'));
    
    // Verify file contents
    const content = readFileSync(outputFile, 'utf8');
    
    expect(content).toContain('string_id: TASK-001');
    expect(content).toContain('name: Export test 1');
    expect(content).toContain('tags:');
    expect(content).toContain('  - test');
    expect(content).toContain('  - export');
    
    consoleLog.mockRestore();
  });
  
  it('should export to CSV format', async () => {
    const command = makeExportCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    const outputFile = join(testDir, 'export.csv');
    await command.parseAsync(['node', 'test', outputFile, '--format', 'csv']);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Exported 2 tasks'));
    
    // Verify file contents
    const content = readFileSync(outputFile, 'utf8');
    const lines = content.split('\n');
    
    expect(lines[0]).toContain('string_id');
    expect(lines[0]).toContain('name');
    expect(lines[0]).toContain('status');
    expect(lines[1]).toContain('TASK-001');
    expect(lines[1]).toContain('Export test 1');
    expect(lines[2]).toContain('TASK-002');
    expect(lines[2]).toContain('Export test 2');
    
    consoleLog.mockRestore();
  });
  
  it('should filter by status', async () => {
    const command = makeExportCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    const outputFile = join(testDir, 'active.json');
    await command.parseAsync(['node', 'test', outputFile, '--status', 'active']);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Exported 1 task'));
    
    const content = readFileSync(outputFile, 'utf8');
    const data = JSON.parse(content);
    
    expect(data).toHaveLength(1);
    expect(data[0].status).toBe('active');
    
    consoleLog.mockRestore();
  });
  
  it('should include notes and history', async () => {
    // Update task to create history
    await api.updateTask('TASK-001', { priority: 'medium' });
    
    const command = makeExportCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    const outputFile = join(testDir, 'full.json');
    await command.parseAsync([
      'node', 'test', outputFile,
      '--include-notes',
      '--include-history'
    ]);
    
    const content = readFileSync(outputFile, 'utf8');
    const data = JSON.parse(content);
    
    expect(data[0].notes).toHaveLength(2);
    expect(data[0].notes[0].content).toBe('Test note 1');
    expect(data[0].history).toBeDefined();
    expect(data[0].history.length).toBeGreaterThan(0);
    
    consoleLog.mockRestore();
  });
  
  it('should export to stdout when no file specified', async () => {
    const command = makeExportCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test']);
    
    // Should output JSON to console
    const jsonOutput = consoleLog.mock.calls.find(call => 
      call[0].startsWith('[') && call[0].includes('TASK-001')
    );
    expect(jsonOutput).toBeDefined();
    
    consoleLog.mockRestore();
  });
  
  it('should handle pretty print option', async () => {
    const command = makeExportCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    const outputFile = join(testDir, 'pretty.json');
    await command.parseAsync(['node', 'test', outputFile, '--pretty']);
    
    const content = readFileSync(outputFile, 'utf8');
    
    // Pretty printed JSON should have newlines and indentation
    expect(content.split('\n').length).toBeGreaterThan(10);
    expect(content).toContain('  '); // Indentation
    
    consoleLog.mockRestore();
  });
});