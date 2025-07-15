import { Command } from 'commander';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ConfigManager } from '../config/config-manager.js';
import { TaskwerkDatabase } from '../db/database.js';
import { applySchema } from '../db/schema.js';
import { Logger } from '../logging/logger.js';

export function initCommand() {
  const init = new Command('init');

  init
    .description('Initialize taskwerk in the current directory')
    .option('-f, --force', 'Force initialization, overwrite existing config')
    .addHelpText(
      'after',
      `
Examples:
  Basic initialization:
    $ twrk init                          # Initialize in current directory
    $ twrk init --force                  # Reinitialize, keeping data
    
  Common workflows:
    $ cd my-project && twrk init         # Initialize in project root
    $ twrk init && twrk addtask "Setup project"
    
What this creates:
  .taskwerk/
  ├── taskwerk.db                       # SQLite database for tasks
  ├── config.yml                        # Configuration file
  ├── taskwerk_rules.md                 # Project conventions (customize this!)
  └── logs/                             # Log files directory
  
After initialization:
  $ twrk addtask "My first task"        # Create your first task
  $ twrk listtask                       # View all tasks
  $ twrk aiconfig                       # Setup AI integration
  $ cat .taskwerk/taskwerk_rules.md    # Review/edit project rules
  
Note: The .taskwerk directory should be added to version control
      (except taskwerk.db if you want task data to be local)`
    )
    .action(async _options => {
      const logger = new Logger('init');

      try {
        console.log('🚀 Initializing taskwerk...');

        // Create .taskwerk directory in current working directory
        const taskwerkDir = '.taskwerk';
        if (!existsSync(taskwerkDir)) {
          mkdirSync(taskwerkDir, { recursive: true });
          console.log(`✅ Created directory: ${taskwerkDir}`);
        }

        // Initialize configuration
        const configManager = new ConfigManager();
        configManager.load(); // This creates default config if it doesn't exist

        // Save the default config if it doesn't exist
        const configPath = join(taskwerkDir, 'config.yml');
        if (!existsSync(configPath)) {
          configManager.save();
        }
        console.log('✅ Configuration initialized');

        // Initialize database
        const database = new TaskwerkDatabase();
        const db = database.connect();
        const schemaApplied = applySchema(db);

        if (schemaApplied) {
          console.log('✅ Database schema created');
        } else {
          console.log('✅ Database schema up to date');
        }

        // Log directory setup
        const logDir = join(taskwerkDir, 'logs');
        if (!existsSync(logDir)) {
          mkdirSync(logDir, { recursive: true });
          console.log('✅ Log directory created');
        }

        // Create taskwerk_rules.md
        const rulesPath = join(taskwerkDir, 'taskwerk_rules.md');
        if (!existsSync(rulesPath)) {
          const rulesContent = `# Taskwerk Rules

This file contains project-specific rules and conventions for task management.

## Task Naming Conventions
- Use clear, action-oriented task names
- Start with a verb when possible (e.g., "Fix login bug", "Update documentation")

## Priority Guidelines
- **Critical**: Production issues, security vulnerabilities
- **High**: Blocking other work, customer-facing bugs
- **Medium**: Important features, non-blocking bugs
- **Low**: Nice-to-have features, minor improvements

## Task Assignment
- Use @username format for assignments
- Special assignees:
  - @ai-agent: Tasks suitable for AI automation
  - @team: Tasks for team discussion

## Task Categories
Define your project-specific categories here:
- bug: Bug fixes
- feature: New features
- docs: Documentation updates
- refactor: Code improvements
- test: Test additions or fixes

## Workflow States
- **todo**: Not started
- **in-progress**: Currently being worked on
- **blocked**: Waiting on external dependency
- **review**: In code review
- **done**: Completed
- **cancelled**: No longer needed

## Notes
Add any project-specific rules or conventions below:
`;
          writeFileSync(rulesPath, rulesContent, 'utf8');
          console.log('✅ Created taskwerk_rules.md');
        }

        database.close();

        console.log('\n🎉 Taskwerk initialized successfully!');
        console.log('\nTry these commands:');
        console.log('  taskwerk addtask "My first task"');
        console.log('  taskwerk listtask');
        console.log('  taskwerk --help');
      } catch (error) {
        logger.error('Failed to initialize taskwerk', error);
        console.error('❌ Failed to initialize taskwerk:', error.message);
        process.exit(1);
      }
    });

  return init;
}
