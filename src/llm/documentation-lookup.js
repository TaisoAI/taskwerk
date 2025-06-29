import { spawn } from 'child_process';

/**
 * Documentation lookup system for taskwerk LLM integration
 * Provides dynamic access to help information and command details
 */
export class DocumentationLookup {
  constructor() {
    this.commandHelp = new Map();
    this.initialized = false;
  }

  /**
   * Get help text for a specific command
   */
  async getCommandHelp(command) {
    try {
      const help = await this.executeCommand(['./bin/taskwerk.js', command, '--help']);
      return {
        command,
        help: help.trim(),
        success: true,
      };
    } catch (error) {
      return {
        command,
        error: error.message,
        success: false,
      };
    }
  }

  /**
   * Get the main program help
   */
  async getMainHelp() {
    try {
      const help = await this.executeCommand(['./bin/taskwerk.js', '--help']);
      return {
        help: help.trim(),
        success: true,
      };
    } catch (error) {
      return {
        error: error.message,
        success: false,
      };
    }
  }

  /**
   * Get all available commands from the CLI
   */
  async getAvailableCommands() {
    try {
      const help = await this.getMainHelp();
      if (!help.success) {
        return [];
      }

      // Parse commands from help output
      const lines = help.help.split('\n');
      const commandSection = lines.findIndex(line => line.includes('Commands:'));
      if (commandSection === -1) {
        return [];
      }

      const commands = [];
      for (let i = commandSection + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('help [command]')) {
          break;
        }

        const match = line.match(/^(\w+)/);
        if (match) {
          commands.push(match[1]);
        }
      }

      return commands;
    } catch (error) {
      return [];
    }
  }

  /**
   * Search for information about a specific topic
   */
  async searchDocumentation(query) {
    const results = [];

    // Check if query matches a command name
    const commands = await this.getAvailableCommands();
    const matchingCommands = commands.filter(
      cmd =>
        cmd.toLowerCase().includes(query.toLowerCase()) ||
        query.toLowerCase().includes(cmd.toLowerCase())
    );

    // Get help for matching commands
    for (const cmd of matchingCommands) {
      const help = await this.getCommandHelp(cmd);
      if (help.success) {
        results.push({
          type: 'command_help',
          command: cmd,
          content: help.help,
        });
      }
    }

    // If no command matches, get main help
    if (results.length === 0) {
      const mainHelp = await this.getMainHelp();
      if (mainHelp.success) {
        results.push({
          type: 'main_help',
          content: mainHelp.help,
        });
      }
    }

    return {
      query,
      results,
      success: results.length > 0,
    };
  }

  /**
   * Get information about taskwerk's current configuration
   */
  async getConfigInfo() {
    try {
      const status = await this.executeCommand(['./bin/taskwerk.js', 'status']);
      const llmConfig = await this.executeCommand(['./bin/taskwerk.js', 'llmconfig']);

      return {
        status: status.trim(),
        llmConfig: llmConfig.trim(),
        success: true,
      };
    } catch (error) {
      return {
        error: error.message,
        success: false,
      };
    }
  }

  /**
   * Execute a command and return its output
   */
  async executeCommand(args) {
    return new Promise((resolve, reject) => {
      const process = spawn(args[0], args.slice(1), {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd(),
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', data => {
        stdout += data.toString();
      });

      process.stderr.on('data', data => {
        stderr += data.toString();
      });

      process.on('close', code => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(stderr || `Command failed with code ${code}`));
        }
      });

      process.on('error', error => {
        reject(error);
      });
    });
  }

  /**
   * Get comprehensive help for a topic or command
   */
  async getHelp(topic) {
    if (!topic) {
      return this.getMainHelp();
    }

    // First try as a direct command
    const commandHelp = await this.getCommandHelp(topic);
    if (commandHelp.success) {
      return commandHelp;
    }

    // Then search documentation
    return this.searchDocumentation(topic);
  }
}
