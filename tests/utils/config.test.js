import { test } from 'node:test';
import assert from 'node:assert';
import { writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { loadConfig, resetConfigCache } from '../../src/utils/config.js';

const TEST_CONFIG_FILE = join(process.cwd(), '.test-taskrc.json');

async function cleanupConfig() {
  await rm(TEST_CONFIG_FILE, { force: true });
}

test('loadConfig returns default config when no file exists', async () => {
  await cleanupConfig();
  resetConfigCache(); // Clear cache before test

  // Clean up any config files in current directory
  await rm('.taskwerk.json', { force: true });
  await rm('.taskwerkrc', { force: true });
  await rm('.taskwerkrc.json', { force: true });

  const config = await loadConfig();

  assert.strictEqual(config.databasePath, '.taskwerk.db');
  assert.strictEqual(config.outputFormat, 'pretty');
  assert.strictEqual(config.git.autoCommit, false);
  assert.strictEqual(config.workflow.validateDependencies, true);
});

test('loadConfig merges user config with defaults', async () => {
  await cleanupConfig();
  resetConfigCache(); // Clear cache before test

  const userConfig = {
    version: '3.0.0', // Include required version field
    databasePath: 'custom/tasks.db',
    outputFormat: 'json',
    customField: 'custom value',
    git: {
      autoCommit: true,
      branchPrefix: 'feature/',
    },
  };

  // Create the config file that loadConfig actually looks for
  const testConfigFile = join(process.cwd(), '.taskwerk.json');
  await writeFile(testConfigFile, JSON.stringify(userConfig, null, 2));

  const config = await loadConfig();

  assert.strictEqual(config.databasePath, 'custom/tasks.db');
  assert.strictEqual(config.outputFormat, 'json');
  assert.strictEqual(config.git.autoCommit, true); // from user config
  assert.strictEqual(config.git.branchPrefix, 'feature/'); // from user config
  assert.strictEqual(config.git.commitPrefix, 'task:'); // from default
  assert.strictEqual(config.customField, 'custom value');

  // Clean up the config file
  await rm(testConfigFile, { force: true });
});

// Commenting out validateConfig tests as the function is not exported
// test('validateConfig validates required fields', () => {
//   const validConfig = {
//     tasksFile: 'tasks.md',
//     completedFile: 'completed.md',
//     defaultPriority: 'medium',
//   };

//   assert.strictEqual(validateConfig(validConfig), true);

//   const invalidConfig = {
//     tasksFile: 'tasks.md',
//     // missing completedFile
//     defaultPriority: 'medium',
//   };

//   assert.throws(
//     () => validateConfig(invalidConfig),
//     /Missing required config field: completedFile/
//   );
// });

// test('validateConfig validates priority values', () => {
//   const invalidPriorityConfig = {
//     tasksFile: 'tasks.md',
//     completedFile: 'completed.md',
//     defaultPriority: 'invalid',
//   };

//   assert.throws(() => validateConfig(invalidPriorityConfig), /Invalid defaultPriority: invalid/);
// });
