/**
 * Project Structure Tests
 * 
 * @description Verifies the v3 project structure is set up correctly
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

test('Project structure', async (t) => {
  await t.test('src directory structure exists', () => {
    const directories = [
      'src',
      'src/storage',
      'src/core',
      'src/core/models',
      'src/core/services',
      'src/cli',
      'src/cli/commands',
      'src/cli/commands/task',
      'src/cli/commands/data',
      'src/cli/commands/git',
      'src/cli/commands/system',
      'src/cli/formatters',
      'src/ai',
      'src/ai/tools',
      'src/utils'
    ];

    for (const dir of directories) {
      assert.ok(
        existsSync(join(projectRoot, dir)),
        `Directory ${dir} should exist`
      );
    }
  });

  await t.test('tests directory structure exists', () => {
    const directories = [
      'tests',
      'tests/storage',
      'tests/core',
      'tests/core/models',
      'tests/core/services',
      'tests/cli',
      'tests/cli/commands',
      'tests/utils',
      'tests/integration'
    ];

    for (const dir of directories) {
      assert.ok(
        existsSync(join(projectRoot, dir)),
        `Directory ${dir} should exist`
      );
    }
  });

  await t.test('key files exist', () => {
    const files = [
      'src/index.js',
      'src/cli/index.js',
      'src/core/constants.js',
      'src/core/api.js',
      '.gitignore',
      'package.json'
    ];

    for (const file of files) {
      assert.ok(
        existsSync(join(projectRoot, file)),
        `File ${file} should exist`
      );
    }
  });
});