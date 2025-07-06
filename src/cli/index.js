#!/usr/bin/env node

/**
 * Taskwerk CLI Entry Point
 * 
 * @description Main CLI executable for taskwerk
 * @module taskwerk/cli
 */

import { program } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get package info
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try multiple paths for package.json (bundled vs unbundled)
let packageJson = null;
const possiblePaths = [
  join(__dirname, '../../package.json'), // Development/unbundled
  join(process.cwd(), 'package.json'), // Current working directory
  './package.json', // Relative to CWD
];

for (const packagePath of possiblePaths) {
  try {
    packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
    break;
  } catch (error) {
    // Continue trying other paths
  }
}

// Fallback to hardcoded values if package.json not found
if (!packageJson) {
  packageJson = {
    name: 'taskwerk',
    version: '0.3.13',
    description: 'A git-aware task management CLI for developers and AI agents working together',
  };
}

// Configure main program
program
  .name('taskwerk')
  .description('Git-aware task management CLI for developers and AI agents')
  .version(packageJson.version)
  .alias('twrk');

// Import subcommands
import { makeSystemCommand, makeInitCommand, makeStatusCommand, makeAboutCommand } from './commands/system/index.js';

// Add subcommands
program.addCommand(makeSystemCommand());

// Also add init, status, and about as top-level commands for convenience
program.addCommand(makeInitCommand());
program.addCommand(makeStatusCommand());
program.addCommand(makeAboutCommand());

// Error handling
program.exitOverride();

try {
  await program.parseAsync(process.argv);
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}