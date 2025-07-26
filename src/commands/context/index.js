import { Command } from 'commander';
import { listContextsCommand } from './list.js';
import { showContextCommand } from './show.js';
import { renameContextCommand } from './rename.js';
import { deleteContextCommand } from './delete.js';
import { switchContextCommand } from './switch.js';

export function contextCommand() {
  const context = new Command('context');

  context.description('Manage chat conversations').addHelpText(
    'after',
    `
Chat conversations (contexts) store your interaction history with the AI assistant.

Types of conversations:
  • Project conversations - Specific to a project directory
  • Global conversations - Available from anywhere
  • Named conversations - Custom named conversations (e.g., "work", "personal")

Current conversation indicators:
  [Project: name] - You're in a project-specific conversation
  [Global: general] - You're in the default global conversation
  [Global: name] - You're in a named global conversation

Examples:
  $ twrk context list              # List all your conversations
  $ twrk context show              # Show current conversation history
  $ twrk context switch work       # Switch to "work" conversation
  $ twrk context delete old-chat   # Delete a conversation`
  );

  // Add subcommands
  context.addCommand(listContextsCommand());
  context.addCommand(showContextCommand());
  context.addCommand(renameContextCommand());
  context.addCommand(deleteContextCommand());
  context.addCommand(switchContextCommand());

  return context;
}
