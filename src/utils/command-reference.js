/**
 * Utilities for generating dynamic command references
 */

/**
 * Extract all visible commands from a Commander program
 * @param {import('commander').Command} program - The Commander program instance
 * @returns {Array<{name: string, description: string, usage: string}>}
 */
export function extractCommands(program) {
  const commands = [];

  // Get all commands
  for (const cmd of program.commands) {
    // Skip hidden commands
    if (cmd.hidden) {
      continue;
    }

    // Skip help command
    if (cmd.name() === 'help') {
      continue;
    }

    // Build usage string
    let usage = `${program.name()} ${cmd.name()}`;

    // Add required arguments
    for (const arg of cmd.args) {
      if (arg.required) {
        usage += ` <${arg.name()}>`;
      } else {
        usage += ` [${arg.name()}]`;
      }
    }

    // Add key options (just show that options exist)
    if (cmd.options.length > 0) {
      usage += ' [options]';
    }

    commands.push({
      name: cmd.name(),
      description: cmd.description() || '',
      usage: usage,
    });
  }

  return commands.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Generate command reference text for AI prompts
 * @param {Array<{name: string, description: string, usage: string}>} commands
 * @returns {string}
 */
export function generateCommandReference(commands) {
  const taskCommands = commands.filter(cmd =>
    [
      'addtask',
      'list',
      'showtask',
      'updatetask',
      'deletetask',
      'done',
      'start',
      'block',
      'statustask',
    ].includes(cmd.name)
  );

  let reference = 'IMPORTANT taskwerk command reference:\n';

  // Group by common operations
  const groups = {
    'Creating tasks': ['addtask'],
    'Viewing tasks': ['list', 'showtask'],
    'Updating tasks': ['updatetask', 'done', 'start', 'block', 'statustask'],
    'Deleting tasks': ['deletetask'],
  };

  for (const [group, cmdNames] of Object.entries(groups)) {
    reference += `\n${group}:\n`;
    for (const cmdName of cmdNames) {
      const cmd = taskCommands.find(c => c.name === cmdName);
      if (cmd) {
        reference += `- ${cmd.usage} - ${cmd.description}\n`;
      }
    }
  }

  reference += '\nNEVER suggest non-existent commands. Only use the commands listed above.';

  return reference;
}

/**
 * Generate tool reference for AI prompts
 * @param {import('../ai/tool-executor.js').ToolExecutor} toolExecutor
 * @returns {string}
 */
export function generateToolReference(toolExecutor) {
  const tools = toolExecutor.registry.getAll();
  let reference = '\nAvailable tools for this mode:\n';

  for (const [name, tool] of tools) {
    reference += `- ${name}: ${tool.description}`;
    if (tool.permissions && tool.permissions.length > 0) {
      reference += ` (requires: ${tool.permissions.join(', ')})`;
    }
    reference += '\n';
  }

  return reference;
}

/**
 * Generate full capability reference for AI modes
 * @param {import('commander').Command} program
 * @param {import('../ai/tool-executor.js').ToolExecutor} toolExecutor
 * @returns {string}
 */
export function generateCapabilityReference(program, toolExecutor) {
  const commands = extractCommands(program);
  let reference = generateCommandReference(commands);

  if (toolExecutor) {
    reference += generateToolReference(toolExecutor);
  }

  return reference;
}

/**
 * Get standard task management commands
 * Used when we don't have access to the program instance
 * @returns {Array<{name: string, description: string, usage: string}>}
 */
export function getStandardTaskCommands() {
  return [
    {
      name: 'addtask',
      description: 'Add a new task',
      usage: 'taskwerk addtask <name> [options]',
    },
    {
      name: 'list',
      description: 'List tasks',
      usage: 'taskwerk list [options]',
    },
    {
      name: 'showtask',
      description: 'Show task details',
      usage: 'taskwerk showtask <id>',
    },
    {
      name: 'updatetask',
      description: 'Update a task',
      usage: 'taskwerk updatetask <id> [options]',
    },
    {
      name: 'deletetask',
      description: 'Delete a task',
      usage: 'taskwerk deletetask <id>',
    },
    {
      name: 'done',
      description: 'Mark a task as done',
      usage: 'taskwerk done <id>',
    },
    {
      name: 'start',
      description: 'Mark a task as in-progress',
      usage: 'taskwerk start <id>',
    },
    {
      name: 'block',
      description: 'Mark a task as blocked',
      usage: 'taskwerk block <id>',
    },
    {
      name: 'statustask',
      description: 'Change task status',
      usage: 'taskwerk statustask <id> <status>',
    },
  ];
}
