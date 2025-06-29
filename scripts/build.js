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

async function build() {
  const scriptsDir = __dirname;
  let exitCode = 0;

  try {
    // Show version banner
    await runCommand('node', [join(scriptsDir, 'version-banner.js'), 'building']);

    // Run lint
    await runCommand('npm', ['run', 'lint']);

    // Run format check
    await runCommand('npm', ['run', 'format:check']);

    // Run tests
    console.log('\n🧪 Running tests...');
    await runCommand('npm', ['test']);

    // Build minified bundle
    console.log('\n📦 Building minified bundle...');
    await runCommand('node', [join(scriptsDir, 'build-minified.js')]);

    // Build executables
    console.log('\n🔧 Building executables...');
    await runCommand('node', [join(scriptsDir, 'build-executable.js')]);

    // Success banner
    await runCommand('node', [join(scriptsDir, 'completion-banner.js'), 'build', '0']);
  } catch (error) {
    exitCode = 1;
    
    // Failure banner
    try {
      await runCommand('node', [join(scriptsDir, 'completion-banner.js'), 'build', '1']);
    } catch (bannerError) {
      // If banner fails, just log the original error
      console.error('Build failed:', error.message);
    }
  }

  process.exit(exitCode);
}

build().catch(error => {
  console.error('Build script failed:', error.message);
  process.exit(1);
});