/**
 * TaskWerk v3 Command Registry
 * 
 * Manages command registration, discovery, and execution with support
 * for aliases, categories, and dynamic loading.
 */

import { BaseCommand } from './base-command.js';
import chalk from 'chalk';
import { readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Command Registry singleton
 */
class CommandRegistry {
    constructor() {
        this.commands = new Map();
        this.aliases = new Map();
        this.categories = new Map();
        this.globalOptions = [];
    }

    /**
     * Register a command
     */
    register(command) {
        if (!(command instanceof BaseCommand)) {
            throw new Error('Command must extend BaseCommand');
        }

        // Register main command
        this.commands.set(command.name, command);

        // Register category
        const category = command.category || 'Other';
        if (!this.categories.has(category)) {
            this.categories.set(category, []);
        }
        this.categories.get(category).push(command.name);

        // Register aliases if any
        if (command.aliases) {
            for (const alias of command.aliases) {
                this.aliases.set(alias, command.name);
            }
        }

        return this;
    }

    /**
     * Register a global option that applies to all commands
     */
    globalOption(flags, description, defaultValue) {
        this.globalOptions.push({
            flags,
            description,
            defaultValue
        });
        return this;
    }

    /**
     * Get a command by name or alias
     */
    getCommand(name) {
        // Check direct command name
        if (this.commands.has(name)) {
            return this.commands.get(name);
        }

        // Check aliases
        if (this.aliases.has(name)) {
            const actualName = this.aliases.get(name);
            return this.commands.get(actualName);
        }

        return null;
    }

    /**
     * Get all registered commands
     */
    getAllCommands() {
        return Array.from(this.commands.values());
    }

    /**
     * Get commands by category
     */
    getCommandsByCategory() {
        const result = {};
        
        for (const [category, commandNames] of this.categories) {
            result[category] = commandNames.map(name => this.commands.get(name));
        }
        
        return result;
    }

    /**
     * Auto-discover and load commands from a directory
     */
    async loadCommandsFromDirectory(dir) {
        try {
            const files = await readdir(dir);
            
            for (const file of files) {
                if (file.endsWith('.js') && file !== 'index.js') {
                    const modulePath = join(dir, file);
                    try {
                        const module = await import(modulePath);
                        
                        // Look for default export or named Command export
                        const CommandClass = module.default || module.Command;
                        
                        if (CommandClass && CommandClass.prototype instanceof BaseCommand) {
                            const command = new CommandClass();
                            this.register(command);
                        }
                    } catch (error) {
                        console.warn(`Failed to load command from ${file}:`, error.message);
                    }
                }
            }
        } catch (error) {
            console.warn(`Failed to read commands directory:`, error.message);
        }
    }

    /**
     * Show help for all commands
     */
    showHelp() {
        console.log(chalk.bold('TaskWerk v3 - Task Management CLI'));
        console.log();
        console.log(chalk.bold('Usage:'));
        console.log('  taskwerk <command> [options] [arguments]');
        console.log();
        
        // Global options
        if (this.globalOptions.length > 0) {
            console.log(chalk.bold('Global Options:'));
            for (const opt of this.globalOptions) {
                console.log(`  ${opt.flags.padEnd(20)} ${opt.description}`);
            }
            console.log();
        }
        
        // Commands by category
        console.log(chalk.bold('Available Commands:'));
        
        const commandsByCategory = this.getCommandsByCategory();
        const sortedCategories = Object.keys(commandsByCategory).sort();
        
        for (const category of sortedCategories) {
            console.log();
            console.log(chalk.yellow(`  ${category}:`));
            
            const commands = commandsByCategory[category].sort((a, b) => 
                a.name.localeCompare(b.name)
            );
            
            for (const command of commands) {
                let line = `    ${command.name.padEnd(15)} ${command.description}`;
                
                // Add aliases if any
                if (command.aliases && command.aliases.length > 0) {
                    line += chalk.gray(` (alias: ${command.aliases.join(', ')})`);
                }
                
                console.log(line);
            }
        }
        
        console.log();
        console.log(chalk.gray('Run "taskwerk <command> --help" for command-specific help'));
    }

    /**
     * Show version information
     */
    async showVersion() {
        // Load package.json to get version
        try {
            const { readFileSync } = await import('fs');
            const packagePath = join(__dirname, '../../package.json');
            const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
            console.log(`TaskWerk v${packageJson.version}`);
        } catch (error) {
            console.log('TaskWerk v3');
        }
    }

    /**
     * Parse and execute a command
     */
    async execute(args) {
        // Handle no arguments
        if (args.length === 0) {
            this.showHelp();
            return 0;
        }

        // Extract command name
        const commandName = args[0];
        const commandArgs = args.slice(1);

        // Handle global options
        if (commandName === '--help' || commandName === '-h') {
            this.showHelp();
            return 0;
        }

        if (commandName === '--version' || commandName === '-v') {
            this.showVersion();
            return 0;
        }

        // Find and execute command
        const command = this.getCommand(commandName);
        
        if (!command) {
            console.error(chalk.red(`Unknown command: ${commandName}`));
            console.error(chalk.gray('Run "taskwerk --help" to see available commands'));
            return 1;
        }

        // Apply global options to command
        for (const globalOpt of this.globalOptions) {
            // Check if command doesn't already have this option
            const hasOption = command.options.some(opt => 
                globalOpt.flags.includes(opt.flags)
            );
            
            if (!hasOption) {
                command.option(globalOpt.flags, globalOpt.description, globalOpt.defaultValue);
            }
        }

        // Execute the command
        return await command.run(commandArgs);
    }

    /**
     * Create a command group (for subcommands)
     */
    createGroup(name, description) {
        const group = new CommandGroup(name, description);
        this.register(group);
        return group;
    }
}

/**
 * Command group for organizing subcommands
 */
class CommandGroup extends BaseCommand {
    constructor(name, description) {
        super(name, description);
        this.subcommands = new Map();
        this.category = 'Groups';
    }

    /**
     * Add a subcommand
     */
    subcommand(command) {
        if (!(command instanceof BaseCommand)) {
            throw new Error('Subcommand must extend BaseCommand');
        }
        
        this.subcommands.set(command.name, command);
        return this;
    }

    /**
     * Execute group command
     */
    async execute(args, options) {
        if (args.length === 0) {
            this.showGroupHelp();
            return;
        }

        const subcommandName = args[0];
        const subcommandArgs = args.slice(1);

        const subcommand = this.subcommands.get(subcommandName);
        
        if (!subcommand) {
            console.error(chalk.red(`Unknown subcommand: ${this.name} ${subcommandName}`));
            this.showGroupHelp();
            throw new Error(`Unknown subcommand: ${subcommandName}`);
        }

        // Execute subcommand
        await subcommand.execute(subcommandArgs, options);
    }

    /**
     * Show help for command group
     */
    showGroupHelp() {
        console.log(`${chalk.bold(this.name)} - ${this.description}`);
        console.log();
        console.log(chalk.bold('Usage:'));
        console.log(`  taskwerk ${this.name} <subcommand> [options]`);
        console.log();
        console.log(chalk.bold('Available Subcommands:'));
        
        const sortedSubcommands = Array.from(this.subcommands.values())
            .sort((a, b) => a.name.localeCompare(b.name));
        
        for (const subcmd of sortedSubcommands) {
            console.log(`  ${subcmd.name.padEnd(15)} ${subcmd.description}`);
        }
        
        console.log();
        console.log(chalk.gray(`Run "taskwerk ${this.name} <subcommand> --help" for subcommand help`));
    }

    /**
     * Override showHelp to show group help
     */
    showHelp() {
        this.showGroupHelp();
    }
}

// Create and export singleton instance
export const registry = new CommandRegistry();

// Export classes for extension
export { CommandRegistry, CommandGroup };