import { Command } from 'commander';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { ConfigManager } from '../config/config-manager.js';
import { TaskwerkDatabase } from '../db/database.js';
import { applySchema } from '../db/schema.js';
import { Logger } from '../logging/logger.js';

export function initCommand() {
  const init = new Command('init');

  init
    .description('Initialize taskwerk in the current directory')
    .option('-f, --force', 'Force initialization, overwrite existing config')
    .option('--git', 'Enable git integration', true)
    .option('--no-git', 'Disable git integration')
    .action(async (options) => {
      const logger = new Logger('init');
      
      try {
        console.log('🚀 Initializing taskwerk...');
        
        // Create .taskwerk directory
        const taskwerkDir = join(homedir(), '.taskwerk');
        if (!existsSync(taskwerkDir)) {
          mkdirSync(taskwerkDir, { recursive: true });
          console.log(`✅ Created directory: ${taskwerkDir}`);
        }
        
        // Initialize configuration
        const configManager = new ConfigManager();
        configManager.load(); // This creates default config if it doesn't exist
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
        
        database.close();
        
        console.log('\n🎉 Taskwerk initialized successfully!');
        console.log('\nTry these commands:');
        console.log('  taskwerk task add "My first task"');
        console.log('  taskwerk task list');
        console.log('  taskwerk --help');
        
      } catch (error) {
        logger.error('Failed to initialize taskwerk', error);
        console.error('❌ Failed to initialize taskwerk:', error.message);
        process.exit(1);
      }
    });

  return init;
}
