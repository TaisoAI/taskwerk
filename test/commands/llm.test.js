import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { llmCommand } from '../../src/commands/llm.js';
import { setupCommandTest } from '../helpers/command-test-helper.js';

describe('llm command', () => {
  let testSetup;

  beforeEach(() => {
    testSetup = setupCommandTest();
  });

  afterEach(() => {
    testSetup.cleanup();
  });

  it('should create command with correct name and description', () => {
    const command = llmCommand();
    expect(command.name()).toBe('llm');
    expect(command.description()).toBe('Send a prompt directly to the configured LLM');
  });

  it('should have all expected options', () => {
    const command = llmCommand();
    const optionNames = command.options.map(opt => opt.long);

    expect(optionNames).toContain('--file');
    expect(optionNames).toContain('--params');
    expect(optionNames).toContain('--provider');
    expect(optionNames).toContain('--model');
    expect(optionNames).toContain('--system');
    expect(optionNames).toContain('--temperature');
    expect(optionNames).toContain('--max-tokens');
    expect(optionNames).toContain('--context-tasks');
    expect(optionNames).toContain('--no-stream');
    expect(optionNames).toContain('--verbose');
  });

  it('should handle missing prompt', async () => {
    const command = llmCommand();

    // Mock stdin to not be piped
    const originalIsTTY = process.stdin.isTTY;
    process.stdin.isTTY = true;

    // Mock process.exit
    const originalExit = process.exit;
    process.exit = () => {
      throw new Error('Process exit called');
    };

    try {
      await command.parseAsync([], { from: 'user' });
    } catch (error) {
      expect(error.message).toBe('Process exit called');
    }

    process.exit = originalExit;
    process.stdin.isTTY = originalIsTTY;

    expect(testSetup.consoleErrorSpy).toHaveBeenCalledWith(
      '❌ No prompt provided. Use arguments, --file, or pipe input.'
    );
  });

  it('should accept prompt as arguments', async () => {
    const command = llmCommand();

    // Mock LLMManager
    vi.fn().mockResolvedValue({
      content: 'Test response',
      usage: { prompt_tokens: 10, completion_tokens: 20 },
    });

    // This test would need more sophisticated mocking of LLMManager
    // For now, we're just testing the command structure
    expect(command._args[0].name()).toBe('prompt');
    expect(command._args[0].variadic).toBe(true);
  });

  it('should support parameter substitution', () => {
    const command = llmCommand();
    const paramsOption = command.options.find(opt => opt.long === '--params');

    expect(paramsOption).toBeDefined();
    expect(paramsOption.parseArg).toBeDefined();

    // Test the param parser
    const params = {};
    const result1 = paramsOption.parseArg('key=value', params);
    expect(result1).toEqual({ key: 'value' });

    const result2 = paramsOption.parseArg('key2=value with=equals', result1);
    expect(result2).toEqual({ key: 'value', key2: 'value with=equals' });
  });

  it('should parse temperature as float', () => {
    const command = llmCommand();
    const tempOption = command.options.find(opt => opt.long === '--temperature');

    expect(tempOption).toBeDefined();
    expect(tempOption.parseArg).toBeDefined();
    // Test that it parses correctly
    expect(tempOption.parseArg('0.7')).toBe(0.7);
    expect(tempOption.parseArg('1.5')).toBe(1.5);
  });

  it('should parse max-tokens as integer', () => {
    const command = llmCommand();
    const tokensOption = command.options.find(opt => opt.long === '--max-tokens');

    expect(tokensOption).toBeDefined();
    expect(tokensOption.parseArg).toBeDefined();
    // Test that it parses correctly
    expect(tokensOption.parseArg('100')).toBe(100);
    expect(tokensOption.parseArg('2000')).toBe(2000);
  });
});
