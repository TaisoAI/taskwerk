import { Command } from 'commander';
import { ContextManager } from '../../chat/context-manager.js';
import { TaskwerkDatabase } from '../../db/database.js';
import chalk from 'chalk';
import inquirer from 'inquirer';

export function deleteContextCommand() {
  const deleteCmd = new Command('delete');

  deleteCmd
    .description('Delete a conversation')
    .argument('<context-id>', 'Context ID or name to delete')
    .option('-f, --force', 'Skip confirmation prompt')
    .action(async (contextId, options) => {
      let db;
      let contextManager;
      let context;

      try {
        // Search for context in both databases
        const databases = [];

        // Try project database
        try {
          const projectDb = new TaskwerkDatabase();
          await projectDb.connect();
          databases.push(projectDb);
        } catch (e) {
          // No project database
        }

        // Always check global database
        const globalDb = new TaskwerkDatabase({ isGlobal: true });
        await globalDb.connect();
        databases.push(globalDb);

        // Search for context
        for (const database of databases) {
          const cm = new ContextManager(database.getDB());

          // Try by ID first
          const ctx = await cm.getContext(contextId);
          if (ctx) {
            context = ctx;
            contextManager = cm;
            db = database;
            break;
          }

          // Try by name
          const contexts = await cm.listContexts();
          const byName = contexts.find(c => c.name === contextId);
          if (byName) {
            context = byName;
            contextManager = cm;
            db = database;
            break;
          }
        }

        // Clean up unused databases
        for (const database of databases) {
          if (database !== db) {
            database.close();
          }
        }

        if (!context) {
          console.error(`❌ Conversation not found: ${contextId}`);
          console.error('\n💡 Use "twrk context list" to see all conversations');
          process.exit(1);
        }

        // Show what will be deleted
        console.log(chalk.bold('\n🗑️  Delete Conversation\n'));

        const typeIcon = context.type === 'agent' ? '🤖' : '💬';
        const scopeIcon = context.scope === 'global' ? '🌍' : '📁';

        console.log(`${scopeIcon} ${typeIcon} ${chalk.bold(context.name)}`);
        console.log(chalk.gray(`ID: ${context.id}`));
        console.log(chalk.gray(`Messages: ${context.turn_count || 0}`));

        if (context.project_id !== 'GLOBAL') {
          console.log(chalk.gray(`Project: ${context.project_id}`));
        }

        // Warn about current context
        const currentContext = await contextManager.getCurrentContext();
        if (currentContext && currentContext.id === context.id) {
          console.log(chalk.yellow('\n⚠️  This is your current active conversation!'));
        }

        // Confirm deletion
        if (!options.force) {
          console.log();
          const { confirm } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: 'Are you sure you want to delete this conversation?',
              default: false,
            },
          ]);

          if (!confirm) {
            console.log(chalk.gray('\nDeletion cancelled.'));
            process.exit(0);
          }
        }

        // Delete the context
        await contextManager.deleteContext(context.id);

        console.log(chalk.green('\n✅ Conversation deleted successfully.'));

        if (db) {
          db.close();
        }
      } catch (error) {
        console.error('❌ Failed to delete conversation:', error.message);
        if (db) {
          db.close();
        }
        process.exit(1);
      }
    });

  return deleteCmd;
}
