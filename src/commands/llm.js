import { Command } from 'commander';
import { LLMManager } from '../ai/llm-manager.js';
import { Logger } from '../logging/logger.js';
import fs from 'fs/promises';
import { TaskwerkAPI } from '../api/taskwerk-api.js';

export function llmCommand() {
  const llm = new Command('llm');

  llm
    .description('Send a prompt directly to the configured LLM')
    .argument('[prompt...]', 'The prompt to send')
    .option('-f, --file <path>', 'Read prompt from file')
    .option('-p, --params <key=value...>', 'Parameters for prompt substitution', collectParams, {})
    .option('--provider <name>', 'Override provider for this request')
    .option('--model <name>', 'Override model for this request')
    .option('-s, --system <prompt>', 'System prompt')
    .option('--temperature <num>', 'Override temperature (0-2)', parseFloat)
    .option('--max-tokens <num>', 'Override max tokens (default: 8192)', parseInt)
    .option('--context-tasks', 'Include current tasks as context')
    .option('--no-stream', 'Disable streaming output')
    .option('--raw', 'Output raw response without formatting')
    .option('--verbose', 'Show metadata (provider, model, token usage)')
    .option('--quiet', 'Suppress all output except the response (deprecated, inverse of --verbose)')
    .action(async (promptArgs, options) => {
      const logger = new Logger('llm');
      const llmManager = new LLMManager();

      try {
        // Get the prompt from various sources
        let prompt = await getPrompt(promptArgs, options);
        
        if (!prompt) {
          console.error('❌ No prompt provided. Use arguments, --file, or pipe input.');
          process.exit(1);
        }

        // Apply parameter substitution
        if (options.params) {
          prompt = substituteParams(prompt, options.params);
        }

        // Build context if requested
        let context = '';
        if (options.contextTasks) {
          context = await buildTaskContext();
        }

        // Build messages array
        const messages = [];
        
        if (options.system) {
          messages.push({ role: 'system', content: options.system });
        }
        
        if (context) {
          messages.push({ role: 'system', content: `Current tasks context:\n${context}` });
        }
        
        messages.push({ role: 'user', content: prompt });

        // Prepare completion parameters
        const completionParams = {
          messages,
          temperature: options.temperature,
          maxTokens: options.maxTokens || 8192,  // Default to 8192 tokens
          stream: options.stream,
          onChunk: options.stream ? (chunk) => process.stdout.write(chunk) : undefined
        };

        // Add provider/model overrides if specified
        if (options.provider) {
          completionParams.provider = options.provider;
        }
        if (options.model) {
          completionParams.model = options.model;
        }

        // Show what we're doing (only if verbose)
        if (options.verbose || (!options.quiet && options.quiet !== undefined)) {
          const provider = options.provider || llmManager.getConfigSummary().current_provider;
          const model = options.model || llmManager.getConfigSummary().current_model;
          console.error(`[${new Date().toISOString()}] [INFO] [llm] Using ${provider} with model ${model}`);
        }
        
        // Log the LLM request
        const provider = options.provider || llmManager.getConfigSummary().current_provider;
        const model = options.model || llmManager.getConfigSummary().current_model;
        logger.info(`LLM request to ${provider}/${model}`);

        // Execute the completion
        const result = await llmManager.complete(completionParams);

        // Handle output
        if (!options.stream) {
          if (options.raw) {
            process.stdout.write(result.content);
          } else {
            console.log(result.content);
          }
        } else if (options.stream && !options.raw) {
          // Add newline after streaming if not raw
          console.log();
        }

        // Show usage stats only if verbose
        if ((options.verbose || (!options.quiet && options.quiet !== undefined)) && result.usage) {
          console.error(`\n📊 Tokens - Prompt: ${result.usage.prompt_tokens}, Response: ${result.usage.completion_tokens}`);
        }

      } catch (error) {
        logger.error('LLM request failed', error);
        console.error('❌ LLM request failed:', error.message);
        process.exit(1);
      }
    });

  return llm;
}

/**
 * Get prompt from various sources
 */
async function getPrompt(promptArgs, options) {
  // Priority 1: Command line arguments
  if (promptArgs && promptArgs.length > 0) {
    return promptArgs.join(' ');
  }

  // Priority 2: File
  if (options.file) {
    try {
      return await fs.readFile(options.file, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }

  // Priority 3: Check if stdin is piped
  if (!process.stdin.isTTY) {
    return await readStdin();
  }

  return null;
}

/**
 * Read from stdin
 */
function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    
    process.stdin.setEncoding('utf8');
    
    process.stdin.on('data', chunk => {
      data += chunk;
    });
    
    process.stdin.on('end', () => {
      resolve(data.trim());
    });
    
    process.stdin.on('error', reject);
  });
}

/**
 * Substitute parameters in prompt
 */
function substituteParams(prompt, params) {
  let result = prompt;
  
  for (const [key, value] of Object.entries(params)) {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    result = result.replace(regex, value);
  }
  
  return result;
}

/**
 * Collect key=value parameters
 */
function collectParams(value, previous) {
  const params = previous || {};
  const [key, ...valueParts] = value.split('=');
  const val = valueParts.join('='); // Handle values with = in them
  
  if (key && val) {
    params[key] = val;
  }
  
  return params;
}

/**
 * Build task context for the prompt
 */
async function buildTaskContext() {
  try {
    const api = new TaskwerkAPI();
    const tasks = api.listTasks({ 
      status: ['todo', 'in-progress', 'blocked'],
      limit: 20 
    });
    
    if (tasks.length === 0) {
      return 'No active tasks.';
    }
    
    let context = 'Active tasks:\n';
    tasks.forEach(task => {
      context += `- ${task.id}: ${task.name} (${task.status}, ${task.priority})\n`;
      if (task.assignee) {
        context += `  Assignee: ${task.assignee}\n`;
      }
    });
    
    return context;
  } catch (error) {
    // If we can't get tasks, just return empty context
    return '';
  }
}