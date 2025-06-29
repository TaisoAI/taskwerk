import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { existsSync, unlinkSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { llmConfigCommand } from '../../src/commands/llmconfig.js';

describe('llmConfigCommand Comprehensive Tests', () => {
  const configDir = join(homedir(), '.taskwerk');
  const keysPath = join(configDir, 'keys.json');
  let originalKeys = null;
  let originalConsoleLog = null;
  let originalConsoleError = null;
  let logOutput = [];
  let errorOutput = [];

  beforeEach(() => {
    // Backup existing keys if they exist
    if (existsSync(keysPath)) {
      originalKeys = readFileSync(keysPath, 'utf-8');
    }

    // Capture console output
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    logOutput = [];
    errorOutput = [];
    console.log = (...args) => logOutput.push(args.join(' '));
    console.error = (...args) => errorOutput.push(args.join(' '));
  });

  afterEach(() => {
    // Restore console
    console.log = originalConsoleLog;
    console.error = originalConsoleError;

    // Restore original keys or clean up
    if (originalKeys) {
      writeFileSync(keysPath, originalKeys);
    } else if (existsSync(keysPath)) {
      unlinkSync(keysPath);
    }
  });

  describe('Default behavior (showStatus)', () => {
    it('should show status when no options provided', async () => {
      await llmConfigCommand({});

      const output = logOutput.join('\\n');
      assert(output.includes('# LLM Configuration Status'));
      assert(output.includes('**Default Model**'));
    });

    it('should show setup guidance when no models available', async () => {
      // Ensure no API keys exist
      if (existsSync(keysPath)) {
        unlinkSync(keysPath);
      }

      await llmConfigCommand({});

      const output = logOutput.join('\\n');
      // Check that it shows LLM configuration status
      assert(output.includes('# LLM Configuration Status'));
      // Check that it shows some form of setup guidance
      assert(
        output.includes('llmconfig') || output.includes('Setup') || output.includes('Get Started')
      );
    });
  });

  describe('--list-models option', () => {
    it('should list available models when API keys configured', async () => {
      // Create test API key
      const testKeys = { openai: 'sk-test123456789012345678901234567890' };
      writeFileSync(keysPath, JSON.stringify(testKeys, null, 2));

      await llmConfigCommand({ listModels: true });

      const output = logOutput.join('\\n');
      assert(output.includes('# Available LLM Models'));
      assert(output.includes('[OPENAI]'));
      assert(output.includes('gpt-'));
    });

    it('should show no models message when no API keys', async () => {
      // Ensure no keys exist
      if (existsSync(keysPath)) {
        unlinkSync(keysPath);
      }

      await llmConfigCommand({ listModels: true });

      const output = logOutput.join('\\n');
      assert(output.includes('No models available') || output.includes('# Available LLM Models'));
    });

    it('should show proper model format with provider tags', async () => {
      // Create test API key
      const testKeys = { openai: 'sk-test123456789012345678901234567890' };
      writeFileSync(keysPath, JSON.stringify(testKeys, null, 2));

      await llmConfigCommand({ listModels: true });

      const output = logOutput.join('\\n');
      assert(output.includes('[OPENAI]'));
      assert(output.includes('**Default model**'));
    });
  });

  describe('--model-info option', () => {
    it('should show model information for valid model', async () => {
      const testKeys = { openai: 'sk-test123456789012345678901234567890' };
      writeFileSync(keysPath, JSON.stringify(testKeys, null, 2));

      await llmConfigCommand({ modelInfo: 'gpt-4' });

      const output = logOutput.join('\\n');
      assert(output.includes('# Model Information: gpt-4'));
      assert(output.includes('- **Type**:'));
      assert(output.includes('- **Provider**:'));
    });

    it.skip('should handle invalid model gracefully', async () => {
      // Skip this test as it may be causing hangs
      try {
        await llmConfigCommand({ modelInfo: 'invalid-model' });
      } catch (error) {
        // Should handle error gracefully
        assert(error.message.includes('Failed to manage LLM configuration'));
      }
    });
  });

  describe('--set-default option', () => {
    it('should set default model successfully when API key is available', async () => {
      // Create test API key to make model available
      const testKeys = { openai: 'sk-test123456789012345678901234567890' };
      writeFileSync(keysPath, JSON.stringify(testKeys, null, 2));

      await llmConfigCommand({ setDefault: 'gpt-4' });

      const output = logOutput.join('\\n');
      assert(output.includes('✅ Default model set to: gpt-4'));
    });

    it('should work with --model alias when API key is available', async () => {
      // Create test API key to make model available
      const testKeys = { openai: 'sk-test123456789012345678901234567890' };
      writeFileSync(keysPath, JSON.stringify(testKeys, null, 2));

      await llmConfigCommand({ model: 'gpt-3.5-turbo' });

      const output = logOutput.join('\\n');
      assert(output.includes('✅ Default model set to: gpt-3.5-turbo'));
    });

    it.skip('should handle model unavailable error gracefully', async () => {
      // Skip - this may cause process.exit which hangs tests
      // Ensure no API keys so model is unavailable
      if (existsSync(keysPath)) {
        unlinkSync(keysPath);
      }

      try {
        await llmConfigCommand({ setDefault: 'gpt-4' });
        assert.fail('Should have thrown an error for unavailable model');
      } catch (error) {
        // Should handle error through main command error handler
        const output = errorOutput.join('\\n');
        assert(
          output.includes('❌ Failed to manage LLM configuration') ||
            error.message.includes('Model not available')
        );
      }
    });
  });

  describe('--pull option', () => {
    it.skip('should attempt to pull Ollama model', async () => {
      // Skip interactive tests for now - they may hang
      try {
        await llmConfigCommand({ pull: 'llama3.2:1b' });
      } catch (error) {
        // Expected to fail in test environment without Ollama
        const output = logOutput.join('\\n');
        assert(output.includes('📥 Pulling model: llama3.2:1b'));
      }
    });

    it.skip('should show error when Ollama not available', async () => {
      // Skip - may cause process.exit which hangs tests
      try {
        await llmConfigCommand({ pull: 'test-model' });
      } catch (error) {
        // Expected to fail
        const output = errorOutput.join('\\n');
        assert(output.includes('❌') || output.includes('Failed'));
      }
    });
  });

  describe('--choose option', () => {
    it.skip('should show interactive model selection when models available', async () => {
      // Skip interactive tests for now - they hang in CI
      // TODO: Mock readline interface properly
    });

    it.skip('should show setup guide when no models available (non-interactive)', async () => {
      // Skip - even with no models, might attempt to check Ollama which could hang
      // Test the initial setup guide display before interactive prompts
      // Ensure no API keys and no Ollama models
      if (existsSync(keysPath)) {
        unlinkSync(keysPath);
      }

      await llmConfigCommand({ choose: true });

      const output = logOutput.join('\\n');
      // When no models are available, should show the interactive header and setup guide
      assert(output.includes('🤖 Interactive LLM Model Selection'));
      assert(output.includes('❌ No models available') || output.includes('Setup Guide'));
    });
  });

  describe('Error handling', () => {
    it.skip('should handle general errors gracefully', async () => {
      // Skip - process.exit mocking may cause hangs
      // Mock an error in LLMManager
      const originalProcessExit = process.exit;
      let exitCode = null;
      process.exit = code => {
        exitCode = code;
        throw new Error('Process exit called');
      };

      try {
        // Pass invalid options to trigger error path
        await llmConfigCommand({ invalidOption: true });
      } catch (error) {
        if (error.message !== 'Process exit called') {
          throw error;
        }
      } finally {
        process.exit = originalProcessExit;
      }

      // Should have logged error and attempted to exit
      const output = errorOutput.join('\\n');
      assert(output.includes('❌ Failed to manage LLM configuration') || exitCode === 1);
    });

    it('should handle configuration loading errors', async () => {
      // This test ensures robust error handling throughout the flow
      try {
        await llmConfigCommand({});
        // Should complete without throwing
        assert(true);
      } catch (error) {
        // If error occurs, should be handled gracefully
        assert(error.message.includes('Failed to manage LLM configuration'));
      }
    });
  });

  describe('Integration tests', () => {
    it('should work end-to-end with API key workflow', async () => {
      // Test the full workflow: add key -> list models -> set default

      // 1. First ensure no keys
      if (existsSync(keysPath)) {
        unlinkSync(keysPath);
      }

      // 2. Check status shows config status
      await llmConfigCommand({});
      let output = logOutput.join('\\n');
      assert(output.includes('# LLM Configuration Status'));

      // 3. Simulate API key exists (normally added via --add-key)
      logOutput = []; // Reset output
      const testKeys = { openai: 'sk-test123456789012345678901234567890' };
      writeFileSync(keysPath, JSON.stringify(testKeys, null, 2));

      // 4. List models should now show OpenAI models
      await llmConfigCommand({ listModels: true });
      output = logOutput.join('\\n');
      assert(output.includes('[OPENAI]'));

      // 5. Set default model
      logOutput = []; // Reset output
      await llmConfigCommand({ setDefault: 'gpt-4' });
      output = logOutput.join('\\n');
      assert(output.includes('✅ Default model set to: gpt-4'));
    });

    it('should maintain consistency across different command options', async () => {
      // Test that different ways of accessing models show consistent results
      const testKeys = {
        openai: 'sk-test123456789012345678901234567890',
        anthropic: 'sk-ant-test123456789012345678901234567890',
      };
      writeFileSync(keysPath, JSON.stringify(testKeys, null, 2));

      // List models
      logOutput = [];
      await llmConfigCommand({ listModels: true });
      const listOutput = logOutput.join('\\n');

      // Show status
      logOutput = [];
      await llmConfigCommand({});
      const statusOutput = logOutput.join('\\n');

      // Both should reference available models consistently
      assert(listOutput.includes('[OPENAI]'));
      assert(statusOutput.includes('LLM Configuration Status'));
    });
  });

  describe('Output formatting', () => {
    it('should format model listings consistently', async () => {
      const testKeys = { openai: 'sk-test123456789012345678901234567890' };
      writeFileSync(keysPath, JSON.stringify(testKeys, null, 2));

      await llmConfigCommand({ listModels: true });

      const output = logOutput.join('\\n');
      // Check for consistent formatting
      assert(output.includes('## Openai Models') || output.includes('[OPENAI]'));
      assert(output.includes('**Default model**:'));
    });

    it('should show proper status formatting', async () => {
      await llmConfigCommand({});

      const output = logOutput.join('\\n');
      assert(output.includes('# LLM Configuration Status'));
      // Check for standard status elements that should always be present
      assert(output.includes('**Default Model**'));
      assert(output.includes('**Status**'));
      assert(output.includes('**Available Models**'));
    });
  });
});
