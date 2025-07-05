#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runCommand(command, args = [], cwd = process.cwd()) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: true,
    });

    proc.on('close', code => {
      if (code === 0) {
        resolve(code);
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    proc.on('error', error => {
      reject(error);
    });
  });
}

async function test() {
  const scriptsDir = __dirname;
  let exitCode = 0;

  try {
    // Show version banner
    await runCommand('node', [join(scriptsDir, 'version-banner.js'), 'running tests']);

    // Check if running with coverage
    const withCoverage = process.argv.includes('--coverage') || process.env.CI === 'true';

    if (withCoverage) {
      // Run tests with coverage using c8
      console.log('\n📊 Running tests with code coverage...\n');
      await runCommand('npx', [
        'c8',
        'node',
        '--test',
        'tests/**/*.test.js'
      ]);
    } else {
      // Run tests without coverage
      await runCommand('node', ['--test', 'tests/**/*.test.js']);
    }

    // Success banner
    await runCommand('node', [join(scriptsDir, 'completion-banner.js'), 'tests', '0']);

    // Print coverage summary if running with coverage
    if (withCoverage) {
      console.log('\n📊 Code Coverage Summary printed above by c8\n');
      console.log('📁 Detailed coverage report available at: coverage/lcov-report/index.html');
    }
  } catch (error) {
    exitCode = 1;
    
    // Failure banner
    try {
      await runCommand('node', [join(scriptsDir, 'completion-banner.js'), 'tests', '1']);
    } catch (bannerError) {
      // If banner fails, just log the original error
      console.error('Tests failed:', error.message);
    }
  }

  process.exit(exitCode);
}

test().catch(error => {
  console.error('Test script failed:', error.message);
  process.exit(1);
});