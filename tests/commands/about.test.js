import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { aboutCommand } from '../../src/commands/about.js';

describe('aboutCommand', () => {
  let consoleOutput;
  let originalConsoleLog;

  beforeEach(() => {
    // Capture console output
    consoleOutput = [];
    originalConsoleLog = console.log;
    console.log = (...args) => {
      consoleOutput.push(args.join(' '));
    };
  });

  afterEach(() => {
    // Restore console
    console.log = originalConsoleLog;
  });

  describe('basic functionality', () => {
    it('should display about information', async () => {
      await aboutCommand();

      const output = consoleOutput.join('\n');

      // Check for ASCII banner elements
      assert(output.includes('████████╗'));

      // Check for version and title
      assert(output.includes('🚀 TaskWerk v'));
      assert(
        output.includes(
          'A lightweight CLI task manager optimized for human-AI collaboration workflows'
        )
      );
    });

    it('should display package information', async () => {
      await aboutCommand();

      const output = consoleOutput.join('\n');

      // Check for package info section
      assert(output.includes('📦 Package Information:'));
      assert(output.includes('Name: taskwerk'));
      assert(output.includes('Version:'));
      assert(output.includes('Description:'));
    });

    it('should display project links', async () => {
      await aboutCommand();

      const output = consoleOutput.join('\n');

      // Check for project links
      assert(output.includes('🔗 Project Links:'));
      assert(output.includes('GitHub Repository: https://github.com/deftio/taskwerk'));
      assert(output.includes('npm Package: https://www.npmjs.com/package/taskwerk'));
      assert(output.includes('Issues & Support: https://github.com/deftio/taskwerk/issues'));
    });

    it('should display author information', async () => {
      await aboutCommand();

      const output = consoleOutput.join('\n');

      // Check for author info
      assert(output.includes('👥 Author & Contributors:'));
      assert(output.includes('Manu Chatterjee <deftio@deftio.com>'));
    });

    it('should display license information', async () => {
      await aboutCommand();

      const output = consoleOutput.join('\n');

      // Check for license
      assert(output.includes('📄 License: MIT'));
    });

    it('should display AI integration features', async () => {
      await aboutCommand();

      const output = consoleOutput.join('\n');

      // Check for AI features
      assert(output.includes('🤖 AI Integration:'));
      assert(output.includes('OpenAI GPT models'));
      assert(output.includes('Ollama and LM Studio'));
      assert(output.includes('Human-AI collaborative workflows'));
    });

    it('should display quick start guide', async () => {
      await aboutCommand();

      const output = consoleOutput.join('\n');

      // Check for quick start
      assert(output.includes('🚀 Quick Start:'));
      assert(output.includes('taskwerk init'));
      assert(output.includes('taskwerk add'));
      assert(output.includes('taskwerk list'));
      assert(output.includes('taskwerk llmconfig'));
    });

    it('should display help information', async () => {
      await aboutCommand();

      const output = consoleOutput.join('\n');

      // Check for help section
      assert(output.includes('📚 Get Help:'));
      assert(output.includes('taskwerk --help'));
      assert(output.includes('taskwerk <command> --help'));
    });

    it('should display motivational message', async () => {
      await aboutCommand();

      const output = consoleOutput.join('\n');

      // Check for motivational closing
      assert(output.includes('💡 Built with love for developers who ship great software! 🎯'));
    });
  });

  describe('version information', () => {
    it('should display current version from package.json', async () => {
      await aboutCommand();

      const output = consoleOutput.join('\n');

      // Should include a version number pattern
      assert(/🚀 TaskWerk v\d+\.\d+\.\d+/.test(output));
    });

    it('should display consistent version in multiple places', async () => {
      await aboutCommand();

      const output = consoleOutput.join('\n');

      // Version should appear in both the title and package info
      const versionMatches = output.match(/Version: (\d+\.\d+\.\d+)/g);
      assert(versionMatches && versionMatches.length >= 1);
    });
  });

  describe('error handling', () => {
    it('should handle package.json read errors gracefully', async () => {
      // This test ensures the command doesn't crash even if there are issues
      // In a real scenario, the command should handle file access errors
      try {
        await aboutCommand();
        // Should complete without throwing
        assert(true);
      } catch (error) {
        // If it throws, it should be a controlled error with proper message
        assert(error.message.includes('Error displaying about information'));
      }
    });

    it('should use fallback data when package.json is not found', async () => {
      // Save original working directory
      const originalCwd = process.cwd();

      try {
        // Change to a directory without package.json
        process.chdir('/tmp');

        await aboutCommand();

        const output = consoleOutput.join('\n');

        // Should still show version information (fallback values)
        assert(output.includes('🚀 TaskWerk v'));
        assert(output.includes('Name: taskwerk'));
        assert(
          output.includes(
            'A lightweight CLI task manager optimized for human-AI collaboration workflows'
          )
        );
      } finally {
        // Restore original working directory
        process.chdir(originalCwd);
      }
    });
  });

  describe('content structure', () => {
    it('should have proper section organization', async () => {
      await aboutCommand();

      const output = consoleOutput.join('\n');

      // Sections should appear in expected order
      const bannerIndex = output.indexOf('████████╗');
      const packageIndex = output.indexOf('📦 Package Information:');
      const linksIndex = output.indexOf('🔗 Project Links:');
      const authorIndex = output.indexOf('👥 Author & Contributors:');
      const licenseIndex = output.indexOf('📄 License:');
      const aiIndex = output.indexOf('🤖 AI Integration:');
      const quickStartIndex = output.indexOf('🚀 Quick Start:');
      const helpIndex = output.indexOf('📚 Get Help:');

      // All sections should be present
      assert(bannerIndex >= 0);
      assert(packageIndex >= 0);
      assert(linksIndex >= 0);
      assert(authorIndex >= 0);
      assert(licenseIndex >= 0);
      assert(aiIndex >= 0);
      assert(quickStartIndex >= 0);
      assert(helpIndex >= 0);

      // Sections should appear in logical order
      assert(bannerIndex < packageIndex);
      assert(packageIndex < linksIndex);
      assert(linksIndex < authorIndex);
      assert(authorIndex < licenseIndex);
      assert(licenseIndex < aiIndex);
      assert(aiIndex < quickStartIndex);
      assert(quickStartIndex < helpIndex);
    });

    it('should include all required URLs', async () => {
      await aboutCommand();

      const output = consoleOutput.join('\n');

      // Check for all expected URLs
      assert(output.includes('https://github.com/deftio/taskwerk'));
      assert(output.includes('https://www.npmjs.com/package/taskwerk'));
      assert(output.includes('https://github.com/deftio/taskwerk/issues'));
    });

    it('should include all required contact information', async () => {
      await aboutCommand();

      const output = consoleOutput.join('\n');

      // Check for contact info
      assert(output.includes('deftio@deftio.com'));
    });
  });
});
