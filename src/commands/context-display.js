import chalk from 'chalk';

/**
 * Display the active context in a clear, user-friendly way
 * @param {Object} context - The context object from ContextManager
 */
export function displayActiveContext(context) {
  // Build the display components
  const scopeIcon = context.scope === 'global' ? '🌍' : '📁';
  const typeIcon = context.type === 'agent' ? '🤖' : '💬';

  // Determine the context description
  let contextDesc = '';
  if (context.scope === 'global') {
    if (context.name === 'general') {
      contextDesc = chalk.gray('Global conversation');
    } else {
      contextDesc = chalk.cyan(context.name) + chalk.gray(' (named conversation)');
    }
  } else {
    contextDesc = chalk.blue(context.project_id) + chalk.gray(' project');
  }

  // Show the current active conversation
  console.log(chalk.gray('─'.repeat(60)));
  console.log(`${scopeIcon} ${typeIcon} Active conversation: ${contextDesc}`);

  // Show continuation hint
  if (context.turn_count > 0) {
    const turnsText = context.turn_count === 1 ? '1 message' : `${context.turn_count} messages`;
    console.log(chalk.gray(`   Continuing with ${turnsText} of history`));
  } else {
    console.log(chalk.gray('   Starting a new conversation'));
  }

  // Show context switch hint
  if (context.name !== 'general' || context.scope === 'project') {
    console.log(chalk.gray('   Use --new to start fresh, or twrk context to manage'));
  }

  console.log(chalk.gray('─'.repeat(60)));
  console.log(); // Add spacing before the actual output
}

/**
 * Get a short context indicator for inline display
 * @param {Object} context - The context object from ContextManager
 * @returns {string} A short context indicator
 */
export function getContextIndicator(context) {
  if (context.scope === 'global') {
    if (context.name === 'general') {
      return '[Global]';
    }
    return `[${context.name}]`;
  }
  return `[${context.project_id}]`;
}
