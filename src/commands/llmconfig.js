import { LLMManager } from '../llm/llm-manager.js';
import { loadConfig } from '../utils/config.js';
import { createInterface } from 'readline';

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
    } else if (options.pull) {
      await pullModel(llmManager, options.pull);
    } else if (options.choose) {
      await chooseModel(llmManager);
    } else {
      await showStatus(llmManager);
    }
  } catch (error) {
    console.error('❌ Failed to manage LLM configuration:', error.message);
    process.exit(1);
  }
}

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
      let info = `${status} **${model.name}** (${model.type})`;

      if (model.size) {
        info += ` - ${model.size}`;
      }
      if (model.modified) {
        info += ` - Modified: ${new Date(model.modified).toLocaleDateString()}`;
      }

      console.log(info);
    }
    console.log('');
  }

  const defaultModel = llmManager.getDefaultModel();
  console.log(`**Default model**: ${defaultModel}`);
}

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

async function setDefaultModel(llmManager, modelName) {
  await llmManager.setDefaultModel(modelName);
  console.log(`✅ Default model set to: ${modelName}`);
}

async function showStatus(llmManager) {
  console.log('# LLM Configuration Status\n');

  const defaultModel = llmManager.getDefaultModel();
  const isAvailable = await llmManager.isModelAvailable(defaultModel);

  console.log(`**Default Model**: ${defaultModel}`);
  console.log(`**Status**: ${isAvailable ? '✅ Available' : '❌ Not available'}`);

  console.log('\n## Quick Setup\n');
  console.log('```bash');
  console.log('# Option 1: OpenAI API');
  console.log('export OPENAI_API_KEY="your-api-key-here"');
  console.log('');
  console.log('# Option 2: Local with Ollama');
  console.log('# Install from https://ollama.ai');
  console.log('ollama pull llama3.2');
  console.log('');
  console.log('# Option 3: Local with LM Studio');
  console.log('# Install from https://lmstudio.ai and start server');
  console.log('');
  console.log('# Test the assistant');
  console.log('taskwerk ask "show me my tasks"');
  console.log('```');

  console.log('\n## Available Commands\n');
  console.log('- `taskwerk llmconfig --list-models` - List available models');
  console.log('- `taskwerk llmconfig --model-info <model>` - Show model details');
  console.log('- `taskwerk llmconfig --set-default <model>` - Set default model');
  console.log('- `taskwerk ask "your question"` - Ask the AI assistant');
}

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

async function chooseModel(llmManager) {
  console.log('🤖 Interactive LLM Model Selection\n');

  const models = await llmManager.listAvailableModels();

  if (models.length === 0) {
    console.log('❌ No models available.');
    console.log('\n📋 Setup Guide:');
    console.log('1. For OpenAI models: export OPENAI_API_KEY="your-key-here"');
    console.log('2. For local models: Install Ollama (https://ollama.ai)');
    console.log('3. For local models: Install LM Studio (https://lmstudio.ai)');
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

function askQuestion(rl, question) {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer);
    });
  });
}
