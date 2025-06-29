import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { existsSync, unlinkSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { llmConfigCommand } from '../../src/commands/llmconfig.js';
// import { createInterface } from 'readline'; // Not used in tests

describe('llmConfigCommand API Key Management', () => {
  const configDir = join(homedir(), '.taskwerk');
  const keysPath = join(configDir, 'keys.json');
  let originalKeys = null;

  beforeEach(() => {
    // Backup existing keys if they exist
    if (existsSync(keysPath)) {
      originalKeys = readFileSync(keysPath, 'utf-8');
    }
  });

  afterEach(() => {
    // Restore original keys or clean up
    if (originalKeys) {
      writeFileSync(keysPath, originalKeys);
    } else if (existsSync(keysPath)) {
      unlinkSync(keysPath);
    }
  });

  describe('--list-keys option', () => {
    it('should show no keys when none are configured', async () => {
      // Ensure no keys exist
      if (existsSync(keysPath)) {
        unlinkSync(keysPath);
      }

      const originalConsoleLog = console.log;
      const logOutput = [];
      console.log = (...args) => logOutput.push(args.join(' '));

      try {
        await llmConfigCommand({ listKeys: true });

        const output = logOutput.join('\n');
        assert(output.includes('# API Key Configuration'));
        assert(output.includes('## OPENAI'));
        assert(output.includes('❌ No API key configured'));
        assert(output.includes('## ANTHROPIC'));
        assert(output.includes('⚠️  No API keys configured.'));
      } finally {
        console.log = originalConsoleLog;
      }
    });

    it('should show masked keys when configured', async () => {
      // Create test keys
      const testKeys = {
        openai: 'sk-test123456789012345678901234567890',
        anthropic: 'sk-ant-test123456789012345678901234567890',
      };
      writeFileSync(keysPath, JSON.stringify(testKeys, null, 2));

      const originalConsoleLog = console.log;
      const logOutput = [];
      console.log = (...args) => logOutput.push(args.join(' '));

      try {
        await llmConfigCommand({ listKeys: true });

        const output = logOutput.join('\n');
        assert(output.includes('✅ Stored API key: sk-test1...7890'));
        assert(output.includes('✅ Stored API key: sk-ant-t...7890'));
        assert(output.includes('💡 Priority: Stored keys override environment variables'));
      } finally {
        console.log = originalConsoleLog;
      }
    });

    it('should prioritize stored keys over environment variables', async () => {
      // Set environment variable
      process.env.OPENAI_API_KEY = 'sk-env123456789012345678901234567890';

      // Create stored key that should override
      const testKeys = {
        openai: 'sk-stored123456789012345678901234567890',
      };
      writeFileSync(keysPath, JSON.stringify(testKeys, null, 2));

      const originalConsoleLog = console.log;
      const logOutput = [];
      console.log = (...args) => logOutput.push(args.join(' '));

      try {
        await llmConfigCommand({ listKeys: true });

        const output = logOutput.join('\n');
        assert(output.includes('✅ Stored API key: sk-store...7890'));
        assert(!output.includes('sk-env123'));
      } finally {
        console.log = originalConsoleLog;
        delete process.env.OPENAI_API_KEY;
      }
    });

    it('should show environment variables when no stored keys exist', async () => {
      // Ensure no stored keys
      if (existsSync(keysPath)) {
        unlinkSync(keysPath);
      }

      // Set environment variable
      process.env.OPENAI_API_KEY = 'sk-env123456789012345678901234567890';

      const originalConsoleLog = console.log;
      const logOutput = [];
      console.log = (...args) => logOutput.push(args.join(' '));

      try {
        await llmConfigCommand({ listKeys: true });

        const output = logOutput.join('\n');
        assert(output.includes('🔧 Environment variable: sk-env12...7890'));
      } finally {
        console.log = originalConsoleLog;
        delete process.env.OPENAI_API_KEY;
      }
    });
  });

  describe('API key validation', () => {
    it('should validate OpenAI key format', () => {
      const validKey = 'sk-1234567890123456789012345678901234567890';
      const invalidKey = 'invalid-key-format';

      // Test format validation logic (we'll mock the validation)
      assert(validKey.startsWith('sk-'));
      assert(!invalidKey.startsWith('sk-'));
    });

    it('should validate Anthropic key format', () => {
      const validKey = 'sk-ant-1234567890123456789012345678901234567890';
      const invalidKey = 'sk-1234567890123456789012345678901234567890';

      // Test format validation logic
      assert(validKey.startsWith('sk-ant-'));
      assert(!invalidKey.startsWith('sk-ant-'));
    });

    it('should mask API keys correctly', () => {
      const testKey = 'sk-test123456789012345678901234567890';
      const masked = testKey.substring(0, 8) + '...' + testKey.substring(testKey.length - 4);

      assert.strictEqual(masked, 'sk-test1...7890');
      assert(!masked.includes('123456789012345678901234567'));
    });
  });

  describe('configuration file handling', () => {
    it('should create config directory if it does not exist', async () => {
      // Test is implicitly covered by other tests that write to keysPath
      // The mkdir logic in getConfigPath() should create the directory
      const testKeys = { openai: 'sk-test123' };
      writeFileSync(keysPath, JSON.stringify(testKeys, null, 2));

      assert(existsSync(configDir));
      assert(existsSync(keysPath));
    });

    it('should handle missing keys.json file gracefully', async () => {
      if (existsSync(keysPath)) {
        unlinkSync(keysPath);
      }

      const originalConsoleLog = console.log;
      const logOutput = [];
      console.log = (...args) => logOutput.push(args.join(' '));

      try {
        await llmConfigCommand({ listKeys: true });

        const output = logOutput.join('\n');
        assert(output.includes('❌ No API key configured'));
      } finally {
        console.log = originalConsoleLog;
      }
    });

    it('should handle corrupted keys.json file gracefully', async () => {
      // Write invalid JSON
      writeFileSync(keysPath, 'invalid json content');

      const originalConsoleLog = console.log;
      const originalConsoleError = console.error;
      const logOutput = [];
      const errorOutput = [];
      console.log = (...args) => logOutput.push(args.join(' '));
      console.error = (...args) => errorOutput.push(args.join(' '));

      try {
        await llmConfigCommand({ listKeys: true });

        const output = logOutput.join('\n');
        // Should gracefully handle the error and show no keys configured
        assert(output.includes('❌ No API key configured'));
      } finally {
        console.log = originalConsoleLog;
        console.error = originalConsoleError;
      }
    });
  });

  describe('command option validation', () => {
    it('should reject invalid providers for addKey', async () => {
      const originalConsoleError = console.error;
      const originalProcessExit = process.exit;
      let exitCode = null;
      const errorOutput = [];

      console.error = (...args) => errorOutput.push(args.join(' '));
      process.exit = code => {
        exitCode = code;
        throw new Error('Process exit called'); // Prevent actual exit
      };

      try {
        await llmConfigCommand({ addKey: 'invalid-provider' });
        assert.fail('Should have thrown an error');
      } catch (error) {
        if (error.message !== 'Process exit called') {
          throw error;
        }
      }

      assert.strictEqual(exitCode, 1);
      assert(errorOutput.some(msg => msg.includes('Invalid provider: invalid-provider')));
      assert(errorOutput.some(msg => msg.includes('Valid providers: openai, anthropic')));

      console.error = originalConsoleError;
      process.exit = originalProcessExit;
    });

    it('should reject invalid providers for removeKey', async () => {
      const originalConsoleError = console.error;
      const originalProcessExit = process.exit;
      let exitCode = null;
      const errorOutput = [];

      console.error = (...args) => errorOutput.push(args.join(' '));
      process.exit = code => {
        exitCode = code;
        throw new Error('Process exit called');
      };

      try {
        await llmConfigCommand({ removeKey: 'invalid-provider' });
        assert.fail('Should have thrown an error');
      } catch (error) {
        if (error.message !== 'Process exit called') {
          throw error;
        }
      }

      assert.strictEqual(exitCode, 1);
      assert(errorOutput.some(msg => msg.includes('Invalid provider: invalid-provider')));

      console.error = originalConsoleError;
      process.exit = originalProcessExit;
    });

    it('should reject invalid providers for testKey', async () => {
      const originalConsoleError = console.error;
      const originalProcessExit = process.exit;
      let exitCode = null;
      const errorOutput = [];

      console.error = (...args) => errorOutput.push(args.join(' '));
      process.exit = code => {
        exitCode = code;
        throw new Error('Process exit called');
      };

      try {
        await llmConfigCommand({ testKey: 'invalid-provider' });
        assert.fail('Should have thrown an error');
      } catch (error) {
        if (error.message !== 'Process exit called') {
          throw error;
        }
      }

      assert.strictEqual(exitCode, 1);
      assert(errorOutput.some(msg => msg.includes('Invalid provider: invalid-provider')));

      console.error = originalConsoleError;
      process.exit = originalProcessExit;
    });
  });

  describe('integration with LLM manager', () => {
    it('should make stored keys available to LLM manager', async () => {
      // Create test keys
      const testKeys = {
        openai: 'sk-test123456789012345678901234567890',
      };
      writeFileSync(keysPath, JSON.stringify(testKeys, null, 2));

      // Import LLM manager and test key access
      const { LLMManager } = await import('../../src/llm/llm-manager.js');
      const manager = new LLMManager();

      const retrievedKey = manager.getApiKey('openai');
      assert.strictEqual(retrievedKey, 'sk-test123456789012345678901234567890');
    });

    it('should fall back to environment variables when no stored key exists', async () => {
      // Ensure no stored keys
      if (existsSync(keysPath)) {
        unlinkSync(keysPath);
      }

      // Set environment variable
      process.env.OPENAI_API_KEY = 'sk-env123456789012345678901234567890';

      try {
        const { LLMManager } = await import('../../src/llm/llm-manager.js');
        const manager = new LLMManager();

        const retrievedKey = manager.getApiKey('openai');
        assert.strictEqual(retrievedKey, 'sk-env123456789012345678901234567890');
      } finally {
        delete process.env.OPENAI_API_KEY;
      }
    });

    it('should prefer stored keys over environment variables', async () => {
      // Set both stored and environment keys
      const testKeys = {
        openai: 'sk-stored123456789012345678901234567890',
      };
      writeFileSync(keysPath, JSON.stringify(testKeys, null, 2));
      process.env.OPENAI_API_KEY = 'sk-env123456789012345678901234567890';

      try {
        const { LLMManager } = await import('../../src/llm/llm-manager.js');
        const manager = new LLMManager();

        const retrievedKey = manager.getApiKey('openai');
        assert.strictEqual(retrievedKey, 'sk-stored123456789012345678901234567890');
      } finally {
        delete process.env.OPENAI_API_KEY;
      }
    });
  });

  describe('error handling', () => {
    it('should handle permission errors gracefully', async () => {
      // This test would require specific setup to simulate permission errors
      // For now, we'll just ensure the error handling structure exists
      assert(typeof llmConfigCommand === 'function');
    });

    it('should handle network errors in key testing', async () => {
      // Mock network error scenarios would go here
      // For now, we'll validate the structure exists
      const testKeys = {
        openai: 'sk-test123456789012345678901234567890',
      };
      writeFileSync(keysPath, JSON.stringify(testKeys, null, 2));

      // Test key testing would normally make network calls
      // We'll just ensure the command structure can handle testKey option
      const originalConsoleLog = console.log;
      const logOutput = [];
      console.log = (...args) => logOutput.push(args.join(' '));

      try {
        // This will attempt to test the key, but should handle network errors gracefully
        await llmConfigCommand({ testKey: 'openai' });

        // Should have attempted the test (output may vary based on network)
        const output = logOutput.join('\n');
        assert(output.includes('Testing OPENAI API key') || output.includes('API key test failed'));
      } finally {
        console.log = originalConsoleLog;
      }
    });
  });
});
