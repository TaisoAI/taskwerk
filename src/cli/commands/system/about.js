/**
 * About Command
 * 
 * @description Display information about Taskwerk
 * @module taskwerk/cli/commands/system/about
 */

import { Command } from 'commander';
import chalk from 'chalk';

// Try to import version info, use sentinel values if not found
let VERSION = '0.0.0-dev';
let NAME = 'taskwerk';
let DESCRIPTION = 'A git-aware task management CLI for developers and AI agents working together';

try {
  const versionModule = await import('../../../version.js');
  VERSION = versionModule.VERSION;
  NAME = versionModule.NAME;
  DESCRIPTION = versionModule.DESCRIPTION;
} catch (err) {
  console.warn(chalk.yellow('Warning: version.js not found, using fallback values'));
}

/**
 * Creates the about command
 * @returns {Command} The about command
 */
export function makeAboutCommand() {
  return new Command('about')
    .description('Display information about Taskwerk')
    .action(async () => {
      await handleAbout();
    });
}

/**
 * Handles the about command
 */
async function handleAbout() {
  try {

    // ASCII Banner
    const banner = `
████████╗ █████╗ ███████╗██╗  ██╗██╗    ██╗███████╗██████╗ ██╗  ██╗
╚══██╔══╝██╔══██╗██╔════╝██║ ██╔╝██║    ██║██╔════╝██╔══██╗██║ ██╔╝
   ██║   ███████║███████╗█████╔╝ ██║ █╗ ██║█████╗  ██████╔╝█████╔╝ 
   ██║   ██╔══██║╚════██║██╔═██╗ ██║███╗██║██╔══╝  ██╔══██╗██╔═██╗ 
   ██║   ██║  ██║███████║██║  ██╗╚███╔███╔╝███████╗██║  ██║██║  ██╗
   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝ ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝
`;

    console.log(chalk.cyan(banner));
    console.log(chalk.bold(`🚀 taskwerk v${VERSION} by Taiso.AI (www.taiso.ai)`));
    console.log(DESCRIPTION);
    console.log('');
    
    console.log(chalk.bold('📦 Package Information:'));
    console.log(`   Name: ${NAME}`);
    console.log(`   Version: ${VERSION}`);
    console.log(`   Description: ${DESCRIPTION}`);
    console.log('');
    
    console.log(chalk.bold('🔗 Project Links:'));
    console.log('   GitHub Repository: https://github.com/taisoai/taskwerk');
    console.log('   npm Package: https://www.npmjs.com/package/taskwerk');
    console.log('   Issues & Support: https://github.com/taisoai/taskwerk/issues');
    console.log('');
    
    console.log(chalk.bold('📄 License: MIT'));
    console.log('');
    
    console.log(chalk.bold('🤖 AI Integration:'));
    console.log('   • Supports OpenAI GPT models (with API key)');
    console.log('   • Supports local models via Ollama and LM Studio');
    console.log('   • Intelligent task management and automation');
    console.log('   • Human-AI collaborative workflows');
    console.log('');
    
    console.log(chalk.bold('🚀 Quick Start:'));
    console.log(chalk.gray('   $ taskwerk init                    # Initialize taskwerk in your project'));
    console.log(chalk.gray('   $ taskwerk task add "My first task" # Add a new task'));
    console.log(chalk.gray('   $ taskwerk task list               # View your tasks'));
    console.log(chalk.gray('   $ taskwerk ai config               # Set up AI integration'));
    console.log('');
    
    console.log(chalk.bold('📚 Get Help:'));
    console.log(chalk.gray('   $ taskwerk --help                  # Show all commands'));
    console.log(chalk.gray('   $ taskwerk <command> --help        # Get help for specific command'));
    console.log('');
    
    console.log(chalk.bold('💡 Built with love for developers who ship great software! 🎯'));
    
  } catch (error) {
    console.error(chalk.red('Error displaying about information:'), error.message);
    process.exit(1);
  }
}