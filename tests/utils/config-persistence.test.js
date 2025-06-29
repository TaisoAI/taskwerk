import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { existsSync, unlinkSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { writeFile } from 'fs/promises';

// Import the DEFAULT_CONFIG directly to test persistence logic
const DEFAULT_CONFIG = {
  tasksFile: 'tasks/tasks.md',
  completedFile: 'tasks/tasks_completed.md',
  autoCommit: false,
  autoCreateBranch: true,
  defaultPriority: 'medium',
  defaultModel: null,
  categories: {
    bugs: 'Bug Fixes',
    features: 'Features',
    docs: 'Documentation',
    refactor: 'Refactoring',
    test: 'Testing',
  },
};

// Mock save function that uses test file
async function testSaveConfig(config) {
  const configPath = join(process.cwd(), '.test-taskrc-persistence.json');

  try {
    const configToSave = { ...config };
    // Remove default values to keep config clean, but preserve explicit settings
    Object.keys(DEFAULT_CONFIG).forEach(key => {
      if (configToSave[key] === DEFAULT_CONFIG[key] && key !== 'defaultModel') {
        delete configToSave[key];
      }
    });

    await writeFile(configPath, JSON.stringify(configToSave, null, 2));
    return true;
  } catch (error) {
    throw new Error(`Failed to save config: ${error.message}`);
  }
}

// Mock load function that uses test file
async function testLoadConfig() {
  const configPath = join(process.cwd(), '.test-taskrc-persistence.json');

  let userConfig = {};

  if (existsSync(configPath)) {
    try {
      const content = readFileSync(configPath, 'utf-8');
      userConfig = JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to load config: ${error.message}`);
    }
  }

  return { ...DEFAULT_CONFIG, ...userConfig };
}

describe('Config Persistence', () => {
  const testConfigPath = join(process.cwd(), '.test-taskrc-persistence.json');
  let originalConfig = null;

  beforeEach(async () => {
    // Backup existing config if it exists
    if (existsSync(testConfigPath)) {
      const fs = await import('fs/promises');
      originalConfig = await fs.readFile(testConfigPath, 'utf-8');
    }
  });

  afterEach(async () => {
    // Restore original config or clean up
    if (originalConfig) {
      writeFileSync(testConfigPath, originalConfig);
    } else if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath);
    }
  });

  describe('defaultModel persistence', () => {
    it('should preserve defaultModel when explicitly set to null', async () => {
      const testConfig = {
        defaultModel: null,
        autoCommit: true, // Non-default value to ensure config gets saved
      };

      await testSaveConfig(testConfig);
      assert(existsSync(testConfigPath));

      const savedConfig = await testLoadConfig();
      assert.strictEqual(savedConfig.defaultModel, null);
    });

    it('should preserve defaultModel when set to a specific value', async () => {
      const testConfig = {
        defaultModel: 'llama3.2:3b',
        autoCommit: true,
      };

      await testSaveConfig(testConfig);
      assert(existsSync(testConfigPath));

      const savedConfig = await testLoadConfig();
      assert.strictEqual(savedConfig.defaultModel, 'llama3.2:3b');
    });

    it('should preserve defaultModel across multiple save operations', async () => {
      // First save with a model
      let testConfig = {
        defaultModel: 'llama3.2:3b',
        autoCommit: true,
      };

      await testSaveConfig(testConfig);
      let savedConfig = await testLoadConfig();
      assert.strictEqual(savedConfig.defaultModel, 'llama3.2:3b');

      // Second save with different values but same model
      testConfig = {
        ...savedConfig,
        autoCommit: false,
      };

      await testSaveConfig(testConfig);
      savedConfig = await testLoadConfig();
      assert.strictEqual(savedConfig.defaultModel, 'llama3.2:3b');
      assert.strictEqual(savedConfig.autoCommit, false);
    });

    it('should allow defaultModel to be changed and persisted', async () => {
      // Start with one model
      let testConfig = {
        defaultModel: 'llama3.2:3b',
        autoCommit: true,
      };

      await testSaveConfig(testConfig);
      let savedConfig = await testLoadConfig();
      assert.strictEqual(savedConfig.defaultModel, 'llama3.2:3b');

      // Change to a different model
      testConfig = {
        ...savedConfig,
        defaultModel: 'gpt-4',
      };

      await testSaveConfig(testConfig);
      savedConfig = await testLoadConfig();
      assert.strictEqual(savedConfig.defaultModel, 'gpt-4');
    });

    it('should handle defaultModel being set back to null', async () => {
      // Start with a model
      let testConfig = {
        defaultModel: 'llama3.2:3b',
        autoCommit: true,
      };

      await testSaveConfig(testConfig);
      let savedConfig = await testLoadConfig();
      assert.strictEqual(savedConfig.defaultModel, 'llama3.2:3b');

      // Set back to null
      testConfig = {
        ...savedConfig,
        defaultModel: null,
      };

      await testSaveConfig(testConfig);
      savedConfig = await testLoadConfig();
      assert.strictEqual(savedConfig.defaultModel, null);
    });
  });

  describe('other default value handling', () => {
    it('should still remove other default values to keep config clean', async () => {
      const testConfig = {
        defaultModel: 'llama3.2:3b',
        tasksFile: 'tasks/tasks.md', // Default value
        autoCommit: false, // Default value
        defaultPriority: 'medium', // Default value
      };

      await testSaveConfig(testConfig);

      const fs = await import('fs/promises');
      const rawConfig = await fs.readFile(testConfigPath, 'utf-8');
      const parsedConfig = JSON.parse(rawConfig);

      // Should preserve defaultModel
      assert.strictEqual(parsedConfig.defaultModel, 'llama3.2:3b');

      // Should remove default values
      assert(!Object.prototype.hasOwnProperty.call(parsedConfig, 'tasksFile'));
      assert(!Object.prototype.hasOwnProperty.call(parsedConfig, 'autoCommit'));
      assert(!Object.prototype.hasOwnProperty.call(parsedConfig, 'defaultPriority'));
    });

    it('should preserve non-default values', async () => {
      const testConfig = {
        defaultModel: 'llama3.2:3b',
        tasksFile: 'custom/tasks.md', // Non-default value
        autoCommit: true, // Non-default value
        defaultPriority: 'high', // Non-default value
      };

      await testSaveConfig(testConfig);

      const savedConfig = await testLoadConfig();
      assert.strictEqual(savedConfig.defaultModel, 'llama3.2:3b');
      assert.strictEqual(savedConfig.tasksFile, 'custom/tasks.md');
      assert.strictEqual(savedConfig.autoCommit, true);
      assert.strictEqual(savedConfig.defaultPriority, 'high');
    });
  });

  describe('config file integrity', () => {
    it('should create valid JSON files', async () => {
      const testConfig = {
        defaultModel: 'llama3.2:3b',
        autoCommit: true,
      };

      await testSaveConfig(testConfig);

      const fs = await import('fs/promises');
      const rawConfig = await fs.readFile(testConfigPath, 'utf-8');

      // Should be valid JSON
      assert.doesNotThrow(() => {
        JSON.parse(rawConfig);
      });
    });

    it('should handle loading from empty/missing config file', async () => {
      if (existsSync(testConfigPath)) {
        unlinkSync(testConfigPath);
      }

      const config = await testLoadConfig();

      // Should return default config
      assert.strictEqual(config.defaultModel, null);
      assert.strictEqual(config.autoCommit, false);
      assert.strictEqual(config.defaultPriority, 'medium');
    });
  });
});
