#!/usr/bin/env node

/**
 * Taskwerk CLI Entry Point
 * 
 * @description Main CLI executable for taskwerk
 * @module taskwerk/cli
 */

import { program } from 'commander';

// Try to import version info, use sentinel values if not found
let VERSION = '0.0.0-dev';
let NAME = 'taskwerk';
let DESCRIPTION = 'A git-aware task management CLI for developers and AI agents working together';

try {
  const versionModule = await import('../version.js');
  VERSION = versionModule.VERSION;
  NAME = versionModule.NAME;
  DESCRIPTION = versionModule.DESCRIPTION;
} catch (err) {
  console.warn('Warning: version.js not found, using fallback values');
}

// Configure main program
program
  .name(NAME)
  .description(DESCRIPTION)
  .version(VERSION)
  .alias('twrk');

// Import subcommands
import { makeSystemCommand, makeInitCommand, makeStatusCommand, makeAboutCommand } from './commands/system/index.js';
import { makeTaskCommand } from './commands/task/index.js';

// Add subcommands
program.addCommand(makeSystemCommand());
program.addCommand(makeTaskCommand());

// Also add init, status, and about as top-level commands for convenience
program.addCommand(makeInitCommand());
program.addCommand(makeStatusCommand());
program.addCommand(makeAboutCommand());

// Error handling
program.exitOverride();

try {
  await program.parseAsync(process.argv);
} catch (error) {
  // Handle --version and --help exits gracefully
  if (error.code === 'commander.version') {
    // Version is already displayed by commander
    process.exit(0);
  } else if (error.code === 'commander.help') {
    // Help is already displayed by commander
    process.exit(0);
  } else {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
  process.exit(0);
}