import { TaskManager } from '../core/task-manager.js';
import { LLMManager } from '../llm/llm-manager.js';
import { loadConfig } from '../utils/config.js';

export async function agentCommand(query, options = {}) {
  try {
    const config = await loadConfig();
    const taskManager = new TaskManager(config);
    const llmManager = new LLMManager(config, taskManager);

    const defaultModel = llmManager.getDefaultModel();

    if (!options.model && !defaultModel) {
      console.error('❌ No model specified and no default model configured.');
      console.error('\n🔧 Quick setup (choose one):');
      console.error('   taskwerk llmconfig --choose                # Interactive model selection');
      console.error(
        '   taskwerk llmconfig --model llama3.2:1b     # Set specific model as default'
      );
      console.error(
        '   taskwerk agent "request" --model gpt-4     # Use model once (saves as default)'
      );
      console.error('\n📚 Full setup guide:');
      console.error('   taskwerk llmconfig');
      process.exit(1);
    }

    const modelName = options.model || defaultModel;

    // If user specified a model via --model, save it as the new default
    if (options.model && options.model !== defaultModel) {
      try {
        await llmManager.setDefaultModel(options.model);
        if (options.verbose || !defaultModel) {
          console.log(`💾 Saved ${options.model} as default model`);
        }
      } catch (error) {
        // Continue anyway - just warn if we can't save
        if (options.verbose) {
          console.warn(`Warning: Could not save ${options.model} as default: ${error.message}`);
        }
      }
    }

    if (!(await llmManager.isModelAvailable(modelName))) {
      const reason = await llmManager.getModelUnavailabilityReason(modelName);

      console.error(`❌ Model not available: ${modelName}`);
      console.error(`\n${reason.message}`);

      if (reason.reason === 'missing_api_key') {
        console.error('\n🔧 Quick setup:');
        console.error(`   export ${reason.envKey}="your-api-key-here"`);
        console.error('\n💡 Alternative options:');
        console.error('   - Install Ollama (https://ollama.ai) for free local models');
        console.error('   - Install LM Studio (https://lmstudio.ai) for local models');
      } else if (reason.reason === 'service_unavailable' && reason.provider === 'ollama') {
        console.error('\n🔧 To fix this:');
        console.error('   ollama serve');
        console.error('\n💡 Or try a cloud model:');
        console.error(
          '   export OPENAI_API_KEY="your-key" && taskwerk agent "your request" --model gpt-4'
        );
      } else if (reason.reason === 'model_not_found' && reason.provider === 'ollama') {
        console.error('\n🔧 To fix this:');
        console.error(`   ollama pull ${reason.modelName}`);
        console.error('\n💡 Or see available models:');
        console.error('   ollama list');
      } else if (reason.reason === 'service_error') {
        console.error('\n🔧 Installation needed:');
        if (reason.provider === 'ollama') {
          console.error('   Visit https://ollama.ai to install Ollama');
        } else if (reason.provider === 'lmstudio') {
          console.error('   Visit https://lmstudio.ai to install LM Studio');
        }
        console.error('\n💡 Or try a cloud model:');
        console.error(
          '   export OPENAI_API_KEY="your-key" && taskwerk agent "your request" --model gpt-4'
        );
      }

      console.error('\n🔍 See all available models:');
      console.error('   taskwerk llmconfig --list-models');
      console.error('\n📚 Full setup guide:');
      console.error('   taskwerk llmconfig');

      process.exit(1);
    }

    if (options.verbose) {
      console.log(`🤖 Loading model: ${modelName}...`);
    }
    await llmManager.loadModel(modelName);

    console.log('🚀 Agent processing your request...');
    const response = await llmManager.processNaturalLanguage(query);

    if (response.content) {
      console.log('\n💬 TaskWerk Agent:');
      console.log(response.content);
    }

    if (response.toolResults && response.toolResults.length > 0) {
      console.log('\n📋 Actions taken:');
      for (const result of response.toolResults) {
        if (result.success) {
          if (result.result && typeof result.result === 'object') {
            // Display meaningful output for different result types
            if (Array.isArray(result.result)) {
              console.log(`✅ Found ${result.result.length} items`);
              if (result.result.length > 0 && result.result[0].id) {
                // Display tasks
                result.result.forEach(task => {
                  console.log(`   - ${task.id}: ${task.description} (${task.status})`);
                });
              }
            } else if (result.result.message) {
              console.log(`✅ ${result.result.message}`);
            } else {
              console.log(`✅ Action completed successfully`);
            }
          } else {
            console.log(`✅ ${result.result || 'Action completed'}`);
          }
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
    console.error('❌ Failed to process agent request:', error.message);
    process.exit(1);
  }
}
