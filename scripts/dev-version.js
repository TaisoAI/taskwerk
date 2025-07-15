#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';

const packageJsonPath = join(process.cwd(), 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

const command = process.argv[2];
const currentVersion = packageJson.version;

console.log(chalk.bold.blue('\n🔧 Development Version Manager\n'));
console.log(chalk.gray(`Current version: ${currentVersion}`));

function updateVersion(newVersion) {
  packageJson.version = newVersion;
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  
  // Run build to update src/version.js
  console.log(chalk.gray('Updating version files...'));
  execSync('npm run build', { stdio: 'inherit' });
  
  console.log(chalk.green(`✅ Version updated to ${newVersion}`));
}

function parseVersion(version) {
  // Match standard version and optional pre-release (e.g., 1.2.3-dev.4)
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-(\w+)\.(\d+))?$/);
  if (!match) {
    throw new Error('Invalid version format');
  }
  return {
    major: parseInt(match[1]),
    minor: parseInt(match[2]),
    patch: parseInt(match[3]),
    prerelease: match[4] || null,
    prereleaseNum: match[5] ? parseInt(match[5]) : null
  };
}

function formatVersion(parts) {
  let version = `${parts.major}.${parts.minor}.${parts.patch}`;
  if (parts.prerelease && parts.prereleaseNum !== null) {
    version += `-${parts.prerelease}.${parts.prereleaseNum}`;
  }
  return version;
}

switch (command) {
  case 'start':
    // Start development with -dev.1 prerelease
    const parts = parseVersion(currentVersion);
    if (parts.prerelease !== null) {
      console.log(chalk.yellow('Already in development mode'));
      process.exit(0);
    }
    parts.prerelease = 'dev';
    parts.prereleaseNum = 1;
    updateVersion(formatVersion(parts));
    break;
    
  case 'bump':
    // Increment prerelease number
    const currentParts = parseVersion(currentVersion);
    if (currentParts.prerelease === null) {
      console.log(chalk.yellow('Not in development mode. Run "dev:start" first'));
      process.exit(1);
    }
    currentParts.prereleaseNum++;
    updateVersion(formatVersion(currentParts));
    break;
    
  case 'finalize':
    // Remove prerelease for final release
    const releaseParts = parseVersion(currentVersion);
    if (releaseParts.prerelease === null) {
      console.log(chalk.yellow('No prerelease version to remove'));
      process.exit(0);
    }
    releaseParts.prerelease = null;
    releaseParts.prereleaseNum = null;
    updateVersion(formatVersion(releaseParts));
    console.log(chalk.green('Ready for release!'));
    break;
    
  case 'next-patch':
    // Bump patch and add -dev.1
    const patchParts = parseVersion(currentVersion);
    patchParts.patch++;
    patchParts.prerelease = 'dev';
    patchParts.prereleaseNum = 1;
    updateVersion(formatVersion(patchParts));
    break;
    
  case 'next-minor':
    // Bump minor and add -dev.1
    const minorParts = parseVersion(currentVersion);
    minorParts.minor++;
    minorParts.patch = 0;
    minorParts.prerelease = 'dev';
    minorParts.prereleaseNum = 1;
    updateVersion(formatVersion(minorParts));
    break;
    
  case 'next-major':
    // Bump major and add -dev.1
    const majorParts = parseVersion(currentVersion);
    majorParts.major++;
    majorParts.minor = 0;
    majorParts.patch = 0;
    majorParts.prerelease = 'dev';
    majorParts.prereleaseNum = 1;
    updateVersion(formatVersion(majorParts));
    break;
    
  default:
    console.log(chalk.yellow('Usage:'));
    console.log('  npm run dev:start      - Start development (adds -dev.1)');
    console.log('  npm run dev:bump       - Increment prerelease number');
    console.log('  npm run dev:finalize   - Remove prerelease for release');
    console.log('  npm run dev:next-patch - Start next patch version (0.7.4 -> 0.7.5-dev.1)');
    console.log('  npm run dev:next-minor - Start next minor version (0.7.4 -> 0.8.0-dev.1)');
    console.log('  npm run dev:next-major - Start next major version (0.7.4 -> 1.0.0-dev.1)');
    console.log('');
    console.log(chalk.gray('Example workflow:'));
    console.log(chalk.gray('  npm run dev:next-patch  # 0.7.3 -> 0.7.4-dev.1'));
    console.log(chalk.gray('  npm run dev:bump        # 0.7.4-dev.1 -> 0.7.4-dev.2'));
    console.log(chalk.gray('  npm run dev:bump        # 0.7.4-dev.2 -> 0.7.4-dev.3'));
    console.log(chalk.gray('  npm run dev:finalize    # 0.7.4-dev.3 -> 0.7.4'));
    console.log(chalk.gray('  npm run make-release    # Release 0.7.4'));
    process.exit(0);
}