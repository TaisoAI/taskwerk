import { Command } from 'commander';
import { ContextManager } from '../../chat/context-manager.js';
import { TaskwerkDatabase } from '../../db/database.js';
import chalk from 'chalk';
// Simple date formatting without external dependencies

export function listContextsCommand() {
  const list = new Command('list');

  list
    .description('List all chat conversations')
    .option('-g, --global', 'Show only global conversations')
    .option('-p, --project', 'Show only project conversations')
    .option('-t, --type <type>', 'Filter by type (ask/agent)')
    .option('--all', 'Include inactive conversations')
    .action(async options => {
      try {
        // Try both project and global databases
        const databases = [];

        // Try project database
        try {
          const projectDb = new TaskwerkDatabase();
          await projectDb.connect();
          databases.push({ db: projectDb, scope: 'project' });
        } catch (e) {
          // No project database
        }

        // Always check global database
        const globalDb = new TaskwerkDatabase({ isGlobal: true });
        await globalDb.connect();
        databases.push({ db: globalDb, scope: 'global' });

        console.log(chalk.bold('🗨️  Your Chat Conversations\n'));

        let allContexts = [];
        let currentProjectId = null;

        // Collect contexts from all databases
        for (const { db, scope } of databases) {
          const contextManager = new ContextManager(db.getDB());

          // Get project ID if in project
          if (scope === 'project') {
            const result = await contextManager.detectProject();
            if (result.isProject) {
              currentProjectId = result.projectId;
            }
          }

          // Get contexts based on filters
          let contexts;
          if (options.global && scope === 'project') {
            continue;
          }
          if (options.project && scope === 'global') {
            continue;
          }

          if (options.global) {
            contexts = await contextManager.listContexts('global');
          } else if (options.project) {
            contexts = await contextManager.listContexts('project');
          } else {
            contexts = await contextManager.listContexts();
          }

          // Add scope info to each context
          contexts.forEach(ctx => {
            ctx._dbScope = scope;
            ctx._isCurrentProject = scope === 'project' && ctx.project_id === currentProjectId;
          });

          allContexts = allContexts.concat(contexts);
        }

        // Filter by type if specified
        if (options.type) {
          allContexts = allContexts.filter(ctx => ctx.type === options.type);
        }

        // Filter out inactive unless --all
        if (!options.all) {
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
          allContexts = allContexts.filter(
            ctx => new Date(ctx.last_active) > oneWeekAgo || ctx.turn_count > 5
          );
        }

        if (allContexts.length === 0) {
          console.log(chalk.gray('No conversations found.\n'));
          console.log('💡 Start a conversation with:');
          console.log('   twrk ask "your question"');
          console.log('   twrk agent "your task"');
          return;
        }

        // Group by scope
        const grouped = {
          currentProject: [],
          otherProject: [],
          global: [],
        };

        allContexts.forEach(ctx => {
          if (ctx._isCurrentProject) {
            grouped.currentProject.push(ctx);
          } else if (ctx.scope === 'project') {
            grouped.otherProject.push(ctx);
          } else {
            grouped.global.push(ctx);
          }
        });

        // Display current project contexts
        if (grouped.currentProject.length > 0) {
          console.log(chalk.blue.bold(`📁 Current Project (${currentProjectId})`));
          displayContextList(grouped.currentProject);
          console.log();
        }

        // Display global contexts
        if (grouped.global.length > 0) {
          console.log(chalk.green.bold('🌍 Global Conversations'));
          displayContextList(grouped.global);
          console.log();
        }

        // Display other project contexts
        if (grouped.otherProject.length > 0) {
          console.log(chalk.gray.bold('📁 Other Projects'));
          displayContextList(grouped.otherProject);
          console.log();
        }

        // Show helpful tips
        console.log(chalk.gray('─'.repeat(60)));
        console.log('💡 Tips:');
        console.log('   • Use "twrk context show <id>" to view conversation history');
        console.log('   • Use "twrk context switch <name>" to switch conversations');
        console.log('   • Add --all to see all conversations including old ones');

        // Close databases
        for (const { db } of databases) {
          db.close();
        }
      } catch (error) {
        console.error('❌ Failed to list conversations:', error.message);
        process.exit(1);
      }
    });

  return list;
}

function displayContextList(contexts) {
  // Sort by last active
  contexts.sort((a, b) => new Date(b.last_active) - new Date(a.last_active));

  contexts.forEach(ctx => {
    const isActive = isRecentlyActive(ctx);
    const typeIcon = ctx.type === 'agent' ? '🤖' : '💬';
    const statusIcon = isActive ? '🟢' : '⚪';

    // Format the display
    const idDisplay = chalk.gray(`[${ctx.id}]`);
    const nameDisplay = ctx.name === 'general' ? chalk.bold(ctx.name) : chalk.cyan(ctx.name);
    const projectDisplay = ctx.project_id !== 'GLOBAL' ? chalk.gray(` (${ctx.project_id})`) : '';

    console.log(`  ${statusIcon} ${typeIcon} ${nameDisplay}${projectDisplay} ${idDisplay}`);

    // Show metadata
    const lastActive = getRelativeTime(new Date(ctx.last_active));
    const turns = ctx.turn_count || 0;
    const turnsText = turns === 1 ? '1 message' : `${turns} messages`;

    console.log(chalk.gray(`     Last active: ${lastActive} • ${turnsText}`));

    // Show first prompt preview if available
    if (ctx.first_prompt) {
      const preview =
        ctx.first_prompt.length > 50 ? ctx.first_prompt.substring(0, 50) + '...' : ctx.first_prompt;
      console.log(chalk.gray(`     Started with: "${preview}"`));
    }

    console.log();
  });
}

function isRecentlyActive(context) {
  const hourAgo = new Date();
  hourAgo.setHours(hourAgo.getHours() - 1);
  return new Date(context.last_active) > hourAgo;
}

function getRelativeTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return 'just now';
  }
  if (diffMins < 60) {
    return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  }
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  }
  if (diffDays < 30) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  }

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`;
  }

  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears} year${diffYears === 1 ? '' : 's'} ago`;
}
