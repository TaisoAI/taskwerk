import { Command } from 'commander';
import { existsSync } from 'fs';
import { join } from 'path';
import { TaskwerkAPI } from '../api/taskwerk-api.js';
import { ConfigManager } from '../config/config-manager.js';
import { TaskwerkDatabase } from '../db/database.js';
import { getSchemaVersion } from '../db/schema.js';
import { Logger } from '../logging/logger.js';

export function statusCommand() {
  const status = new Command('status');

  status
    .description('Show taskwerk repository status')
    .option('--format <format>', 'Output format (text, json)', 'text')
    .action(async options => {
      const logger = new Logger('status');

      try {
        const taskwerkDir = '.taskwerk';
        const dbPath = join(taskwerkDir, 'taskwerk.db');
        const configPath = join(taskwerkDir, 'config.yml');

        // Check if taskwerk is initialized
        const isInitialized = existsSync(taskwerkDir) && existsSync(dbPath);

        if (!isInitialized) {
          if (options.format === 'json') {
            console.log(
              JSON.stringify(
                {
                  initialized: false,
                  message: 'Taskwerk not initialized. Run "taskwerk init" first.',
                },
                null,
                2
              )
            );
          } else {
            console.log('❌ Taskwerk not initialized');
            console.log('\nRun this command to get started:');
            console.log('  taskwerk init');
          }
          return;
        }

        // Gather system information
        const api = new TaskwerkAPI();
        const configManager = new ConfigManager();
        const database = new TaskwerkDatabase();
        const db = database.connect();

        // Get task statistics
        const stats = api.getTaskStats();

        // Get configuration info
        const config = configManager.load();

        // Get database info
        const schemaVersion = getSchemaVersion(db);

        // Get recent tasks
        const recentTasks = api.listTasks({
          limit: 5,
          order_by: 'updated_at',
          order_dir: 'DESC',
        });

        database.close();

        if (options.format === 'json') {
          console.log(
            JSON.stringify(
              {
                initialized: true,
                taskwerk_directory: taskwerkDir,
                database: {
                  path: dbPath,
                  exists: existsSync(dbPath),
                  schema_version: schemaVersion,
                },
                configuration: {
                  path: configPath,
                  exists: existsSync(configPath),
                  version: config.general?.version,
                },
                statistics: stats,
                recent_tasks: recentTasks.map(t => ({
                  id: t.id,
                  name: t.name,
                  status: t.status,
                  updated_at: t.updated_at,
                })),
              },
              null,
              2
            )
          );
          return;
        }

        // Text format output
        console.log('📊 Taskwerk Status');
        console.log('═'.repeat(50));

        console.log(`📁 Directory: ${taskwerkDir}`);
        console.log(`💾 Database: ${existsSync(dbPath) ? '✅ Connected' : '❌ Missing'}`);
        console.log(`⚙️  Configuration: ${existsSync(configPath) ? '✅ Loaded' : '❌ Missing'}`);
        console.log(`🗃️  Schema version: ${schemaVersion}`);

        console.log('\n📈 Task Statistics:');
        console.log(`  Total tasks: ${stats.total}`);
        console.log(`  ⏳ Todo: ${stats.by_status.todo || 0}`);
        console.log(`  🔄 In Progress: ${stats.in_progress || 0}`);
        console.log(`  🚫 Blocked: ${stats.by_status.blocked || 0}`);
        console.log(`  ✅ Completed: ${stats.completed || 0}`);
        console.log(`  ❌ Cancelled: ${stats.by_status.cancelled || 0}`);

        if (stats.overdue > 0) {
          console.log(`  ⚠️  Overdue: ${stats.overdue}`);
        }

        console.log('\n🎯 By Priority:');
        console.log(`  🚨 Critical: ${stats.by_priority.critical || 0}`);
        console.log(`  🔴 High: ${stats.by_priority.high || 0}`);
        console.log(`  🟡 Medium: ${stats.by_priority.medium || 0}`);
        console.log(`  🔵 Low: ${stats.by_priority.low || 0}`);

        if (recentTasks.length > 0) {
          console.log('\n📝 Recent Activity:');
          recentTasks.forEach((task, index) => {
            const statusEmoji = {
              'todo': '⏳',
              'in-progress': '🔄',
              'in_progress': '🔄',
              'blocked': '🚫',
              'done': '✅',
              'completed': '✅',
              'cancelled': '❌',
            };
            const updated = new Date(task.updated_at).toLocaleDateString();
            console.log(
              `  ${index + 1}. ${statusEmoji[task.status] || '⏳'} ${task.id} - ${task.name} (${updated})`
            );
          });
        }

        console.log('═'.repeat(50));
      } catch (error) {
        logger.error('Failed to get status', error);
        console.error('❌ Failed to get status:', error.message);
        process.exit(1);
      }
    });

  return status;
}
