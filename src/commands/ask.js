import { Command } from 'commander';
import { LLMManager } from '../ai/llm-manager.js';
import { ToolExecutor } from '../ai/tool-executor.js';
import { Logger } from '../logging/logger.js';
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
          verbose: options.verbose,
          confirmPermission: async (_tool, _action, _params) => {
            // In ask mode, we don't need permissions for read-only operations
            return true;
          },
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
            content: `You are an AI assistant for Taskwerk (twrk), a powerful command-line task management and productivity system.

Your role is to help users with:
- Task management and planning
- Project organization 
- Workflow optimization
- Understanding their current tasks and priorities
- Suggesting taskwerk commands and features
- Analyzing task data and progress

You have read-only access to:
- Files in the current directory
- Current tasks and their status
- Task history and metadata

Key principles:
1. Always think in terms of tasks, projects, and productivity
2. Suggest relevant taskwerk commands when appropriate
3. Help break down complex goals into manageable tasks
4. Focus on actionable insights and recommendations
5. When answering general questions, try to relate them back to task management or productivity

Current working directory: ${process.cwd()}
${context ? `\nContext:\n${context}` : ''}

Remember: You can read and analyze, but cannot modify files or tasks. For modifications, suggest the user use 'taskwerk agent' instead.`,
          },
          {
            role: 'user',
            content: question,
          },
        ];

        // Prepare completion parameters
        const completionParams = {
          messages,
          temperature: 0.7,
          maxTokens: 8192,
          tools: options.tools !== false ? toolExecutor.getToolSpecs() : undefined,
          verbose: options.verbose,
        };

        // Add provider/model overrides
        if (options.provider) {
          completionParams.provider = options.provider;
        }
        if (options.model) {
          completionParams.model = options.model;
        }

        // Show thinking indicator for longer operations (only if stderr is a TTY)
        let thinkingTimer;
        if (process.stderr.isTTY && !options.verbose) {
          thinkingTimer = setTimeout(() => {
            process.stderr.write('🤔 Working on it...\n');
          }, 2000); // Show after 2 seconds
        } else if (options.verbose) {
          console.error(chalk.gray('🤔 Thinking...'));
        }

        // Execute completion
        const response = await llmManager.complete(completionParams);

        // Clear thinking timer
        if (thinkingTimer) {
          clearTimeout(thinkingTimer);
        }

        // Handle tool calls if present
        if (response.tool_calls && response.tool_calls.length > 0) {
          if (options.verbose) {
            console.error(chalk.gray(`\n🔧 Using ${response.tool_calls.length} tools...`));
          }

          const toolResults = await toolExecutor.executeTools(response.tool_calls, {
            verbose: options.verbose,
          });

          // Add tool results to messages
          messages.push({
            role: 'assistant',
            content: response.content || '',
            tool_calls: response.tool_calls,
          });

          for (const result of toolResults) {
            messages.push({
              role: 'tool',
              tool_call_id: result.tool_call_id,
              content: result.content,
            });
          }

          // Get final response
          const finalResponse = await llmManager.complete({
            ...completionParams,
            messages,
            tools: undefined, // No more tools for final response
          });

          process.stdout.write(finalResponse.content);
        } else {
          // No tool calls, just display response
          // Output just the response content
          process.stdout.write(response.content);
        }

        if (options.verbose && response.usage) {
          console.error(
            chalk.gray(
              `\n📊 Tokens used: ${response.usage.prompt_tokens + response.usage.completion_tokens}`
            )
          );
        }
      } catch (error) {
        logger.error('Ask failed:', error);
        console.error('❌ Ask failed:', error.message);
        process.exit(1);
      }
    });

  return ask;
}
