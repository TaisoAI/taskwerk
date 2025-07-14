import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { aiconfigCommand } from '../../src/commands/aiconfig.js';
import { setupCommandTest } from '../helpers/command-test-helper.js';

describe('aiconfig command', () => {
  let testSetup;

  beforeEach(() => {
    testSetup = setupCommandTest();
  });

  afterEach(() => {
    testSetup.cleanup();
  });

  it('should create command with correct name and description', () => {
    const command = aiconfigCommand();
    expect(command.name()).toBe('aiconfig');
    expect(command.description()).toBe('Configure AI/LLM settings');
  });

  it('should have all expected options', () => {
    const command = aiconfigCommand();
    const optionNames = command.options.map(opt => opt.long);

    expect(optionNames).toContain('--set');
    expect(optionNames).toContain('--list-providers');
    expect(optionNames).toContain('--choose');
    expect(optionNames).toContain('--test');
    expect(optionNames).toContain('--show');
  });

  it('should show configuration by default', async () => {
    const command = aiconfigCommand();
    await command.parseAsync([], { from: 'user' });

    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith('🤖 AI Configuration');
    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Current Provider:'));
  });

  it('should list providers', async () => {
    const command = aiconfigCommand();
    await command.parseAsync(['--list-providers'], { from: 'user' });

    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith('📋 Available AI Providers:');
    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('anthropic:'));
    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('openai:'));
    expect(testSetup.consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('ollama:'));
  });

  it('should handle invalid set format', async () => {
    const command = aiconfigCommand();
    
    // Mock process.exit
    const originalExit = process.exit;
    process.exit = () => { throw new Error('Process exit called'); };
    
    try {
      await command.parseAsync(['--set', 'invalid-format'], { from: 'user' });
    } catch (error) {
      expect(error.message).toBe('Process exit called');
    }
    
    process.exit = originalExit;
    
    expect(testSetup.consoleErrorSpy).toHaveBeenCalledWith(
      '❌ Configuration failed:',
      expect.stringContaining('Invalid configuration format')
    );
  });

  it('should show help for configuration', async () => {
    const command = aiconfigCommand();
    await command.parseAsync(['--list-providers'], { from: 'user' });

    const output = testSetup.consoleLogSpy.mock.calls
      .map(call => call.join(' '))
      .join('\n');
    
    expect(output).toContain('To configure a provider');
    expect(output).toContain('taskwerk aiconfig --set');
  });
});