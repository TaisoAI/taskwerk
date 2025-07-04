#!/usr/bin/env node

/**
 * TaskWerk v3 CLI Entry Point
 * 
 * Main entry point for the TaskWerk CLI that uses the new command framework
 * with registry, global options, and consistent error handling.
 */

import { registry } from './command-registry.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Configure global options
 */
function configureGlobalOptions() {
    registry
        .globalOption('-h, --help', 'Show help information')
        .globalOption('-v, --version', 'Show version information')
        .globalOption('-f, --format <format>', 'Output format (pretty, plain, json)', 'pretty')
        .globalOption('-q, --quiet', 'Suppress non-essential output')
        .globalOption('--verbose', 'Show detailed output')
        .globalOption('--debug', 'Show debug information')
        .globalOption('--no-color', 'Disable colored output')
        .globalOption('--config <path>', 'Path to configuration file');
}

/**
 * Main CLI function
 */
async function main() {
    try {
        // Configure global options
        configureGlobalOptions();

        // Load all commands from the commands directory
        const commandsDir = join(__dirname, '../commands');
        await registry.loadCommandsFromDirectory(commandsDir);

        // Parse command line arguments
        const args = process.argv.slice(2);

        // Handle no-color option early
        if (args.includes('--no-color')) {
            process.env.FORCE_COLOR = '0';
        }

        // Execute the command
        const exitCode = await registry.execute(args);
        process.exit(exitCode);

    } catch (error) {
        console.error('Fatal error:', error.message);
        if (process.env.DEBUG || args.includes('--debug')) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error.message);
    if (process.env.DEBUG) {
        console.error(error.stack);
    }
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled promise rejection:', reason);
    if (process.env.DEBUG) {
        console.error('Promise:', promise);
    }
    process.exit(1);
});

// Run the CLI
main();