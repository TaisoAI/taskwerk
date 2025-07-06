import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeImportCommand } from '../../../src/cli/commands/import.js';
import { initializeStorage } from '../../../src/storage/index.js';
import { TaskwerkAPI } from '../../../src/core/api.js';
import { writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('import command', () => {
  let testDir;
  let storage;
  let api;
  
  beforeEach(async () => {
    testDir = join(tmpdir(), `taskwerk-test-${Date.now()}`);
    process.chdir(testDir);
    storage = await initializeStorage(testDir);
    api = new TaskwerkAPI({ database: storage.db });
  });
  
  afterEach(() => {
    if (storage?.db) {
      storage.close();
    }
    rmSync(testDir, { recursive: true, force: true });
  });
  
  it('should import from JSON file', async () => {
    const importData = [
      {
        string_id: 'TASK-101',
        name: 'Imported task 1',
        status: 'todo',
        priority: 'high',
        tags: ['import', 'test']
      },
      {
        string_id: 'TASK-102',
        name: 'Imported task 2',
        status: 'active',
        priority: 'medium'
      }
    ];
    
    const importFile = join(testDir, 'import.json');
    writeFileSync(importFile, JSON.stringify(importData));
    
    const command = makeImportCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', importFile]);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('✓'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Imported 2 tasks'));
    
    // Verify tasks were imported
    const tasks = await api.listTasks({});
    expect(tasks).toHaveLength(2);
    expect(tasks[0].name).toBe('Imported task 1');
    expect(tasks[0].tags).toEqual(['import', 'test']);
    
    consoleLog.mockRestore();
  });
  
  it('should import from Markdown file', async () => {
    const markdown = `# Taskwerk Export

## TASK-201: Markdown task 1

- **Status:** todo
- **Priority:** high
- **Tags:** markdown, import

Description from markdown

---

## TASK-202: Markdown task 2

- **Status:** active
- **Priority:** low

Another task
`;
    
    const importFile = join(testDir, 'import.md');
    writeFileSync(importFile, markdown);
    
    const command = makeImportCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', importFile]);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Imported 2 tasks'));
    
    const tasks = await api.listTasks({});
    expect(tasks).toHaveLength(2);
    expect(tasks[0].name).toBe('Markdown task 1');
    expect(tasks[0].description).toBe('Description from markdown');
    
    consoleLog.mockRestore();
  });
  
  it('should import from YAML file', async () => {
    const yaml = `- string_id: TASK-301
  name: YAML task 1
  status: todo
  priority: high
  tags:
    - yaml
    - import
- string_id: TASK-302
  name: YAML task 2
  status: completed
  priority: medium`;
    
    const importFile = join(testDir, 'import.yaml');
    writeFileSync(importFile, yaml);
    
    const command = makeImportCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', importFile]);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Imported 2 tasks'));
    
    const tasks = await api.listTasks({ includeArchived: true });
    expect(tasks).toHaveLength(2);
    expect(tasks.find(t => t.name === 'YAML task 1').tags).toEqual(['yaml', 'import']);
    
    consoleLog.mockRestore();
  });
  
  it('should handle merge mode', async () => {
    // Create existing task
    await api.createTask({ name: 'Existing task', status: 'active' });
    
    const importData = [
      {
        string_id: 'TASK-001', // Same ID as existing
        name: 'Updated task',
        status: 'completed',
        priority: 'high'
      }
    ];
    
    const importFile = join(testDir, 'merge.json');
    writeFileSync(importFile, JSON.stringify(importData));
    
    const command = makeImportCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', importFile, '--mode', 'merge']);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('merged: 1'));
    
    const task = await api.getTask('TASK-001');
    expect(task.name).toBe('Updated task');
    expect(task.status).toBe('completed');
    
    consoleLog.mockRestore();
  });
  
  it('should handle skip mode', async () => {
    // Create existing task
    await api.createTask({ name: 'Existing task', status: 'active' });
    
    const importData = [
      {
        string_id: 'TASK-001', // Same ID as existing
        name: 'Should be skipped',
        status: 'completed'
      },
      {
        string_id: 'TASK-002',
        name: 'New task',
        status: 'todo'
      }
    ];
    
    const importFile = join(testDir, 'skip.json');
    writeFileSync(importFile, JSON.stringify(importData));
    
    const command = makeImportCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', importFile, '--mode', 'skip']);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('created: 1'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('skipped: 1'));
    
    const task = await api.getTask('TASK-001');
    expect(task.name).toBe('Existing task'); // Not updated
    
    consoleLog.mockRestore();
  });
  
  it('should handle replace mode', async () => {
    // Create existing tasks
    await api.createTask({ name: 'Task 1', status: 'active' });
    await api.createTask({ name: 'Task 2', status: 'todo' });
    
    const importData = [
      {
        string_id: 'TASK-NEW',
        name: 'Replacement task',
        status: 'active'
      }
    ];
    
    const importFile = join(testDir, 'replace.json');
    writeFileSync(importFile, JSON.stringify(importData));
    
    const command = makeImportCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', importFile, '--mode', 'replace']);
    
    const tasks = await api.listTasks({});
    expect(tasks).toHaveLength(1);
    expect(tasks[0].name).toBe('Replacement task');
    
    consoleLog.mockRestore();
  });
  
  it('should run dry-run without making changes', async () => {
    const importData = [
      {
        string_id: 'TASK-DRY',
        name: 'Dry run task',
        status: 'todo'
      }
    ];
    
    const importFile = join(testDir, 'dryrun.json');
    writeFileSync(importFile, JSON.stringify(importData));
    
    const command = makeImportCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', importFile, '--dry-run']);
    
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('DRY RUN'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Would import 1 task'));
    
    // Verify no tasks were actually created
    const tasks = await api.listTasks({});
    expect(tasks).toHaveLength(0);
    
    consoleLog.mockRestore();
  });
  
  it('should handle parent-child relationships', async () => {
    const importData = [
      {
        string_id: 'TASK-P1',
        name: 'Parent task',
        status: 'active'
      },
      {
        string_id: 'TASK-C1',
        name: 'Child task',
        status: 'todo',
        parent_id: 'TASK-P1'
      }
    ];
    
    const importFile = join(testDir, 'hierarchy.json');
    writeFileSync(importFile, JSON.stringify(importData));
    
    const command = makeImportCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', importFile]);
    
    const child = await api.getTask('TASK-C1');
    const parent = await api.getTask('TASK-P1');
    
    expect(child.parent_id).toBe(parent.id);
    
    consoleLog.mockRestore();
  });
  
  it('should handle import errors gracefully', async () => {
    const importFile = join(testDir, 'invalid.json');
    writeFileSync(importFile, '{ invalid json }');
    
    const command = makeImportCommand();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', importFile]);
    
    expect(consoleError).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Failed to parse')
    );
    
    consoleError.mockRestore();
  });
});