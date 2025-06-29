import { LLMManager } from '../llm/llm-manager.js';
import { loadConfig } from '../utils/config.js';
import { createInterface } from 'readline';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { mkdirSync } from 'fs';

/**
 * Main entry point for llmconfig command. Routes to appropriate sub-command based on options.
 * @param {Object} options - Command line options object
 * @param {boolean} [options.listModels] - List all available models
 * @param {string} [options.modelInfo] - Show info for specific model
 * @param {string} [options.setDefault] - Set default model
 * @param {string} [options.model] - Alias for setDefault
 * @param {string} [options.pull] - Pull model from Ollama
 * @param {boolean} [options.choose] - Interactive model selection
 * @param {string} [options.addKey] - Add API key for provider
 * @param {string} [options.removeKey] - Remove API key for provider
 * @param {boolean} [options.listKeys] - List configured API keys
 * @param {string} [options.testKey] - Test API key for provider
 */
export async function llmConfigCommand(options = {}) {
  try {
    const config = await loadConfig();
    const llmManager = new LLMManager(config);

    if (options.listModels) {
      await listModels(llmManager);
    } else if (options.modelInfo) {
      await showModelInfo(llmManager, options.modelInfo);
    } else if (options.setDefault) {
      await setDefaultModel(llmManager, options.setDefault);
    } else if (options.model) {
      // --model is an alias for --set-default
      await setDefaultModel(llmManager, options.model);
    } else if (options.pull) {
      await pullModel(llmManager, options.pull);
    } else if (options.choose) {
      await chooseModel(llmManager);
    } else if (options.addKey) {
      await addApiKey(options.addKey);
    } else if (options.removeKey) {
      await removeApiKey(options.removeKey);
    } else if (options.listKeys) {
      await listApiKeys();
    } else if (options.testKey) {
      await testApiKey(options.testKey);
    } else {
      await showStatus(llmManager);
    }
  } catch (error) {
    console.error('❌ Failed to manage LLM configuration:', error.message);
    process.exit(1);
  }
}

/**
 * Lists all available LLM models from all providers (OpenAI, Anthropic, Ollama, LM Studio).
 * @param {LLMManager} llmManager - LLM manager instance
 */
async function listModels(llmManager) {
  console.log('# Available LLM Models\n');

  const models = await llmManager.listAvailableModels();

  if (models.length === 0) {
    console.log('No models available.');
    console.log('\nTo enable models:');
    console.log('  - Set OPENAI_API_KEY environment variable for OpenAI models');
    console.log('  - Install and run Ollama (https://ollama.ai) for local models');
    console.log('  - Install and run LM Studio (https://lmstudio.ai) for local models');
    return;
  }

  // Group by provider
  const grouped = {};
  for (const model of models) {
    if (!grouped[model.provider]) {
      grouped[model.provider] = [];
    }
    grouped[model.provider].push(model);
  }

  for (const [provider, providerModels] of Object.entries(grouped)) {
    console.log(`## ${provider.charAt(0).toUpperCase() + provider.slice(1)} Models\n`);

    for (const model of providerModels) {
      const status = model.status === 'available' ? '✅' : '❌';

      // Parse parameter size from model name if available
      let paramSize = '';
      const sizeMatch = model.name.match(/:(\d+[bm]?)$/i);
      if (sizeMatch) {
        paramSize = sizeMatch[1].toUpperCase();
      } else if (model.size) {
        // Check if it's a reasonable parameter size (not a file size)
        const sizeStr = model.size.toString();
        if (sizeStr.match(/^\d+[BMK]?$/i) && parseInt(sizeStr) < 1000000) {
          paramSize = model.size;
        }
      }

      // Format: [PROVIDER] [MODELNAME] [PARAM_SIZE]
      const providerTag = `[${provider.toUpperCase()}]`;
      const modelName = model.name.replace(/:.*$/, ''); // Remove size suffix
      const paramTag = paramSize ? `[${paramSize}]` : '';

      console.log(`${status} ${providerTag} ${modelName} ${paramTag}`.trim());

      // Add secondary info if available
      if (model.type === 'local' && model.modified) {
        console.log(`     Modified: ${new Date(model.modified).toLocaleDateString()}`);
      }
    }
    console.log('');
  }

  const defaultModel = llmManager.getDefaultModel();
  console.log(`**Default model**: ${defaultModel}`);
}

/**
 * Shows detailed information about a specific model.
 * @param {LLMManager} llmManager - LLM manager instance
 * @param {string} modelName - Name of the model to show info for
 */
async function showModelInfo(llmManager, modelName) {
  const info = await llmManager.getModelInfo(modelName);

  console.log(`# Model Information: ${modelName}\n`);
  console.log(`- **Type**: ${info.type}`);
  console.log(`- **Provider**: ${info.provider}`);
  console.log(`- **Status**: ${info.status}`);

  if (info.type === 'remote') {
    const envKey = info.provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY';
    const hasKey = !!process.env[envKey];
    console.log(`- **API Key**: ${hasKey ? 'Configured' : 'Not configured'}`);

    if (!hasKey) {
      console.log(`\nTo use this model, set the ${envKey} environment variable.`);
    }
  }
}

/**
 * Sets the default model for taskwerk.
 * @param {LLMManager} llmManager - LLM manager instance
 * @param {string} modelName - Name of the model to set as default
 */
async function setDefaultModel(llmManager, modelName) {
  await llmManager.setDefaultModel(modelName);
  console.log(`✅ Default model set to: ${modelName}`);
}

/**
 * Shows current LLM configuration status including models, API keys, and setup guidance.
 * @param {LLMManager} llmManager - LLM manager instance
 */
async function showStatus(llmManager) {
  console.log('# LLM Configuration Status\n');

  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const defaultModel = llmManager.getDefaultModel();
  const models = await llmManager.listAvailableModels();
  const hasModels = models.length > 0;

  // Show current status
  if (defaultModel) {
    const isAvailable = await llmManager.isModelAvailable(defaultModel);
    console.log(`**Default Model**: ${defaultModel}`);
    console.log(`**Status**: ${isAvailable ? '✅ Available and ready' : '❌ Not available'}`);

    if (!isAvailable) {
      const reason = await llmManager.getModelUnavailabilityReason(defaultModel);
      console.log(`**Issue**: ${reason.message}`);
    }
  } else {
    console.log('**Default Model**: None configured');
    console.log('**Status**: ⚠️  Setup required');
  }

  console.log(`**Available Models**: ${models.length} found`);

  // Adaptive guidance based on current state
  if (hasModels && defaultModel) {
    console.log(`\n## ✅ You're all set! Try these commands:\n`);
    console.log('```bash');
    console.log('taskwerk ask "what are my current tasks?"');
    console.log('taskwerk agent "add a task to fix the login bug"');
    console.log('taskwerk llmconfig --list-models  # See all available models');
    console.log('```');
  } else if (hasModels && !defaultModel) {
    console.log('\n## 🔧 Models found! Choose your default:\n');
    console.log('```bash');
    console.log('taskwerk llmconfig --choose          # Interactive selection');
    console.log('taskwerk llmconfig --list-models     # See all options');
    console.log('```');
  } else {
    console.log('\n## 🚀 Get Started - Choose Your Setup:\n');

    if (!hasOpenAI) {
      console.log('**Option 1: Cloud AI (Recommended)**');
      console.log('```bash');
      console.log('export OPENAI_API_KEY="your-api-key-here"');
      console.log('taskwerk ask "what are my tasks?"  # Test it out');
      console.log('```');
      console.log('');
    }

    console.log('**Option 2: Free Local AI**');
    console.log('```bash');
    console.log('# Install Ollama from https://ollama.ai');
    console.log('ollama pull llama3.2:3b            # Download a model');
    console.log('taskwerk llmconfig --choose         # Select model');
    console.log('```');
    console.log('');

    console.log('**Option 3: LM Studio**');
    console.log('```bash');
    console.log('# Install LM Studio from https://lmstudio.ai');
    console.log('# Start server and load a model');
    console.log('taskwerk llmconfig --choose         # Select model');
    console.log('```');
  }

  console.log('\n## Available Commands\n');
  console.log('- `taskwerk llmconfig --choose` - Interactive model setup');
  console.log('- `taskwerk llmconfig --list-models` - List available models');
  console.log('- `taskwerk ask "question"` - Ask questions (no actions taken)');
  console.log('- `taskwerk agent "request"` - Perform actions via AI');
}

/**
 * Pulls (downloads) a model from Ollama.
 * @param {LLMManager} llmManager - LLM manager instance
 * @param {string} modelName - Name of the model to pull
 */
async function pullModel(llmManager, modelName) {
  console.log(`📥 Pulling model: ${modelName}...`);

  try {
    const { OllamaModel } = await import('../llm/providers/ollama-model.js');
    const ollama = new OllamaModel(modelName);

    if (!(await ollama.isAvailable())) {
      console.error('❌ Ollama is not running or not available');
      console.error('Please install and start Ollama from https://ollama.ai');
      process.exit(1);
    }

    await ollama.pullModel(modelName, status => {
      if (status.status) {
        const progress =
          status.completed && status.total
            ? ` (${Math.round((status.completed / status.total) * 100)}%)`
            : '';
        console.log(`📦 ${status.status}${progress}`);
      }
    });

    console.log(`✅ Successfully pulled model: ${modelName}`);
    console.log(`\nTo use this model:`);
    console.log(`taskwerk llmconfig --set-default ${modelName}`);
    console.log(`taskwerk ask "show me my tasks" --model ${modelName}`);
  } catch (error) {
    console.error(`❌ Failed to pull model: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Interactive model selection interface. Shows available models and lets user choose default.
 * @param {LLMManager} llmManager - LLM manager instance
 */
async function chooseModel(llmManager) {
  console.log('🤖 Interactive LLM Model Selection\n');

  const models = await llmManager.listAvailableModels();

  if (models.length === 0) {
    console.log('❌ No models available.');
    console.log('\n📋 Setup Guide:');
    console.log('1. For OpenAI models: taskwerk llmconfig --add-key openai');
    console.log('2. For Claude models: taskwerk llmconfig --add-key anthropic');
    console.log('3. For local models: Install Ollama (https://ollama.ai)');
    console.log('4. For local models: Install LM Studio (https://lmstudio.ai)');
    console.log('\nOnce setup, run this command again to choose a model.');
    return;
  }

  // Group models by provider for better display
  const grouped = {};
  for (const model of models) {
    if (!grouped[model.provider]) {
      grouped[model.provider] = [];
    }
    grouped[model.provider].push(model);
  }

  console.log('Available models:');
  let index = 1;
  const modelMap = {};

  for (const [provider, providerModels] of Object.entries(grouped)) {
    console.log(`\n📦 ${provider.charAt(0).toUpperCase() + provider.slice(1)} Models:`);

    for (const model of providerModels) {
      let info = `${model.name} (${model.type})`;

      if (model.size) {
        const sizeMB = Math.round(model.size / 1024 / 1024);
        info += ` - ${sizeMB}MB`;
      }

      console.log(`  ${index}. ${info}`);
      modelMap[index] = model;
      index++;
    }
  }

  const currentDefault = llmManager.getDefaultModel();
  console.log(`\n📌 Current default: ${currentDefault}`);

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await askQuestion(rl, '\n🔢 Enter model number (or press Enter to cancel): ');

    if (!answer.trim()) {
      console.log('🚫 Selection cancelled.');
      return;
    }

    const modelNumber = parseInt(answer.trim());
    const selectedModel = modelMap[modelNumber];

    if (!selectedModel) {
      console.log('❌ Invalid selection. Please choose a valid model number.');
      return;
    }

    console.log(`\n🎯 Selected: ${selectedModel.name} (${selectedModel.provider})`);

    const confirm = await askQuestion(rl, 'Set as default model? (y/N): ');

    if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes') {
      await llmManager.setDefaultModel(selectedModel.name);
      console.log(`✅ Default model set to: ${selectedModel.name}`);

      console.log('\n🚀 Quick test:');
      console.log(`taskwerk ask "show me my tasks" --model ${selectedModel.name}`);
    } else {
      console.log('🚫 Model not set as default.');
      console.log(`\n💡 To set later: taskwerk llmconfig --set-default ${selectedModel.name}`);
    }
  } finally {
    rl.close();
  }
}

/**
 * Helper function to ask a question via readline interface.
 * @param {readline.Interface} rl - Readline interface
 * @param {string} question - Question to ask
 * @returns {Promise<string>} User's answer
 */
function askQuestion(rl, question) {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer);
    });
  });
}

// API Key Management Functions

function getConfigPath() {
  const configDir = join(homedir(), '.taskwerk');
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
  return join(configDir, 'keys.json');
}

/**
 * Loads API keys from the configuration file.
 * @returns {Object} Object containing API keys by provider
 */
function loadApiKeys() {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    return {};
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('⚠️  Failed to load API keys:', error.message);
    return {};
  }
}

/**
 * Saves API keys to the configuration file.
 * @param {Object} keys - Object containing API keys by provider
 */
function saveApiKeys(keys) {
  const configPath = getConfigPath();

  try {
    writeFileSync(configPath, JSON.stringify(keys, null, 2));
  } catch (error) {
    console.error('❌ Failed to save API keys:', error.message);
    throw error;
  }
}

/**
 * Adds an API key for the specified provider via interactive prompt.
 * @param {string} provider - Provider name (openai or anthropic)
 */
async function addApiKey(provider) {
  const validProviders = ['openai', 'anthropic'];

  if (!validProviders.includes(provider.toLowerCase())) {
    console.error(`❌ Invalid provider: ${provider}`);
    console.error(`Valid providers: ${validProviders.join(', ')}`);
    process.exit(1);
  }

  console.log(`🔑 Adding API key for ${provider.toUpperCase()}`);

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const apiKey = await askQuestion(
      rl,
      `Enter your ${provider.toUpperCase()} API key (input will be hidden): `
    );

    if (!apiKey.trim()) {
      console.log('❌ No API key provided.');
      return;
    }

    // Basic validation
    const expectedPrefixes = {
      openai: 'sk-',
      anthropic: 'sk-ant-',
    };

    const expectedPrefix = expectedPrefixes[provider.toLowerCase()];
    if (expectedPrefix && !apiKey.trim().startsWith(expectedPrefix)) {
      console.log(
        `⚠️  Warning: ${provider.toUpperCase()} API keys typically start with "${expectedPrefix}"`
      );
      const confirm = await askQuestion(rl, 'Continue anyway? (y/N): ');
      if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
        console.log('❌ API key not saved.');
        return;
      }
    }

    // Save the key
    const keys = loadApiKeys();
    keys[provider.toLowerCase()] = apiKey.trim();
    saveApiKeys(keys);

    console.log(`✅ API key for ${provider.toUpperCase()} saved successfully!`);
    console.log('\n💡 Test your API key with:');
    console.log(`taskwerk llmconfig --test-key ${provider.toLowerCase()}`);
  } finally {
    rl.close();
  }
}

/**
 * Removes an API key for the specified provider.
 * @param {string} provider - Provider name (openai or anthropic)
 */
async function removeApiKey(provider) {
  const validProviders = ['openai', 'anthropic'];

  if (!validProviders.includes(provider.toLowerCase())) {
    console.error(`❌ Invalid provider: ${provider}`);
    console.error(`Valid providers: ${validProviders.join(', ')}`);
    process.exit(1);
  }

  const keys = loadApiKeys();
  const providerKey = provider.toLowerCase();

  if (!keys[providerKey]) {
    console.log(`⚠️  No API key found for ${provider.toUpperCase()}`);
    return;
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const confirm = await askQuestion(
      rl,
      `Are you sure you want to remove the ${provider.toUpperCase()} API key? (y/N): `
    );

    if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes') {
      delete keys[providerKey];
      saveApiKeys(keys);
      console.log(`✅ API key for ${provider.toUpperCase()} removed successfully!`);
    } else {
      console.log('❌ API key removal cancelled.');
    }
  } finally {
    rl.close();
  }
}

/**
 * Lists all configured API keys (masked for security).
 */
async function listApiKeys() {
  const keys = loadApiKeys();
  const envKeys = {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
  };

  console.log('# API Key Configuration\n');

  const providers = ['openai', 'anthropic'];
  let hasAnyKeys = false;

  for (const provider of providers) {
    const storedKey = keys[provider];
    const envKey = envKeys[provider];

    console.log(`## ${provider.toUpperCase()}`);

    if (storedKey) {
      const maskedKey =
        storedKey.substring(0, 8) + '...' + storedKey.substring(storedKey.length - 4);
      console.log(`✅ Stored API key: ${maskedKey}`);
      hasAnyKeys = true;
    } else if (envKey) {
      const maskedKey = envKey.substring(0, 8) + '...' + envKey.substring(envKey.length - 4);
      console.log(`🔧 Environment variable: ${maskedKey}`);
      hasAnyKeys = true;
    } else {
      console.log('❌ No API key configured');
    }

    console.log('');
  }

  if (!hasAnyKeys) {
    console.log('⚠️  No API keys configured.');
    console.log('\n💡 Add an API key with:');
    console.log('taskwerk llmconfig --add-key openai');
    console.log('taskwerk llmconfig --add-key anthropic');
  } else {
    console.log('💡 Priority: Stored keys override environment variables');
    console.log('💡 Test your keys with: taskwerk llmconfig --test-key <provider>');
  }
}

/**
 * Tests an API key for the specified provider.
 * @param {string} provider - Provider name (openai or anthropic)
 */
async function testApiKey(provider) {
  const validProviders = ['openai', 'anthropic'];

  if (!validProviders.includes(provider.toLowerCase())) {
    console.error(`❌ Invalid provider: ${provider}`);
    console.error(`Valid providers: ${validProviders.join(', ')}`);
    process.exit(1);
  }

  console.log(`🧪 Testing ${provider.toUpperCase()} API key...`);

  const keys = loadApiKeys();
  const storedKey = keys[provider.toLowerCase()];
  const envKey = process.env[provider.toUpperCase() + '_API_KEY'];
  const apiKey = storedKey || envKey;

  if (!apiKey) {
    console.log(`❌ No API key found for ${provider.toUpperCase()}`);
    console.log(`\n💡 Add one with: taskwerk llmconfig --add-key ${provider.toLowerCase()}`);
    return;
  }

  try {
    if (provider.toLowerCase() === 'openai') {
      await testOpenAIKey(apiKey);
    } else if (provider.toLowerCase() === 'anthropic') {
      await testAnthropicKey(apiKey);
    }
  } catch (error) {
    console.log(`❌ API key test failed: ${error.message}`);
    console.log('\n💡 Check that your API key is valid and has sufficient credits');
  }
}

/**
 * Tests an OpenAI API key by making a models list request.
 * @param {string} apiKey - OpenAI API key to test
 * @returns {Promise<boolean>} Whether the key is valid
 */
async function testOpenAIKey(apiKey) {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ OpenAI API key is valid! Found ${data.data.length} available models.`);
    } else {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }
  } catch (error) {
    throw new Error(`Connection failed: ${error.message}`);
  }
}

/**
 * Tests an Anthropic API key by making a simple request.
 * @param {string} apiKey - Anthropic API key to test
 * @returns {Promise<boolean>} Whether the key is valid
 */
async function testAnthropicKey(apiKey) {
  try {
    // Anthropic doesn't have a simple models endpoint, so we'll make a minimal completion request
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    });

    if (response.ok) {
      console.log('✅ Anthropic API key is valid!');
    } else {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }
  } catch (error) {
    throw new Error(`Connection failed: ${error.message}`);
  }
}
