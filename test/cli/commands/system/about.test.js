import { describe, it, expect, vi } from 'vitest';
import { makeAboutCommand } from '../../../../src/cli/commands/system/about.js';

describe('system about command', () => {
  it('should display about information', async () => {
    const command = makeAboutCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test']);
    
    // Check key information is displayed
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Taskwerk'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('git-aware task management'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Version'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Author'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('License'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Repository'));
    
    // Check features list
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Features'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Git integration'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('CLI and AI'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('SQLite'));
    
    // Check commands section
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Commands'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('task add'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('task list'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('git branch'));
    
    consoleLog.mockRestore();
  });
  
  it('should display JSON output', async () => {
    const command = makeAboutCommand();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    await command.parseAsync(['node', 'test', '--json']);
    
    const jsonOutput = consoleLog.mock.calls[0][0];
    const info = JSON.parse(jsonOutput);
    
    expect(info.name).toBe('taskwerk');
    expect(info.description).toContain('git-aware task management');
    expect(info.version).toBeDefined();
    expect(info.author).toBeDefined();
    expect(info.license).toBe('MIT');
    expect(info.repository).toBeDefined();
    expect(Array.isArray(info.features)).toBe(true);
    expect(info.features.length).toBeGreaterThan(0);
    
    consoleLog.mockRestore();
  });
});