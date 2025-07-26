import { Command } from 'commander';
import { LLMManager } from '../ai/llm-manager.js';
import { ToolExecutor } from '../ai/tool-executor.js';
import { Logger } from '../logging/logger.js';
import {
  generateCommandReference,
  generateToolReference,
  getStandardTaskCommands,
} from '../utils/command-reference.js';
import inquirer from 'inquirer';

export function aiconfigCommand() {
  const aiconfig = new Command('aiconfig');

  aiconfig
    .description('Configure AI/LLM settings')
    .option('--set <key=value>', 'Set a configuration value (e.g., openai.api_key=sk-...)')
    .option('--global', 'Apply operation to global config (~/.config/taskwerk/)')
    .option('--local', 'Apply operation to local config (default)')
    .option('--list-providers', 'List available AI providers')
    .option('--list-models [provider]', 'List available models for provider')
    .option('--choose', 'Interactively choose provider and model')
    .option('--provider <name>', 'Set the current provider (non-interactive)')
    .option('--model <name>', 'Set the current model (non-interactive)')
    .option('--test', 'Test connection to configured providers')
    .option('--show', 'Show current AI configuration')
    .option('--show-origin', 'Show configuration with source information')
    .option('--list-tools', 'List available AI tools')
    .option('--show-prompts', 'Show system prompts for ask and agent modes')
    .option('--migrate-to-global', 'Migrate local config to global')
    .option('--copy-from-global', 'Copy global config to local')
    .option('--clear', 'Clear configuration')
    .action(async options => {
      const logger = new Logger('aiconfig');
      const llmManager = new LLMManager();

      try {
        // Handle different options
        if (options.listProviders) {
          await listProviders(llmManager);
        } else if (options.listModels !== undefined) {
          await listModels(llmManager, options.listModels);
        } else if (options.choose) {
          await chooseProviderAndModel(llmManager, options.global);
        } else if (options.provider && options.model) {
          await setProviderAndModel(llmManager, options.provider, options.model, options.global);
        } else if (options.provider) {
          console.error('❌ --model is required when setting --provider');
          process.exit(1);
        } else if (options.model) {
          console.error('❌ --provider is required when setting --model');
          process.exit(1);
        } else if (options.test) {
          await testProviders(llmManager);
        } else if (options.set) {
          await setConfig(llmManager, options.set, options.global);
        } else if (options.migrateToGlobal) {
          await migrateToGlobal(llmManager);
        } else if (options.copyFromGlobal) {
          await copyFromGlobal(llmManager);
        } else if (options.clear) {
          await clearConfig(llmManager, options.global);
        } else if (options.listTools) {
          await listTools();
        } else if (options.showPrompts) {
          await showPrompts();
        } else if (options.show || options.showOrigin) {
          await showConfig(llmManager, {
            global: options.global,
            local: options.local,
            showOrigin: options.showOrigin,
          });
        } else {
          // Default: show current config
          await showConfig(llmManager);
        }
      } catch (error) {
        logger.error('Configuration failed', error);
        if (
          error.message &&
          !error.message.includes('Unknown configuration key') &&
          !error.message.includes('Invalid configuration format')
        ) {
          console.error('❌ Configuration failed:', error.message);
        }
        process.exit(1);
      }
    });

  return aiconfig;
}

async function listProviders(llmManager) {
  console.log('📋 Available AI Providers:');
  console.log('─'.repeat(50));

  const providers = llmManager.listProviders();

  for (const provider of providers) {
    const status = provider.configured ? '✅ Configured' : '❌ Not configured';
    const enabled = provider.enabled ? '' : ' (disabled)';
    console.log(`  ${provider.name}: ${status}${enabled}`);
  }

  console.log('\n💡 To configure a provider, use:');
  console.log('   taskwerk aiconfig --set <provider>.<key>=<value>');
  console.log('\n   Example: taskwerk aiconfig --set anthropic.api_key=sk-ant-...');
}

async function listModels(llmManager, providerName) {
  if (providerName && providerName !== true) {
    // List models for specific provider
    console.log(`🔍 Discovering models from ${providerName}...`);

    try {
      const provider = llmManager.getProvider(providerName);
      const models = await provider.listModels();

      if (models.length === 0) {
        console.log(`❌ No models available for ${providerName}`);
        return;
      }

      console.log(`\n📋 Available models for ${providerName}:`);
      for (const model of models) {
        console.log(`   ${model.id}`);
        if (model.description) {
          console.log(`      ${model.description}`);
        }
      }
    } catch (error) {
      console.error(`❌ Failed to list models for ${providerName}: ${error.message}`);
    }
  } else {
    // List models for all providers
    console.log('🔍 Discovering models from all providers...');

    const modelsByProvider = await llmManager.discoverModels();

    for (const [provider, models] of modelsByProvider) {
      console.log(`\n📋 ${provider}:`);

      if (models.length === 0) {
        console.log('   No models available');
        continue;
      }

      const firstModel = models[0];
      if (firstModel.id === 'no-models' || firstModel.id === 'connection-error') {
        console.log(`   ${firstModel.description}`);
        continue;
      }

      for (const model of models) {
        console.log(`   ${model.id}`);
      }
    }
  }
}

async function setProviderAndModel(llmManager, providerName, modelName, isGlobal = false) {
  try {
    // Verify provider exists
    const provider = llmManager.getProvider(providerName);

    // Verify model is available
    const models = await provider.listModels();
    const modelExists = models.some(m => m.id === modelName);

    if (!modelExists) {
      console.error(`❌ Model '${modelName}' not found for provider '${providerName}'`);
      console.log('\n💡 Available models:');
      for (const model of models) {
        console.log(`   ${model.id}`);
      }
      process.exit(1);
    }

    // Set the configuration
    llmManager.setCurrentProvider(providerName, modelName, isGlobal);

    const scope = isGlobal ? 'global' : 'local';
    console.log(`✅ Configuration updated in ${scope} config:`);
    console.log(`   Provider: ${providerName}`);
    console.log(`   Model: ${modelName}`);
  } catch (error) {
    console.error(`❌ Failed to set provider/model: ${error.message}`);
    process.exit(1);
  }
}

async function chooseProviderAndModel(llmManager, isGlobal = false) {
  // First, discover all available models
  console.log('🔍 Discovering available models...');
  const modelsByProvider = await llmManager.discoverModels();

  // Filter to only configured providers with models
  const availableProviders = [];
  for (const [provider, models] of modelsByProvider) {
    if (models.length > 0) {
      const firstModel = models[0];

      // Check for special status models
      if (firstModel.id === 'no-models' || firstModel.id === 'connection-error') {
        availableProviders.push({
          provider,
          models,
          disabled: true,
          status: firstModel.description,
        });
      } else {
        availableProviders.push({ provider, models, disabled: false });
      }
    } else {
      // Show unconfigured providers too
      availableProviders.push({
        provider,
        models: [],
        disabled: true,
        status: 'Not configured',
      });
    }
  }

  const workingProviders = availableProviders.filter(p => !p.disabled);
  const problemProviders = availableProviders.filter(p => p.disabled);

  // Include providers that have connection errors but are configured
  const selectableProviders = availableProviders.filter(p => {
    // Include working providers
    if (!p.disabled) {
      return true;
    }
    // Include providers with connection errors (they have models, just error models)
    if (p.models.length > 0 && p.models[0].id === 'connection-error') {
      return true;
    }
    // Exclude truly unconfigured providers
    return false;
  });

  console.log(`Found models from ${workingProviders.length} providers\n`);

  // Show status of problematic providers if any
  if (problemProviders.length > 0) {
    console.log('⚠️  Provider issues:');
    for (const p of problemProviders) {
      console.log(`   ${p.provider}: ${p.status}`);
    }
    console.log('');
  }

  if (selectableProviders.length === 0) {
    console.log('❌ No providers available.');
    console.log('\n💡 Configure a provider first:');
    console.log('   taskwerk aiconfig --set <provider>.api_key=<your-key>');
    return;
  }

  // Choose provider
  const providerChoices = selectableProviders.map(p => ({
    name: p.disabled
      ? `${p.provider} (⚠️  ${p.status})`
      : `${p.provider} (${p.models.length} models)`,
    value: p.provider,
  }));

  const { selectedProvider } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedProvider',
      message: 'Select AI provider:',
      choices: providerChoices,
    },
  ]);

  // Choose model
  const providerData = selectableProviders.find(p => p.provider === selectedProvider);

  // Check if this provider has connection errors
  if (providerData.disabled && providerData.models[0]?.id === 'connection-error') {
    console.log(`\n❌ Cannot use ${selectedProvider}: ${providerData.status}`);
    console.log('\n💡 To fix this:');
    console.log(`   1. Ensure your API key is correct`);
    console.log(`   2. Run: taskwerk aiconfig --set ${selectedProvider}.api_key=<your-key>`);
    console.log(`   3. Test connection: taskwerk aiconfig --test`);
    return;
  }

  const modelChoices = providerData.models.map(m => ({
    name: `${m.name}${m.description ? ` - ${m.description}` : ''}`,
    value: m.id,
  }));

  const { selectedModel } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedModel',
      message: 'Select model:',
      choices: modelChoices,
      pageSize: 10,
    },
  ]);

  // Save selection
  llmManager.setCurrentProvider(selectedProvider, selectedModel, isGlobal);

  const scope = isGlobal ? 'global' : 'local';
  console.log(`\n✅ Configuration saved to ${scope} config:`);
  console.log(`   Provider: ${selectedProvider}`);
  console.log(`   Model: ${selectedModel}`);
}

async function testProviders(llmManager) {
  console.log('🧪 Testing AI provider connections...\n');

  const results = await llmManager.testAllProviders();

  for (const result of results) {
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} ${result.name}: ${result.message}`);
  }

  const successCount = results.filter(r => r.success).length;
  console.log(`\n📊 Summary: ${successCount}/${results.length} providers connected successfully`);
}

async function setConfig(llmManager, configString, isGlobal = false) {
  // Parse the config string (e.g., "anthropic.api_key=sk-ant-...")
  const match = configString.match(/^([^.]+)\.([^=]+)=(.+)$/);
  if (!match) {
    console.error('❌ Invalid configuration format.');
    console.error('\n💡 Use: taskwerk aiconfig --set <provider>.<key>=<value>');
    console.error('\nExamples:');
    console.error('  taskwerk aiconfig --set openai.api_key=sk-...');
    console.error('  taskwerk aiconfig --set anthropic.api_key=sk-ant-...');
    console.error('  taskwerk aiconfig --set ollama.base_url=http://localhost:11434');
    process.exit(1);
  }

  const [, provider, key, value] = match;

  // Special handling for provider-level settings
  if (key === 'api_key' || key === 'enabled' || key === 'base_url') {
    try {
      llmManager.configureProvider(provider, key, value, isGlobal);
      const scope = isGlobal ? 'global' : 'local';
      console.log(`✅ Set ${provider}.${key} in ${scope} config`);

      // Test the connection if we just set an API key
      if (key === 'api_key') {
        console.log('\n🧪 Testing connection...');
        const providerInstance = llmManager.getProvider(provider);
        const result = await providerInstance.testConnection();
        const icon = result.success ? '✅' : '❌';
        console.log(`${icon} ${result.message}`);
      }
    } catch (error) {
      if (error.message.includes('Unknown provider')) {
        console.error(`❌ Unknown provider: ${provider}`);
        console.error('\n💡 Available providers:');
        const providers = llmManager.listProviders();
        for (const p of providers) {
          console.error(`  - ${p.name}`);
        }
      } else {
        console.error(`❌ Failed to set configuration: ${error.message}`);
      }
      process.exit(1);
    }
  } else {
    console.error(`❌ Unknown configuration key: ${key}`);
    console.error('\n💡 Valid keys are: api_key, enabled, base_url');
    console.error('\nExample:');
    console.error(`  taskwerk aiconfig --set ${provider}.api_key=<your-api-key>`);
    process.exit(1);
  }
}

async function showConfig(llmManager, options = {}) {
  const { global, local, showOrigin } = options;

  console.log('🤖 AI Configuration');
  console.log('─'.repeat(50));

  // Get configuration manager
  const configManager = llmManager.configManager;

  if (showOrigin) {
    // Show configuration with sources
    const configWithSources = configManager.getWithSources();
    console.log('\n📍 Configuration Sources:');
    showConfigTree(configWithSources, '');
  } else if (global) {
    // Show only global config
    const globalConfig = configManager.getGlobalMasked();
    if (globalConfig && Object.keys(globalConfig).length > 0) {
      console.log('\n🌍 Global Configuration:');
      console.log(JSON.stringify(globalConfig, null, 2));
    } else {
      console.log('\n🌍 No global configuration found.');
    }
  } else if (local) {
    // Show only local config
    const localConfig = configManager.getLocalMasked();
    if (localConfig && Object.keys(localConfig).length > 0) {
      console.log('\n📁 Local Configuration:');
      console.log(JSON.stringify(localConfig, null, 2));
    } else {
      console.log('\n📁 No local configuration found.');
    }
  } else {
    // Show merged configuration (default)
    const config = llmManager.getConfigSummary();
    console.log(`Current Provider: ${config.current_provider}`);
    console.log(`Current Model: ${config.current_model}`);

    if (config.providers.length > 0) {
      console.log('\n📋 Provider Status:');
      for (const provider of config.providers) {
        const status = provider.configured ? '✅' : '❌';
        const enabled = provider.enabled ? '' : ' (disabled)';
        console.log(`  ${provider.name}: ${status}${enabled}`);

        if (provider.configured && Object.keys(provider.config).length > 0) {
          for (const [key, value] of Object.entries(provider.config)) {
            if (key !== 'enabled') {
              console.log(`    ${key}: ${value}`);
            }
          }
        }
      }
    }

    if (config.defaults && Object.keys(config.defaults).length > 0) {
      console.log('\n⚙️  Default Settings:');
      for (const [key, value] of Object.entries(config.defaults)) {
        console.log(`  ${key}: ${value}`);
      }
    }

    // Show configuration source hints
    console.log('\n📂 Configuration Locations:');
    console.log(`  Global: ${configManager.globalPath}`);
    console.log(`  Local:  ${configManager.localPath}`);
  }

  console.log('\n💡 Commands:');
  console.log('  Configure provider:  taskwerk aiconfig --set <provider>.api_key=<key>');
  console.log('  Choose model:        taskwerk aiconfig --choose');
  console.log('  Test connections:    taskwerk aiconfig --test');
}

function showConfigTree(obj, indent = '', path = '') {
  const sourceIcons = {
    default: '⚪',
    global: '🌍',
    local: '📁',
    env: '🔐',
  };

  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === 'object' && 'value' in value && 'source' in value) {
      // Leaf node with value and source
      const icon = sourceIcons[value.source] || '❓';
      const displayValue =
        typeof value.value === 'string' && value.value.includes('*')
          ? value.value
          : JSON.stringify(value.value);
      console.log(`${indent}${key}: ${displayValue} ${icon} (${value.source})`);
    } else if (typeof value === 'object') {
      // Branch node
      console.log(`${indent}${key}:`);
      showConfigTree(value, indent + '  ', path ? `${path}.${key}` : key);
    }
  }
}

async function migrateToGlobal(llmManager) {
  console.log('📦 Migrating local configuration to global...');

  try {
    const configManager = llmManager.configManager;
    await configManager.migrateToGlobal();
    console.log('✅ Successfully migrated local configuration to global.');
    console.log(`   Global config: ${configManager.globalPath}`);
    console.log('\n💡 Your local project config has been cleared.');
    console.log('   API keys are now available globally across all projects.');
  } catch (error) {
    console.error(`❌ Failed to migrate: ${error.message}`);
    process.exit(1);
  }
}

async function copyFromGlobal(llmManager) {
  console.log('📄 Copying global configuration to local project...');

  try {
    const configManager = llmManager.configManager;
    await configManager.copyFromGlobal();
    console.log('✅ Successfully copied global configuration to local project.');
    console.log(`   Local config: ${configManager.localPath}`);
  } catch (error) {
    console.error(`❌ Failed to copy: ${error.message}`);
    process.exit(1);
  }
}

async function clearConfig(llmManager, isGlobal = false) {
  const scope = isGlobal ? 'global' : 'local';
  console.log(`🗑️  Clearing ${scope} configuration...`);

  try {
    const configManager = llmManager.configManager;
    configManager.clear(isGlobal);
    console.log(`✅ Successfully cleared ${scope} configuration.`);
  } catch (error) {
    console.error(`❌ Failed to clear: ${error.message}`);
    process.exit(1);
  }
}

async function listTools() {
  console.log('🔧 Available AI Tools');
  console.log('─'.repeat(50));

  // Create tool executor instances for each mode to see what tools are available
  const modes = ['ask', 'agent'];

  for (const mode of modes) {
    const toolExecutor = new ToolExecutor({ mode, workDir: process.cwd() });
    const allTools = toolExecutor.registry.getAll();

    console.log(`\n📋 ${mode.toUpperCase()} mode tools:`);

    for (const [name, tool] of allTools) {
      const hasPermission =
        mode === 'ask'
          ? !tool.permissions ||
            tool.permissions.every(p => ['read_files', 'modify_tasks'].includes(p))
          : true;

      if (hasPermission) {
        console.log(`  ${name}:`);
        console.log(`    ${tool.description}`);
        if (tool.permissions && tool.permissions.length > 0) {
          console.log(`    Permissions: ${tool.permissions.join(', ')}`);
        }
      }
    }
  }

  console.log('\n📂 Tool Categories:');
  console.log('  filesystem/  - File system operations (read, write, list)');
  console.log('  taskwerk/    - Task management operations (add, update, list)');
  console.log('  mcp/         - MCP server tools (when available)');
  console.log('  web/         - Web tools like search (future)');

  console.log('\n💡 To add new tools:');
  console.log(
    '  1. Create a new tool class extending BaseTool in src/ai/tools/<category>/<tool-name>.js'
  );
  console.log('  2. Register it in src/ai/tool-executor.js initializeTools() method');
  console.log('  3. Define required permissions in the tool class');
  console.log('\n  Example tool structure:');
  console.log('    export class MyTool extends BaseTool {');
  console.log('      constructor(config) {');
  console.log('        super(config);');
  console.log('        this.name = "my_tool";');
  console.log('        this.description = "Does something useful";');
  console.log('        this.permissions = ["read_files"]; // Optional');
  console.log('      }');
  console.log('      getParameters() { /* JSON Schema */ }');
  console.log('      async execute(params, context) { /* Implementation */ }');
  console.log('    }');
}

async function showPrompts() {
  console.log('📝 AI System Prompts');
  console.log('─'.repeat(50));

  // Generate dynamic command reference
  const commands = getStandardTaskCommands();
  const commandReference = generateCommandReference(commands);

  // Create tool executors for each mode to show available tools
  const askToolExecutor = new ToolExecutor({ mode: 'ask', workDir: process.cwd() });
  const agentToolExecutor = new ToolExecutor({ mode: 'agent', workDir: process.cwd() });

  const askToolReference = generateToolReference(askToolExecutor);
  const agentToolReference = generateToolReference(agentToolExecutor);

  console.log('\n🤔 ASK Mode System Prompt:');
  console.log('─'.repeat(30));
  console.log(`
You are an AI assistant for Taskwerk (twrk), a powerful command-line task management and productivity system.

Your role is to help users with:
- Task management and planning
- Project organization 
- Workflow optimization
- Understanding their current tasks and priorities
- Suggesting taskwerk commands and features
- Analyzing task data and progress

${commandReference}

You have read-only access to:
- Files in the current directory
- Current tasks and their status
- Task history and metadata

${askToolReference}

Key principles:
1. Always think in terms of tasks, projects, and productivity
2. Suggest relevant taskwerk commands when appropriate
3. Help break down complex goals into manageable tasks
4. Focus on actionable insights and recommendations
5. When answering general questions, try to relate them back to task management or productivity

Current working directory: {working_directory}
{context}

Remember: You can read and analyze, but cannot modify files or tasks. For modifications, suggest the user use 'taskwerk agent' instead.

IMPORTANT: When listing or describing tasks, ONLY mention tasks that actually exist in the database. Never create example tasks or fictional task IDs. If there are no tasks, explicitly say "No tasks found" rather than creating examples.
`);

  console.log('\n🤖 AGENT Mode System Prompt:');
  console.log('─'.repeat(30));
  console.log(`
You are an AI agent for Taskwerk (twrk), a powerful command-line task management and productivity system. You are the active, hands-on assistant that can make changes and execute tasks.

Your capabilities:
- Read and write files in the working directory
- Create, update, delete, and manage tasks
- Analyze project structures and workflows
- Execute multi-step plans to complete complex objectives
- Implement productivity systems and organize work

Your mission:
- Help users achieve their goals through better task management
- Implement productivity workflows and systems
- Organize and structure projects effectively
- Automate repetitive task management operations
- Provide actionable, results-oriented assistance

${commandReference}

${agentToolReference}

Core principles:
1. Think like a productivity expert and project manager
2. Break complex goals into clear, actionable tasks
3. Always consider the broader project context and workflow
4. Use taskwerk's full capabilities (tags, priorities, notes, dependencies)
5. Create sustainable, maintainable task structures
6. Verify your work and provide clear status updates
7. Be proactive in suggesting improvements to workflow and organization

Current working directory: {working_directory}
{context}

Guidelines for execution:
- Always read and understand the current state before making changes
- Create meaningful task names with clear, actionable descriptions
- Use appropriate tags, priorities, and notes for organization
- Consider dependencies and logical task ordering
- After making changes, verify results and suggest next steps
- Be careful with file operations - check before overwriting
- Think systematically about task organization and project structure

Remember: You are not just executing commands, you are helping build better productivity systems and workflows.

IMPORTANT: When listing or describing tasks, ONLY mention tasks that actually exist in the database. Never create example tasks or fictional task IDs. If there are no tasks, explicitly say "No tasks found" rather than creating examples. Always use the list_tasks tool to get the actual current tasks.
`);

  console.log('\n💡 Note: These prompts include placeholders:');
  console.log('  {working_directory} - Replaced with the current directory');
  console.log('  {context} - Replaced with any additional context provided');

  console.log('\n📖 To use AI features:');
  console.log('  taskwerk ask "question"     - Read-only assistance');
  console.log('  taskwerk agent "task"       - Make changes and execute tasks');
}
