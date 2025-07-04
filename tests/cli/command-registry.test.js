/**
 * Tests for Command Registry
 */

import { describe, test, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { CommandRegistry, CommandGroup } from '../../src/cli/command-registry.js';
import { BaseCommand } from '../../src/cli/base-command.js';

/**
 * Test command implementations
 */
class TestCommand extends BaseCommand {
  constructor(name = 'test', description = 'Test command') {
    super(name, description);
    this.category = 'Testing';
    this.executed = false;
  }

  async execute(args, options) {
    this.executed = true;
    this.lastArgs = args;
    this.lastOptions = options;
  }
}

class AnotherCommand extends BaseCommand {
  constructor() {
    super('another', 'Another test command');
    this.category = 'Testing';
    this.aliases = ['alt', 'other'];
  }

  async execute() {
    // Test implementation
  }
}

describe('Command Registry', () => {
  let registry;

  beforeEach(() => {
    registry = new CommandRegistry();
  });

  describe('Command Registration', () => {
    test('should register a command', () => {
      const command = new TestCommand();
      registry.register(command);

      assert.strictEqual(registry.commands.size, 1);
      assert.strictEqual(registry.commands.get('test'), command);
    });

    test('should reject non-BaseCommand instances', () => {
      assert.throws(() => registry.register({}), /must extend BaseCommand/);
    });

    test('should register command aliases', () => {
      const command = new AnotherCommand();
      registry.register(command);

      assert.strictEqual(registry.aliases.get('alt'), 'another');
      assert.strictEqual(registry.aliases.get('other'), 'another');
    });

    test('should organize commands by category', () => {
      const command1 = new TestCommand();
      const command2 = new AnotherCommand();

      registry.register(command1);
      registry.register(command2);

      const testingCommands = registry.categories.get('Testing');
      assert.ok(testingCommands.includes('test'));
      assert.ok(testingCommands.includes('another'));
    });

    test('should support method chaining', () => {
      const result = registry.register(new TestCommand()).register(new AnotherCommand());

      assert.strictEqual(result, registry);
    });
  });

  describe('Command Retrieval', () => {
    beforeEach(() => {
      registry.register(new TestCommand());
      registry.register(new AnotherCommand());
    });

    test('should get command by name', () => {
      const command = registry.getCommand('test');
      assert.ok(command instanceof TestCommand);
    });

    test('should get command by alias', () => {
      const command = registry.getCommand('alt');
      assert.ok(command instanceof AnotherCommand);
      assert.strictEqual(command.name, 'another');
    });

    test('should return null for unknown command', () => {
      const command = registry.getCommand('unknown');
      assert.strictEqual(command, null);
    });

    test('should get all commands', () => {
      const commands = registry.getAllCommands();
      assert.strictEqual(commands.length, 2);
      assert.ok(commands.some(cmd => cmd.name === 'test'));
      assert.ok(commands.some(cmd => cmd.name === 'another'));
    });

    test('should get commands by category', () => {
      const byCategory = registry.getCommandsByCategory();

      assert.ok('Testing' in byCategory);
      assert.strictEqual(byCategory.Testing.length, 2);
    });
  });

  describe('Global Options', () => {
    test('should register global options', () => {
      registry
        .globalOption('-v, --verbose', 'Verbose output')
        .globalOption('-q, --quiet', 'Quiet mode');

      assert.strictEqual(registry.globalOptions.length, 2);
    });

    test('should apply global options to commands', async () => {
      registry.globalOption('-v, --verbose', 'Verbose output');

      const command = new TestCommand();
      registry.register(command);

      // Simulate execution with global options
      await registry.execute(['test', '--verbose']);

      // The command should have the global option
      const hasVerbose = command.options.some(opt => opt.long === 'verbose');
      assert.ok(hasVerbose);
    });
  });

  describe('Command Execution', () => {
    let command;

    beforeEach(() => {
      command = new TestCommand();
      registry.register(command);
    });

    test('should execute command by name', async () => {
      const exitCode = await registry.execute(['test', 'arg1']);

      assert.strictEqual(exitCode, 0);
      assert.strictEqual(command.executed, true);
    });

    test('should execute command by alias', async () => {
      const altCommand = new AnotherCommand();
      altCommand.execute = async () => {
        altCommand.executed = true;
      };
      registry.register(altCommand);

      await registry.execute(['alt']);

      assert.strictEqual(altCommand.executed, true);
    });

    test('should show help when no arguments', async () => {
      let helpShown = false;
      registry.showHelp = () => {
        helpShown = true;
      };

      await registry.execute([]);

      assert.strictEqual(helpShown, true);
    });

    test('should handle --help flag', async () => {
      let helpShown = false;
      registry.showHelp = () => {
        helpShown = true;
      };

      const exitCode = await registry.execute(['--help']);

      assert.strictEqual(helpShown, true);
      assert.strictEqual(exitCode, 0);
    });

    test('should handle --version flag', async () => {
      let versionShown = false;
      registry.showVersion = () => {
        versionShown = true;
      };

      const exitCode = await registry.execute(['--version']);

      assert.strictEqual(versionShown, true);
      assert.strictEqual(exitCode, 0);
    });

    test('should return error for unknown command', async () => {
      const exitCode = await registry.execute(['unknown']);
      assert.strictEqual(exitCode, 1);
    });
  });

  describe('Help Display', () => {
    test('should show registry help', () => {
      let helpOutput = '';
      const originalLog = console.log;
      console.log = (msg = '') => {
        helpOutput += msg + '\n';
      };

      registry.register(new TestCommand());
      registry.register(new AnotherCommand());
      registry.showHelp();

      console.log = originalLog;

      assert.ok(helpOutput.includes('TaskWerk'));
      assert.ok(helpOutput.includes('Testing:'));
      assert.ok(helpOutput.includes('test'));
      assert.ok(helpOutput.includes('another'));
      assert.ok(helpOutput.includes('alias:'));
    });
  });
});

describe('Command Group', () => {
  let group;

  beforeEach(() => {
    group = new CommandGroup('config', 'Configuration management');
  });

  test('should create command group', () => {
    assert.strictEqual(group.name, 'config');
    assert.strictEqual(group.description, 'Configuration management');
    assert.strictEqual(group.category, 'Groups');
  });

  test('should add subcommands', () => {
    const subcommand = new TestCommand('get', 'Get config value');
    group.subcommand(subcommand);

    assert.strictEqual(group.subcommands.size, 1);
    assert.strictEqual(group.subcommands.get('get'), subcommand);
  });

  test('should execute subcommands', async () => {
    const subcommand = new TestCommand('set', 'Set config value');
    group.subcommand(subcommand);

    await group.execute(['set', 'key', 'value'], {});

    assert.strictEqual(subcommand.executed, true);
    assert.deepStrictEqual(subcommand.lastArgs, ['key', 'value']);
  });

  test('should show group help when no subcommand', async () => {
    let helpShown = false;
    group.showGroupHelp = () => {
      helpShown = true;
    };

    await group.execute([], {});

    assert.strictEqual(helpShown, true);
  });

  test('should throw on unknown subcommand', async () => {
    await assert.rejects(async () => await group.execute(['unknown'], {}), /Unknown subcommand/);
  });

  test('should display group help correctly', () => {
    let helpOutput = '';
    const originalLog = console.log;
    console.log = (msg = '') => {
      helpOutput += msg + '\n';
    };

    group.subcommand(new TestCommand('get', 'Get value'));
    group.subcommand(new TestCommand('set', 'Set value'));
    group.showGroupHelp();

    console.log = originalLog;

    assert.ok(helpOutput.includes('config'));
    assert.ok(helpOutput.includes('get'));
    assert.ok(helpOutput.includes('set'));
  });
});
