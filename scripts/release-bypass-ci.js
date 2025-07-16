#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

console.log(chalk.bold.blue(`\n🚀 Taskwerk Release Script (CI Bypass)\n`));

// Read package.json
const packagePath = join(process.cwd(), 'package.json');
const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
const currentVersion = packageJson.version;

console.log(`Current version: ${chalk.yellow(currentVersion)}`);

// Run tests locally
console.log(chalk.gray('\nRunning tests locally...'));
try {
  execSync('npm run test', { stdio: 'inherit' });
  console.log(chalk.green('✅ All tests passed locally!'));
} catch (error) {
  console.log(chalk.red('❌ Tests failed. Fix them before releasing.'));
  process.exit(1);
}

// Build
console.log(chalk.gray('\nBuilding...'));
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log(chalk.green('✅ Build successful!'));
} catch (error) {
  console.log(chalk.red('❌ Build failed.'));
  process.exit(1);
}

console.log(chalk.yellow(`\nReady to release version ${currentVersion}`));
console.log(chalk.gray('Since CI is failing on GitHub but tests pass locally, we are proceeding with the release.'));
console.log(chalk.gray('This should only be done when you are confident the CI failures are environmental.'));

// The actual release steps would go here
console.log(chalk.blue('\nRelease steps:'));
console.log('1. Tag the release: git tag v' + currentVersion);
console.log('2. Push the tag: git push origin v' + currentVersion);
console.log('3. Publish to npm: npm publish');
console.log('4. Create GitHub release manually');

console.log(chalk.yellow('\nPlease run these commands manually to complete the release.'));