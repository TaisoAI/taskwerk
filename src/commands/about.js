import { Command } from 'commander';
import chalk from 'chalk';

// These constants are injected during build via global variables
const packageJson = {
  version: global.__PACKAGE_VERSION__ || '0.6.6',
  description:
    global.__PACKAGE_DESCRIPTION__ ||
    'A task management CLI for developers and AI agents working together',
  name: global.__PACKAGE_NAME__ || 'taskwerk',
  author: global.__PACKAGE_AUTHOR__ || 'manu chatterjee <deftio@deftio.com>',
  license: global.__PACKAGE_LICENSE__ || 'MIT',
};

export function aboutCommand() {
  const about = new Command('about');

  about.description('Display information about Taskwerk').action(() => {
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
    console.log(
      chalk.bold(`🚀 taskwerk v${packageJson.version}`) + chalk.gray(' by Taiso.AI (www.taiso.ai)')
    );
    console.log(chalk.white('A task management CLI for developers and AI agents working together'));
    console.log('');
    console.log(chalk.bold.blue('📦 Package Information:'));
    console.log(`   ${chalk.bold('Name:')} ${packageJson.name}`);
    console.log(`   ${chalk.bold('Version:')} ${chalk.green(packageJson.version)}`);
    console.log(`   ${chalk.bold('Description:')} ${packageJson.description}`);
    console.log(`   ${chalk.bold('Author:')} ${packageJson.author}`);
    console.log(`   ${chalk.bold('License:')} ${packageJson.license}`);
    console.log('');
    console.log(chalk.bold.blue('🔗 Project Links:'));
    console.log(
      `   ${chalk.bold('GitHub Repository:')} ${chalk.cyan('https://github.com/taisoai/taskwerk')}`
    );
    console.log(
      `   ${chalk.bold('npm Package:')} ${chalk.cyan('https://www.npmjs.com/package/taskwerk')}`
    );
    console.log(
      `   ${chalk.bold('Issues & Support:')} ${chalk.cyan('https://github.com/taisoai/taskwerk/issues')}`
    );
    console.log('');
    console.log(chalk.bold.blue('🤖 AI Integration:'));
    console.log(chalk.gray('   • Supports Claude, OpenAI GPT, Mistral, Grok, and Llama models'));
    console.log(chalk.gray('   • Works with Ollama and LM Studio for local models'));
    console.log(
      chalk.yellow('   $ taskwerk ask "How do I refactor this?"') +
        chalk.gray('   # Ask AI for help')
    );
    console.log(
      chalk.yellow('   $ taskwerk agent "Update all tests"') +
        chalk.gray('        # Let AI complete tasks')
    );
    console.log('');
    console.log(chalk.bold.blue('🚀 Quick Start:'));
    console.log(
      chalk.yellow('   $ taskwerk init') +
        chalk.gray('                    # Initialize taskwerk in your project')
    );
    console.log(
      chalk.yellow('   $ taskwerk add "My first task"') + chalk.gray('     # Add a new task')
    );
    console.log(
      chalk.yellow('   $ taskwerk list') + chalk.gray('                    # View your tasks')
    );
    console.log(
      chalk.yellow('   $ taskwerk aiconfig') + chalk.gray('                # Set up AI integration')
    );
    console.log('');
    console.log(chalk.bold.blue('📚 Get Help:'));
    console.log(
      chalk.yellow('   $ taskwerk --help') + chalk.gray('                  # Show all commands')
    );
    console.log(
      chalk.yellow('   $ taskwerk <command> --help') +
        chalk.gray('        # Get help for specific command')
    );
    console.log('');
    console.log(
      chalk.bold.magenta('💡 Built with love for developers who ship great software! 🎯')
    );
  });

  return about;
}
