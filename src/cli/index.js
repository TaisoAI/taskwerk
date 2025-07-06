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
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../../package.json'), 'utf-8')
);

// Configure main program
program
  .name('taskwerk')
  .description('Git-aware task management CLI for developers and AI agents')
  .version(packageJson.version)
  .alias('twrk');

// Import subcommands
// TODO: Import command modules as they are implemented

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