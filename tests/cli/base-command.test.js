/**
 * Tests for CLI Base Command
 */

import { describe, test, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { BaseCommand } from '../../src/cli/base-command.js';
import { ValidationError } from '../../src/api/base-api.js';

/**
 * Test command implementation
 */
class TestCommand extends BaseCommand {
  constructor() {
    super('test', 'Test command');
    this.executeCallCount = 0;
    this.executeArgs = null;
    this.executeOptions = null;
  }

  async execute(args, options) {
    this.executeCallCount++;
    this.executeArgs = args;
    this.executeOptions = options;
  }
}

describe('Base Command', () => {
  let command;

  beforeEach(() => {
    command = new TestCommand();
  });

  describe('Option Definition', () => {
    test('should define simple options', () => {
      command.option('-f, --force', 'Force action');

      // Account for default help option
      assert.strictEqual(command.options.length, 2);
      const forceOption = command.options.find(opt => opt.long === 'force');
      assert.strictEqual(forceOption.short, 'f');
      assert.strictEqual(forceOption.long, 'force');
      assert.strictEqual(forceOption.description, 'Force action');
      assert.strictEqual(forceOption.hasValue, false);
    });

    test('should define options with values', () => {
      command.option('-n, --name <value>', 'Set name');

      const nameOption = command.options.find(opt => opt.long === 'name');
      assert.strictEqual(nameOption.hasValue, true);
    });

    test('should define options with optional values', () => {
      command.option('-c, --config [path]', 'Config path');

      const configOption = command.options.find(opt => opt.long === 'config');
      assert.strictEqual(configOption.hasValue, true);
    });

    test('should define required options', () => {
      command.requiredOption('-i, --input <file>', 'Input file');

      const inputOption = command.options.find(opt => opt.long === 'input');
      assert.strictEqual(inputOption.required, true);
    });

    test('should support option defaults', () => {
      command.option('-l, --limit <n>', 'Limit results', 10);

      const limitOption = command.options.find(opt => opt.long === 'limit');
      assert.strictEqual(limitOption.defaultValue, 10);
    });
  });

  describe('Argument Definition', () => {
    test('should define required arguments', () => {
      command.argument('name', 'Task name');

      assert.strictEqual(command.arguments.length, 1);
      assert.strictEqual(command.arguments[0].name, 'name');
      assert.strictEqual(command.arguments[0].required, true);
      assert.strictEqual(command.arguments[0].variadic, false);
    });

    test('should define optional arguments', () => {
      command.argument('filter', 'Filter pattern', { optional: true });

      assert.strictEqual(command.arguments[0].required, false);
    });

    test('should define variadic arguments', () => {
      command.argument('files', 'File list', { variadic: true });

      assert.strictEqual(command.arguments[0].variadic, true);
    });

    test('should support argument defaults', () => {
      command.argument('status', 'Task status', {
        optional: true,
        defaultValue: 'todo',
      });

      assert.strictEqual(command.arguments[0].defaultValue, 'todo');
    });
  });

  describe('Argument Parsing', () => {
    beforeEach(() => {
      command
        .option('-f, --force', 'Force action')
        .option('-v, --verbose', 'Verbose output')
        .option('-n, --name <value>', 'Set name')
        .option('-l, --limit <n>', 'Limit', 10)
        .argument('action', 'Action to perform')
        .argument('targets', 'Target items', { variadic: true });
    });

    test('should parse boolean flags', () => {
      const parsed = command.parseArgs(['--force', '--verbose', 'create']);

      assert.strictEqual(parsed.options.force, true);
      assert.strictEqual(parsed.options.verbose, true);
      assert.deepStrictEqual(parsed.args, ['create']);
    });

    test('should parse short flags', () => {
      const parsed = command.parseArgs(['-f', '-v', 'create']);

      assert.strictEqual(parsed.options.force, true);
      assert.strictEqual(parsed.options.verbose, true);
    });

    test('should parse options with values', () => {
      const parsed = command.parseArgs(['--name', 'test-task', 'create']);

      assert.strictEqual(parsed.options.name, 'test-task');
    });

    test('should parse mixed options and arguments', () => {
      const parsed = command.parseArgs(['--force', 'create', '--name', 'test', 'file1', 'file2']);

      assert.strictEqual(parsed.options.force, true);
      assert.strictEqual(parsed.options.name, 'test');
      assert.deepStrictEqual(parsed.args, ['create', 'file1', 'file2']);
    });

    test('should apply default values', () => {
      const parsed = command.parseArgs(['create']);

      assert.strictEqual(parsed.options.limit, 10);
      assert.strictEqual(parsed.options.force, undefined);
    });

    test('should throw on unknown options', () => {
      assert.throws(() => command.parseArgs(['--unknown', 'create']), /Unknown option/);
    });

    test('should throw on missing option values', () => {
      assert.throws(() => command.parseArgs(['--name']), /requires a value/);
    });

    test('should validate required options', () => {
      command.requiredOption('-i, --input <file>', 'Input file');

      assert.throws(() => command.parseArgs(['create']), /Required option.*input.*missing/);
    });

    test('should validate required arguments', () => {
      assert.throws(() => command.parseArgs([]), /Argument.*action.*required/);
    });
  });

  describe('Command Execution', () => {
    test('should execute with parsed arguments', async () => {
      command.option('-f, --force', 'Force');

      await command.execute(['test'], { force: true });

      assert.strictEqual(command.executeCallCount, 1);
      assert.deepStrictEqual(command.executeArgs, ['test']);
      assert.deepStrictEqual(command.executeOptions, { force: true });
    });

    test('should handle help option', async () => {
      let helpShown = false;
      command.showHelp = () => {
        helpShown = true;
      };

      const exitCode = await command.run(['--help']);

      assert.strictEqual(helpShown, true);
      assert.strictEqual(exitCode, 0);
    });
  });

  describe('Error Handling', () => {
    test('should handle validation errors', () => {
      let errorHandled = false;
      let handledError = null;

      command.handleError = error => {
        errorHandled = true;
        handledError = error;
      };

      const error = new ValidationError('Test error', ['Field required']);
      command.handleError(error);

      assert.strictEqual(errorHandled, true);
      assert.strictEqual(handledError, error);
    });

    test('should return error code on failure', async () => {
      command.execute = async () => {
        throw new Error('Command failed');
      };

      const exitCode = await command.run(['test']);

      assert.strictEqual(exitCode, 1);
    });
  });

  describe('Output Formatting', () => {
    test('should format JSON output', () => {
      const data = { id: 1, name: 'Test' };
      const output = command.formatOutput(data, { format: 'json' });

      assert.strictEqual(output, JSON.stringify(data, null, 2));
    });

    test('should use default format', () => {
      command.config = { outputFormat: 'json' };
      const data = { id: 1 };
      const output = command.formatOutput(data, {});

      assert.strictEqual(output, JSON.stringify(data, null, 2));
    });
  });

  describe('Help Display', () => {
    test('should show command help', () => {
      let helpOutput = '';
      const originalLog = console.log;
      console.log = msg => {
        helpOutput += msg + '\n';
      };

      command.option('-f, --force', 'Force action').argument('name', 'Item name').showHelp();

      console.log = originalLog;

      assert.ok(helpOutput.includes('test'));
      assert.ok(helpOutput.includes('Test command'));
      assert.ok(helpOutput.includes('--force'));
      assert.ok(helpOutput.includes('name'));
    });
  });

  describe('Chaining', () => {
    test('should support method chaining', () => {
      const result = command
        .option('-f, --force', 'Force')
        .option('-v, --verbose', 'Verbose')
        .argument('name', 'Name')
        .argument('value', 'Value');

      assert.strictEqual(result, command);
      assert.strictEqual(command.options.length, 3); // including default help option
      assert.strictEqual(command.arguments.length, 2);
    });
  });
});
