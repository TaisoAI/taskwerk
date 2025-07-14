import { Command } from 'commander';
import { LLMManager } from '../ai/llm-manager.js';
import { ToolExecutor } from '../ai/tool-executor.js';
import { Logger } from '../logging/logger.js';
import inquirer from 'inquirer';
import chalk from 'chalk';

export function askCommand() {
  const ask = new Command('ask');

  ask
    .description('Ask AI assistant about tasks and files (read-only)')
    .argument('[question...]', 'Your question')
    .option('-f, --file <path>', 'Include file content in context')
    .option('-t, --tasks', 'Include current tasks in context')
    .option('--provider <name>', 'Override AI provider')
    .option('--model <name>', 'Override AI model')
    .option('--no-tools', 'Disable tool usage')
    .option('--verbose', 'Show detailed execution info')
    .action(async (questionArgs, options) => {
      const logger = new Logger('ask');
      const llmManager = new LLMManager();
      
      try {
        // Get the question
        const question = questionArgs.join(' ');
        if (!question) {
          console.error('❌ Please provide a question');
          process.exit(1);
        }

        // Initialize tool executor
        const toolExecutor = new ToolExecutor({
          mode: 'ask',
          workDir: process.cwd(),
          confirmPermission: async (tool, action, params) => {
            // In ask mode, we don't need permissions for read-only operations
            return true;
          }
        });

        // Build context
        let context = '';
        
        if (options.file) {
          const readTool = toolExecutor.registry.get('read_file');
          const result = await readTool.execute({ path: options.file });
          context += `\nFile content (${options.file}):\n${result.content}\n`;
        }
        
        if (options.tasks) {
          const listTool = toolExecutor.registry.get('list_tasks');
          const tasks = await listTool.execute({ limit: 20 });
          context += `\nCurrent tasks:\n${JSON.stringify(tasks, null, 2)}\n`;
        }

        // Build messages
        const messages = [
          {
            role: 'system',
            content: `You are a helpful AI assistant for Taskwerk, a task management system.
You have access to tools to read files and query tasks. You cannot modify anything.
Current working directory: ${process.cwd()}
${context ? `\nContext:\n${context}` : ''}`
          },
          {
            role: 'user',
            content: question
          }
        ];

        // Prepare completion parameters
        const completionParams = {
          messages,
          temperature: 0.7,
          maxTokens: 8192,
          tools: options.tools !== false ? toolExecutor.getToolSpecs() : undefined
        };

        // Add provider/model overrides
        if (options.provider) {
          completionParams.provider = options.provider;
        }
        if (options.model) {
          completionParams.model = options.model;
        }

        if (options.verbose) {
          console.error(chalk.gray('🤔 Thinking...'));
        }

        // Execute completion
        const response = await llmManager.complete(completionParams);
        
        // Handle tool calls if present
        if (response.tool_calls && response.tool_calls.length > 0) {
          if (options.verbose) {
            console.error(chalk.gray(`\n🔧 Using ${response.tool_calls.length} tools...`));
          }

          const toolResults = await toolExecutor.executeTools(response.tool_calls);
          
          // Add tool results to messages
          messages.push({
            role: 'assistant',
            content: response.content || '',
            tool_calls: response.tool_calls
          });
          
          for (const result of toolResults) {
            messages.push({
              role: 'tool',
              tool_call_id: result.tool_call_id,
              content: result.content
            });
          }

          // Get final response
          const finalResponse = await llmManager.complete({
            ...completionParams,
            messages,
            tools: undefined // No more tools for final response
          });

          console.log(finalResponse.content);
        } else {
          // No tool calls, just display response
          console.log(response.content);
        }

        if (options.verbose && response.usage) {
          console.error(chalk.gray(`\n📊 Tokens used: ${response.usage.prompt_tokens + response.usage.completion_tokens}`));
        }

      } catch (error) {
        logger.error('Ask failed:', error);
        console.error('❌ Ask failed:', error.message);
        process.exit(1);
      }
    });

  return ask;
}