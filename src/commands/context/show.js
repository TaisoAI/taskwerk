import { Command } from 'commander';
import { ContextManager } from '../../chat/context-manager.js';
import { TaskwerkDatabase } from '../../db/database.js';
import chalk from 'chalk';
// Simple date formatting without external dependencies

export function showContextCommand() {
  const show = new Command('show');

  show
    .description('Show conversation history')
    .argument('[context-id]', 'Context ID or name (defaults to current)')
    .option('-n, --limit <number>', 'Number of messages to show', '20')
    .option('--all', 'Show entire conversation history')
    .action(async (contextId, options) => {
      let db;
      let contextManager;
      let context;

      try {
        // If no context ID provided, show current context
        if (!contextId) {
          // Determine which database to use
          try {
            db = new TaskwerkDatabase();
            await db.connect();
            contextManager = new ContextManager(db.getDB());
          } catch (error) {
            // Fall back to global database
            db = new TaskwerkDatabase({ isGlobal: true });
            await db.connect();
            contextManager = new ContextManager(db.getDB());
          }

          // Get current context
          const contextOptions = {
            forceNew: false,
            firstPrompt: 'Viewing history',
          };

          context = await contextManager.getOrCreateContext('ask', contextOptions);
        } else {
          // Search for context by ID or name in both databases
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
        }

        // Display context header
        console.log(chalk.bold('\n🗨️  Conversation Details\n'));

        const typeIcon = context.type === 'agent' ? '🤖' : '💬';
        const scopeIcon = context.scope === 'global' ? '🌍' : '📁';

        console.log(`${scopeIcon} ${typeIcon} ${chalk.bold(context.name)}`);
        console.log(chalk.gray(`ID: ${context.id}`));

        if (context.project_id !== 'GLOBAL') {
          console.log(chalk.gray(`Project: ${context.project_id}`));
        }

        console.log(chalk.gray(`Created: ${new Date(context.created_at).toLocaleString()}`));
        console.log(chalk.gray(`Last active: ${new Date(context.last_active).toLocaleString()}`));
        console.log(chalk.gray(`Messages: ${context.turn_count || 0}`));

        console.log(chalk.gray('\n' + '─'.repeat(60) + '\n'));

        // Get conversation history
        const limit = options.all ? null : parseInt(options.limit);
        const history = await contextManager.getHistory(context.id, limit);

        if (history.length === 0) {
          console.log(chalk.gray('No messages in this conversation yet.\n'));
        } else {
          // Display messages
          history.forEach((turn, index) => {
            // Add spacing between messages
            if (index > 0) {
              console.log();
            }

            const timestamp = new Date(turn.created_at).toLocaleTimeString('en-US', {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });

            if (turn.role === 'user') {
              console.log(chalk.blue.bold(`👤 You [${timestamp}]`));
              console.log(wrapText(turn.content, 80));
            } else {
              console.log(chalk.green.bold(`🤖 Assistant [${timestamp}]`));
              console.log(wrapText(turn.content, 80));
            }

            // Show metadata if present
            if (turn.metadata) {
              const meta = JSON.parse(turn.metadata);
              if (meta.toolCalls && meta.toolCalls.length > 0) {
                console.log(
                  chalk.gray(`   🔧 Used tools: ${meta.toolCalls.map(t => t.name).join(', ')}`)
                );
              }
            }
          });

          if (!options.all && history.length >= limit) {
            console.log(
              chalk.gray(`\n... showing last ${limit} messages. Use --all to see entire history.`)
            );
          }
        }

        // Show how to continue this conversation
        console.log(chalk.gray('\n' + '─'.repeat(60)));
        console.log('\n💡 To continue this conversation:');

        if (context.id === contextManager.currentContextId) {
          console.log("   You're already in this conversation! Just use:");
          console.log(`   twrk ${context.type} "your message"`);
        } else if (context.name !== 'general' && context.scope === 'global') {
          console.log(`   twrk ${context.type} --context ${context.name} "your message"`);
        } else if (context.scope === 'project') {
          console.log(`   Navigate to the project directory and use:`);
          console.log(`   twrk ${context.type} "your message"`);
        } else {
          console.log(`   twrk ${context.type} "your message"`);
        }

        if (db) {
          db.close();
        }
      } catch (error) {
        console.error('❌ Failed to show conversation:', error.message);
        if (db) {
          db.close();
        }
        process.exit(1);
      }
    });

  return show;
}

function wrapText(text, width) {
  // Simple text wrapping for better display
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  words.forEach(word => {
    if (currentLine.length + word.length + 1 > width) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        // Word is longer than width
        lines.push(word);
      }
    } else {
      currentLine = currentLine ? `${currentLine} ${word}` : word;
    }
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.join('\n');
}
