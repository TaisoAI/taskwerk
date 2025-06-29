import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function aboutCommand() {
  try {
    // Get version from package.json - try multiple paths for bundled vs unbundled
    let packageData = null;
    const possiblePaths = [
      join(__dirname, '../../package.json'), // Development/unbundled
      join(process.cwd(), 'package.json'), // Current working directory
      './package.json', // Relative to CWD
    ];

    for (const packagePath of possiblePaths) {
      try {
        packageData = JSON.parse(await fs.readFile(packagePath, 'utf8'));
        break;
      } catch (error) {
        // Continue trying other paths
      }
    }

    // Fallback to hardcoded values if package.json not found
    if (!packageData) {
      packageData = {
        name: 'taskwerk',
        version: '0.1.3',
        description:
          'A lightweight CLI task manager optimized for human-AI collaboration workflows',
      };
    }

    const version = packageData.version;

    // ASCII Banner
    const banner = `
████████╗ █████╗ ███████╗██╗  ██╗██╗    ██╗███████╗██████╗ ██╗  ██╗
╚══██╔══╝██╔══██╗██╔════╝██║ ██╔╝██║    ██║██╔════╝██╔══██╗██║ ██╔╝
   ██║   ███████║███████╗█████╔╝ ██║ █╗ ██║█████╗  ██████╔╝█████╔╝ 
   ██║   ██╔══██║╚════██║██╔═██╗ ██║███╗██║██╔══╝  ██╔══██╗██╔═██╗ 
   ██║   ██║  ██║███████║██║  ██╗╚███╔███╔╝███████╗██║  ██║██║  ██╗
   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝ ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝
`;

    console.log(banner);
    console.log(`🚀 TaskWerk v${version}`);
    console.log('A lightweight CLI task manager optimized for human-AI collaboration workflows');
    console.log('');
    console.log('📦 Package Information:');
    console.log(`   Name: ${packageData.name}`);
    console.log(`   Version: ${packageData.version}`);
    console.log(`   Description: ${packageData.description}`);
    console.log('');
    console.log('🔗 Project Links:');
    console.log('   GitHub Repository: https://github.com/deftio/taskwerk');
    console.log('   npm Package: https://www.npmjs.com/package/taskwerk');
    console.log('   Issues & Support: https://github.com/deftio/taskwerk/issues');
    console.log('');
    console.log('👥 Author & Contributors:');
    console.log('   Manu Chatterjee <deftio@deftio.com>');
    console.log('');
    console.log('📄 License: MIT');
    console.log('');
    console.log('🤖 AI Integration:');
    console.log('   • Supports OpenAI GPT models (with API key)');
    console.log('   • Supports local models via Ollama and LM Studio');
    console.log('   • Intelligent task management and automation');
    console.log('   • Human-AI collaborative workflows');
    console.log('');
    console.log('🚀 Quick Start:');
    console.log('   $ taskwerk init                    # Initialize TaskWerk in your project');
    console.log('   $ taskwerk add "My first task"     # Add a new task');
    console.log('   $ taskwerk list                    # View your tasks');
    console.log('   $ taskwerk llmconfig               # Set up AI integration');
    console.log('');
    console.log('📚 Get Help:');
    console.log('   $ taskwerk --help                 # Show all commands');
    console.log('   $ taskwerk <command> --help       # Get help for specific command');
    console.log('');
    console.log('💡 Built with love for developers who ship great software! 🎯');
  } catch (error) {
    console.error('Error displaying about information:', error.message);
    process.exit(1);
  }
}
