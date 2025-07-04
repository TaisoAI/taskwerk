/**
 * TaskWerk v3 Init Command
 * 
 * Initializes a new TaskWerk v3 project with database and configuration
 */

import { BaseCommand } from '../cli/base-command.js';
import { DatabaseInitializer } from '../core/database/init.js';
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

/**
 * Init command implementation
 */
export class InitCommand extends BaseCommand {
    constructor() {
        super('init', 'Initialize a new TaskWerk project');
        
        // Set category
        this.category = 'Project Management';
        
        // Define options
        this.option('-d, --database <path>', 'Database file path', '.taskwerk.db')
            .option('-c, --config <path>', 'Config file path', '.taskwerk.json')
            .option('--force', 'Overwrite existing project')
            .option('--no-sample', 'Skip creating sample tasks')
            .option('--import <path>', 'Import tasks from v2 format');
    }

    /**
     * Execute init command
     */
    async execute(args, options) {
        const dbPath = options.database;
        const configPath = options.config;
        const force = options.force;

        // Check if project already exists
        if (!force && existsSync(dbPath)) {
            throw new Error(
                `TaskWerk project already exists at ${dbPath}\n` +
                'Use --force to overwrite or specify a different path with --database'
            );
        }

        this.info('Initializing TaskWerk v3 project...');

        // Initialize database
        await this.initializeDatabase(dbPath, force);

        // Create configuration file
        await this.createConfig(configPath, { databasePath: dbPath }, force);

        // Create sample tasks if requested
        if (!options['no-sample']) {
            await this.createSampleTasks();
        }

        // Import v2 tasks if specified
        if (options.import) {
            await this.importV2Tasks(options.import);
        }

        // Show summary
        this.showSummary(dbPath, configPath);
    }

    /**
     * Initialize the database
     */
    async initializeDatabase(dbPath, force) {
        this.info(`Creating database at ${dbPath}...`);

        const initializer = new DatabaseInitializer(dbPath);
        
        try {
            const result = await initializer.initialize(force);
            
            if (result.created) {
                this.success('Database created successfully');
            } else {
                this.info('Database already initialized');
            }

            // Show database info
            const stats = await initializer.getDatabaseStats();
            this.info(`Database version: ${stats.version}`);
            this.info(`Tables created: ${stats.tables.tasks !== undefined ? Object.keys(stats.tables).length : 0}`);

        } finally {
            initializer.close();
        }
    }

    /**
     * Create configuration file
     */
    async createConfig(configPath, config, force) {
        if (!force && existsSync(configPath)) {
            this.warn(`Configuration file already exists at ${configPath}`);
            return;
        }

        const defaultConfig = {
            version: '3.0.0',
            databasePath: config.databasePath || '.taskwerk.db',
            outputFormat: 'pretty',
            editor: process.env.EDITOR || 'nano',
            colors: true,
            git: {
                autoCommit: false,
                branchPrefix: 'task/',
                commitPrefix: 'task:'
            },
            workflow: {
                requireEstimates: false,
                autoStart: true,
                validateDependencies: true
            },
            display: {
                dateFormat: 'YYYY-MM-DD',
                timeFormat: 'HH:mm',
                taskIdFormat: 'TASK-{id}'
            }
        };

        try {
            writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
            this.success(`Configuration file created at ${configPath}`);
        } catch (error) {
            throw new Error(`Failed to create configuration file: ${error.message}`);
        }
    }

    /**
     * Create sample tasks
     */
    async createSampleTasks() {
        this.info('Creating sample tasks...');

        const sampleTasks = [
            {
                name: 'Welcome to TaskWerk',
                description: 'Get started with TaskWerk v3 by exploring the available commands',
                status: 'todo',
                priority: 'high',
                category: 'documentation'
            },
            {
                name: 'Review TaskWerk documentation',
                description: 'Read through the TaskWerk documentation at https://github.com/deftio/taskwerk',
                status: 'todo',
                priority: 'medium',
                category: 'documentation'
            },
            {
                name: 'Create your first task',
                description: 'Use "taskwerk add" to create your first real task',
                status: 'todo',
                priority: 'medium',
                category: 'learning'
            }
        ];

        let created = 0;
        for (const taskData of sampleTasks) {
            try {
                const task = await this.apis.task.createTask(taskData);
                created++;
                
                // Add welcome note to first task
                if (created === 1) {
                    await this.apis.notes.addNote(
                        task.id,
                        'Welcome to TaskWerk v3! This task management system is designed for human-AI collaboration.',
                        'comment',
                        { user: 'system' }
                    );
                }
            } catch (error) {
                this.warn(`Failed to create sample task: ${error.message}`);
            }
        }

        if (created > 0) {
            this.success(`Created ${created} sample tasks`);
        }
    }

    /**
     * Import tasks from v2 format
     */
    async importV2Tasks(importPath) {
        this.info(`Importing tasks from ${importPath}...`);
        
        // TODO: Implement v2 import logic
        this.warn('Task import from v2 format is not yet implemented');
    }

    /**
     * Show initialization summary
     */
    showSummary(dbPath, configPath) {
        console.log();
        console.log(chalk.green.bold('✓ TaskWerk project initialized successfully!'));
        console.log();
        console.log('Project details:');
        console.log(`  Database: ${chalk.cyan(dbPath)}`);
        console.log(`  Config:   ${chalk.cyan(configPath)}`);
        console.log();
        console.log('Next steps:');
        console.log(`  1. Run ${chalk.cyan('taskwerk list')} to see your tasks`);
        console.log(`  2. Run ${chalk.cyan('taskwerk add "Your task name"')} to create a task`);
        console.log(`  3. Run ${chalk.cyan('taskwerk --help')} to see all available commands`);
        console.log();
    }
}

// Export as default for auto-discovery
export default InitCommand;