/**
 * TaskWerk v3 Base Command Class
 *
 * Provides the foundation for all CLI commands with consistent patterns,
 * validation, error handling, and output formatting.
 */

import { TaskWerkAPI } from '../api/index.js';
import { TaskAPI } from '../api/task-api.js';
import { RelationshipAPI } from '../api/relationship-api.js';
import { NotesAPI } from '../api/notes-api.js';
// import { formatTask, formatTaskList } from '../utils/formatting.js';
import { loadConfig } from '../utils/config.js';
import chalk from 'chalk';
import { TaskWerkError, errorHandler } from './error-handler.js';

/**
 * Base command class that all commands extend
 */
export class BaseCommand {
  constructor(name, description) {
    this.name = name;
    this.description = description;
    this.options = [];
    this.arguments = [];
    this.config = null;
    this.apis = null;

    // Add default help option
    this.option('-h, --help', 'Display help');
  }

  /**
   * Define a command option
   */
  option(flags, description, defaultValue = undefined) {
    const option = {
      flags,
      description,
      defaultValue,
      required: false,
    };

    // Parse flags to extract short and long forms
    const parts = flags.split(/,?\s+/);
    option.short = parts.find(p => p.startsWith('-') && !p.startsWith('--'))?.replace('-', '');
    option.long = parts
      .find(p => p.startsWith('--'))
      ?.replace('--', '')
      .split(/\s+/)[0];

    // Check if option expects a value
    option.hasValue = flags.includes('<') || flags.includes('[');

    this.options.push(option);
    return this;
  }

  /**
   * Define a required option
   */
  requiredOption(flags, description) {
    this.option(flags, description);
    const option = this.options[this.options.length - 1];
    option.required = true;
    return this;
  }

  /**
   * Define a command argument
   */
  argument(name, description, options = {}) {
    this.arguments.push({
      name,
      description,
      required: options.variadic ? false : !options.optional,
      variadic: options.variadic || false,
      defaultValue: options.defaultValue,
    });
    return this;
  }

  /**
   * Parse command line arguments
   */
  parseArgs(args) {
    const parsed = {
      options: {},
      args: [],
    };

    let i = 0;
    while (i < args.length) {
      const arg = args[i];

      // Check if it's an option
      if (arg.startsWith('-')) {
        const isShort = !arg.startsWith('--');
        const optionName = isShort ? arg.substring(1) : arg.substring(2);

        // Find matching option definition
        const optionDef = this.options.find(
          opt => (isShort && opt.short === optionName) || (!isShort && opt.long === optionName)
        );

        if (!optionDef) {
          throw new TaskWerkError('INVALID_ARGUMENTS', {
            message: `Unknown option: ${arg}`,
            suggestion: `Use "taskwerk ${this.name} --help" to see available options`,
          });
        }

        const key = optionDef.long || optionDef.short;

        if (optionDef.hasValue) {
          // Option expects a value
          if (i + 1 >= args.length) {
            throw new TaskWerkError('INVALID_ARGUMENTS', {
              message: `Option ${arg} requires a value`,
              suggestion: `Provide a value after ${arg}`,
            });
          }
          parsed.options[key] = args[++i];
        } else {
          // Boolean flag
          parsed.options[key] = true;
        }
      } else {
        // Regular argument
        parsed.args.push(arg);
      }
      i++;
    }

    // Apply defaults
    for (const opt of this.options) {
      const key = opt.long || opt.short;
      if (!(key in parsed.options) && opt.defaultValue !== undefined) {
        parsed.options[key] = opt.defaultValue;
      }
    }

    // Validate required options
    for (const opt of this.options) {
      const key = opt.long || opt.short;
      if (opt.required && !(key in parsed.options)) {
        throw new TaskWerkError('MISSING_REQUIRED_ARG', {
          message: `Required option --${opt.long || '-' + opt.short} is missing`,
          option: opt.long || opt.short,
        });
      }
    }

    // Validate arguments
    let argIndex = 0;
    for (const argDef of this.arguments) {
      if (argDef.variadic) {
        // Variadic argument consumes all remaining args
        if (argDef.required && argIndex >= parsed.args.length) {
          throw new TaskWerkError('MISSING_REQUIRED_ARG', {
            message: `Argument <${argDef.name}> is required`,
            argument: argDef.name,
          });
        }
        break;
      }

      if (argDef.required && argIndex >= parsed.args.length) {
        throw new TaskWerkError('MISSING_REQUIRED_ARG', {
          message: `Argument <${argDef.name}> is required`,
          argument: argDef.name,
        });
      }

      argIndex++;
    }

    return parsed;
  }

  /**
   * Initialize command with config and APIs
   */
  async initialize() {
    // Load configuration
    this.config = await loadConfig();

    // Initialize main API
    const dbPath = this.config.databasePath || '.taskwerk.db';
    this.mainApi = new TaskWerkAPI(dbPath);
    await this.mainApi.initialize();

    // Initialize individual APIs
    this.apis = {
      task: new TaskAPI(dbPath),
      relationship: new RelationshipAPI(dbPath),
      notes: new NotesAPI(dbPath),
    };

    // Initialize individual APIs
    await this.apis.task.initialize();
    await this.apis.relationship.initialize();
    await this.apis.notes.initialize();
  }

  /**
   * Execute the command (to be implemented by subclasses)
   */
  async execute(_args, _options) {
    throw new TaskWerkError('COMMAND_NOT_FOUND', {
      message: `Command ${this.name} must implement execute()`,
      command: this.name,
    });
  }

  /**
   * Run the command with error handling
   */
  async run(args) {
    try {
      // Initialize error handler
      await errorHandler.initialize();

      // Parse arguments
      const parsed = this.parseArgs(args);

      // Handle help
      if (parsed.options.help) {
        this.showHelp();
        return 0;
      }

      // Initialize
      await this.initialize();

      // Execute command
      await this.execute(parsed.args, parsed.options);

      return 0;
    } catch (error) {
      const context = {
        command: this.name,
        args: args,
      };
      return errorHandler.handle(error, context);
    } finally {
      // Clean up
      if (this.apis) {
        this.apis.task.close();
        this.apis.relationship.close();
        this.apis.notes.close();
      }
      if (this.mainApi) {
        this.mainApi.close();
      }
    }
  }

  /**
   * Handle errors with appropriate formatting
   * @deprecated Use errorHandler.handle() instead
   */
  handleError(error) {
    const context = {
      command: this.name,
      deprecated: true,
    };
    errorHandler.handle(error, context);
  }

  /**
   * Show command help
   */
  showHelp() {
    console.log(`${chalk.bold(this.name)} - ${this.description}`);
    console.log();

    // Usage
    console.log(chalk.bold('Usage:'));
    let usage = `  taskwerk ${this.name}`;

    // Add options to usage
    if (this.options.length > 0) {
      usage += ' [options]';
    }

    // Add arguments to usage
    for (const arg of this.arguments) {
      if (arg.variadic) {
        usage += ` ${arg.required ? '<' : '['}${arg.name}...${arg.required ? '>' : ']'}`;
      } else {
        usage += ` ${arg.required ? '<' : '['}${arg.name}${arg.required ? '>' : ']'}`;
      }
    }

    console.log(usage);
    console.log();

    // Arguments
    if (this.arguments.length > 0) {
      console.log(chalk.bold('Arguments:'));
      for (const arg of this.arguments) {
        let argStr = `  ${arg.name}`;
        if (arg.variadic) {
          argStr += '...';
        }
        console.log(`${argStr.padEnd(20)} ${arg.description}`);
        if (arg.defaultValue !== undefined) {
          console.log(`${''.padEnd(20)} (default: ${arg.defaultValue})`);
        }
      }
      console.log();
    }

    // Options
    if (this.options.length > 0) {
      console.log(chalk.bold('Options:'));
      for (const opt of this.options) {
        let optStr = '';
        if (opt.short) {
          optStr += `-${opt.short}, `;
        }
        if (opt.long) {
          optStr += `--${opt.long}`;
        }
        if (opt.hasValue) {
          optStr += opt.required ? ' <value>' : ' [value]';
        }

        console.log(`  ${optStr.padEnd(20)} ${opt.description}`);
        if (opt.defaultValue !== undefined) {
          console.log(`${''.padEnd(22)} (default: ${opt.defaultValue})`);
        }
      }
      console.log();
    }
  }

  /**
   * Format output based on options
   */
  formatOutput(data, options) {
    const format = options.format || this.config?.outputFormat || 'pretty';

    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'plain':
        return this.formatPlain(data);
      case 'pretty':
      default:
        return this.formatPretty(data);
    }
  }

  /**
   * Format data as plain text (to be overridden by subclasses)
   */
  formatPlain(data) {
    return JSON.stringify(data);
  }

  /**
   * Format data with colors and styling (to be overridden by subclasses)
   */
  formatPretty(data) {
    return JSON.stringify(data, null, 2);
  }

  /**
   * Print output
   */
  print(data, options = {}) {
    const output = this.formatOutput(data, options);
    console.log(output);
  }

  /**
   * Print success message
   */
  success(message) {
    console.log(chalk.green('✓'), message);
  }

  /**
   * Print info message
   */
  info(message) {
    console.log(chalk.blue('ℹ'), message);
  }

  /**
   * Print warning message
   */
  warn(message) {
    console.log(chalk.yellow('⚠'), message);
  }

  /**
   * Confirm action with user
   */
  async confirm(message, defaultValue = false) {
    // For now, return default value
    // TODO: Implement interactive confirmation
    return defaultValue;
  }
}

export default BaseCommand;
