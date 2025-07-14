import { Command } from 'commander';
import { LLMManager } from '../ai/llm-manager.js';
import { Logger } from '../logging/logger.js';
import inquirer from 'inquirer';

export function aiconfigCommand() {
  const aiconfig = new Command('aiconfig');

  aiconfig
    .description('Configure AI/LLM settings')
    .option('--set <key=value>', 'Set a configuration value (e.g., provider.api_key)')
    .option('--list-providers', 'List available AI providers')
    .option('--list-models [provider]', 'List available models for provider')
    .option('--choose', 'Interactively choose provider and model')
    .option('--provider <name>', 'Set the current provider (non-interactive)')
    .option('--model <name>', 'Set the current model (non-interactive)')
    .option('--test', 'Test connection to configured providers')
    .option('--show', 'Show current AI configuration')
    .action(async (options) => {
      const logger = new Logger('aiconfig');
      const llmManager = new LLMManager();

      try {
        // Handle different options
        if (options.listProviders) {
          await listProviders(llmManager);
        } else if (options.listModels !== undefined) {
          await listModels(llmManager, options.listModels);
        } else if (options.choose) {
          await chooseProviderAndModel(llmManager);
        } else if (options.provider && options.model) {
          await setProviderAndModel(llmManager, options.provider, options.model);
        } else if (options.provider) {
          console.error('❌ --model is required when setting --provider');
          process.exit(1);
        } else if (options.model) {
          console.error('❌ --provider is required when setting --model');
          process.exit(1);
        } else if (options.test) {
          await testProviders(llmManager);
        } else if (options.set) {
          await setConfig(llmManager, options.set);
        } else if (options.show) {
          await showConfig(llmManager);
        } else {
          // Default: show current config
          await showConfig(llmManager);
        }
      } catch (error) {
        logger.error('Configuration failed', error);
        console.error('❌ Configuration failed:', error.message);
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

async function setProviderAndModel(llmManager, providerName, modelName) {
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
    llmManager.setCurrentProvider(providerName, modelName);
    
    console.log(`✅ Configuration updated:`);
    console.log(`   Provider: ${providerName}`);
    console.log(`   Model: ${modelName}`);
    
  } catch (error) {
    console.error(`❌ Failed to set provider/model: ${error.message}`);
    process.exit(1);
  }
}

async function chooseProviderAndModel(llmManager) {
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
          status: firstModel.description 
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
        status: 'Not configured'
      });
    }
  }

  const workingProviders = availableProviders.filter(p => !p.disabled);
  console.log(`Found models from ${workingProviders.length} providers\n`);

  if (workingProviders.length === 0) {
    console.log('❌ No working providers found.');
    
    // Show status of problematic providers
    const problemProviders = availableProviders.filter(p => p.disabled);
    if (problemProviders.length > 0) {
      console.log('\n⚠️  Provider issues:');
      for (const p of problemProviders) {
        console.log(`   ${p.provider}: ${p.status}`);
      }
    }
    
    console.log('\n💡 Configure a provider first:');
    console.log('   taskwerk aiconfig --set <provider>.api_key=<your-key>');
    return;
  }

  // Choose provider
  const providerChoices = workingProviders.map(p => ({
    name: `${p.provider} (${p.models.length} models)`,
    value: p.provider
  }));

  const { selectedProvider } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedProvider',
      message: 'Select AI provider:',
      choices: providerChoices
    }
  ]);

  // Choose model
  const providerData = workingProviders.find(p => p.provider === selectedProvider);
  const modelChoices = providerData.models.map(m => ({
    name: `${m.name}${m.description ? ` - ${m.description}` : ''}`,
    value: m.id
  }));

  const { selectedModel } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedModel',
      message: 'Select model:',
      choices: modelChoices,
      pageSize: 10
    }
  ]);

  // Save selection
  llmManager.setCurrentProvider(selectedProvider, selectedModel);

  console.log(`\n✅ Configuration saved:`);
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

async function setConfig(llmManager, configString) {
  // Parse the config string (e.g., "anthropic.api_key=sk-ant-...")
  const match = configString.match(/^([^.]+)\.([^=]+)=(.+)$/);
  if (!match) {
    throw new Error('Invalid configuration format. Use: provider.key=value');
  }

  const [, provider, key, value] = match;

  // Special handling for provider-level settings
  if (key === 'api_key' || key === 'enabled' || key === 'base_url') {
    llmManager.configureProvider(provider, key, value);
    console.log(`✅ Set ${provider}.${key}`);

    // Test the connection if we just set an API key
    if (key === 'api_key') {
      console.log('\n🧪 Testing connection...');
      const providerInstance = llmManager.getProvider(provider);
      const result = await providerInstance.testConnection();
      const icon = result.success ? '✅' : '❌';
      console.log(`${icon} ${result.message}`);
    }
  } else {
    throw new Error(`Unknown configuration key: ${key}`);
  }
}

async function showConfig(llmManager) {
  const config = llmManager.getConfigSummary();

  console.log('🤖 AI Configuration');
  console.log('─'.repeat(50));
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

  console.log('\n💡 Commands:');
  console.log('  Configure provider:  taskwerk aiconfig --set <provider>.api_key=<key>');
  console.log('  Choose model:        taskwerk aiconfig --choose');
  console.log('  Test connections:    taskwerk aiconfig --test');
}