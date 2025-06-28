import { TaskManager } from '../core/task-manager.js';
import { LLMManager } from '../llm/llm-manager.js';
import { loadConfig } from '../utils/config.js';

export async function askCommand(query, options = {}) {
  try {
    const config = await loadConfig();
    const taskManager = new TaskManager(config);
    const llmManager = new LLMManager(config, taskManager);

    const defaultModel = llmManager.getDefaultModel();
    const modelName = options.model || defaultModel;

    if (!(await llmManager.isModelAvailable(modelName))) {
      console.error(`❌ Model not available: ${modelName}`);
      console.error('Available options:');
      console.error('  - Set OPENAI_API_KEY environment variable for OpenAI models');
      console.error('  - Install and run Ollama (https://ollama.ai) for local models');
      console.error('  - Install and run LM Studio (https://lmstudio.ai) for local models');
      console.error('  - Use --model to specify a different model');
      console.error('\nRun "taskwerk llmconfig --list-models" to see available models');
      process.exit(1);
    }

    console.log(`🤖 Loading model: ${modelName}...`);
    await llmManager.loadModel(modelName);

    console.log('🧠 Processing your request...');
    const response = await llmManager.processNaturalLanguage(query);

    if (response.content) {
      console.log('\n💬 TaskWerk Assistant:');
      console.log(response.content);
    }

    if (response.toolResults && response.toolResults.length > 0) {
      console.log('\n📋 Actions taken:');
      for (const result of response.toolResults) {
        if (result.success) {
          console.log(`✅ ${result.result.message || 'Action completed'}`);
        } else {
          console.log(`❌ Error: ${result.error}`);
        }
      }
    }

    if (options.verbose && response.usage) {
      console.log(
        `\n📊 Token usage: ${response.usage.total_tokens} total (${response.usage.prompt_tokens} prompt, ${response.usage.completion_tokens} completion)`
      );
    }
  } catch (error) {
    console.error('❌ Failed to process request:', error.message);
    process.exit(1);
  }
}
