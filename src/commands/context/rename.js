import { Command } from 'commander';
import { ContextManager } from '../../chat/context-manager.js';
import { TaskwerkDatabase } from '../../db/database.js';
import chalk from 'chalk';

export function renameContextCommand() {
  const rename = new Command('rename');

  rename
    .description('Rename a conversation')
    .argument('<context-id>', 'Context ID or current name')
    .argument('<new-name>', 'New name for the conversation')
    .action(async (contextId, newName) => {
      let db;
      let contextManager;
      let context;

      try {
        // Validate new name
        if (!newName || newName.trim().length === 0) {
          console.error('❌ New name cannot be empty');
          process.exit(1);
        }

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

        // Check if new name already exists in the same scope
        const existingContexts = await contextManager.listContexts();
        const duplicate = existingContexts.find(
          c => c.name === newName && c.id !== context.id && c.project_id === context.project_id
        );

        if (duplicate) {
          console.error(`❌ A conversation named "${newName}" already exists in this scope`);
          process.exit(1);
        }

        // Show what will be renamed
        console.log(chalk.bold('\n✏️  Rename Conversation\n'));

        const typeIcon = context.type === 'agent' ? '🤖' : '💬';
        const scopeIcon = context.scope === 'global' ? '🌍' : '📁';

        console.log(
          `${scopeIcon} ${typeIcon} ${chalk.bold(context.name)} → ${chalk.green.bold(newName)}`
        );
        console.log(chalk.gray(`ID: ${context.id}`));

        // Rename the context
        await contextManager.renameContext(context.id, newName);

        console.log(chalk.green('\n✅ Conversation renamed successfully.'));

        // Show how to use the renamed context
        if (context.scope === 'global' && newName !== 'general') {
          console.log(chalk.gray('\n💡 To use this conversation:'));
          console.log(`   twrk ${context.type} --context ${newName} "your message"`);
        }

        if (db) {
          db.close();
        }
      } catch (error) {
        console.error('❌ Failed to rename conversation:', error.message);
        if (db) {
          db.close();
        }
        process.exit(1);
      }
    });

  return rename;
}
