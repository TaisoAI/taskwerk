import { Command } from 'commander';
import { ContextManager } from '../../chat/context-manager.js';
import { TaskwerkDatabase } from '../../db/database.js';
import chalk from 'chalk';

export function switchContextCommand() {
  const switchCmd = new Command('switch');

  switchCmd
    .description('Switch to a different conversation')
    .argument('<context-name>', 'Name of the conversation to switch to')
    .option('--new', "Create a new conversation if it doesn't exist")
    .action(async (contextName, options) => {
      let db;
      let contextManager;

      try {
        // Determine current location
        let isProject = false;
        let projectId = null;

        try {
          db = new TaskwerkDatabase();
          await db.connect();
          contextManager = new ContextManager(db.getDB());
          const result = await contextManager.detectProject();
          isProject = result.isProject;
          projectId = result.projectId;
        } catch (error) {
          // Not in a project, use global
          db = new TaskwerkDatabase({ isGlobal: true });
          await db.connect();
          contextManager = new ContextManager(db.getDB());
        }

        // Search for existing context
        let context = null;

        if (isProject) {
          // In a project - look for project context with this name
          const contexts = await contextManager.listContexts('project');
          context = contexts.find(c => c.name === contextName && c.project_id === projectId);
        } else {
          // Not in a project - look for global context
          const contexts = await contextManager.listContexts('global');
          context = contexts.find(c => c.name === contextName);
        }

        if (!context && !options.new) {
          console.error(`❌ Conversation "${contextName}" not found`);
          console.error('\n💡 Use --new to create a new conversation');
          console.error('   Or use "twrk context list" to see existing conversations');
          process.exit(1);
        }

        // Display the switch
        console.log(chalk.bold('\n🔄 Switching Conversation\n'));

        if (context) {
          // Switching to existing
          const typeIcon = context.type === 'agent' ? '🤖' : '💬';
          const scopeIcon = context.scope === 'global' ? '🌍' : '📁';

          console.log(`Switched to: ${scopeIcon} ${typeIcon} ${chalk.green.bold(context.name)}`);
          console.log(chalk.gray(`Messages: ${context.turn_count || 0}`));
        } else {
          // Creating new
          const scopeIcon = isProject ? '📁' : '🌍';
          console.log(`Creating new: ${scopeIcon} ${chalk.green.bold(contextName)}`);
        }

        // Show how to use it
        console.log(chalk.gray('\n💡 Now you can use:'));

        if (isProject) {
          console.log(`   twrk ask --context ${contextName} "your question"`);
          console.log(`   twrk agent --context ${contextName} "your task"`);
        } else {
          console.log(`   twrk ask --context ${contextName} "your question"`);
          console.log(`   twrk agent --context ${contextName} "your task"`);
        }

        if (db) {
          db.close();
        }
      } catch (error) {
        console.error('❌ Failed to switch conversation:', error.message);
        if (db) {
          db.close();
        }
        process.exit(1);
      }
    });

  return switchCmd;
}
