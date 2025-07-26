import { Command } from 'commander';
import { LLMManager } from '../ai/llm-manager.js';
import { ToolExecutor } from '../ai/tool-executor.js';
import { Logger } from '../logging/logger.js';
import {
  generateCommandReference,
  generateToolReference,
  getStandardTaskCommands,
} from '../utils/command-reference.js';
import { ContextManager } from '../chat/context-manager.js';
import { TaskwerkDatabase } from '../db/database.js';
import { displayActiveContext } from './context-display.js';
import chalk from 'chalk';

export function askCommand() {
  const ask = new Command('ask');

  ask
    .description('Ask AI assistant about tasks and files (read-only, maintains chat context)')
    .argument('[question...]', 'Your question')
    .option('-f, --file <path>', 'Include file content in context')
    .option('-t, --tasks', 'Include current tasks in context')
    .option('--context <name>', 'Use named global context (outside projects)')
    .option('--new', 'Start a new conversation (ignore previous context)')
    .option('--provider <name>', 'Override AI provider')
    .option('--model <name>', 'Override AI model')
    .option('--no-tools', 'Disable tool usage')
    .option('--verbose', 'Show detailed execution info')
    .option('--quiet', 'Hide context display')
    .addHelpText(
      'after',
      `
Examples:
  $ twrk ask "What are my high priority tasks?"
  $ twrk ask -t "Analyze my task completion rate"
  $ twrk ask -f README.md "Summarize this file"
  $ twrk ask --context work "What ideas did we discuss?"
  $ twrk ask --new "Let's talk about something different"

Chat Context:
  • In a project: Conversations are maintained automatically per-project
  • Outside projects: Uses a general global context by default
  • Named contexts: Use --context <name> for topic-specific conversations
  • Fresh start: Use --new to begin a new conversation

The AI assistant has read-only access and can help with:
  • Understanding and analyzing your tasks
  • Planning and prioritization
  • Suggesting taskwerk commands
  • Reading and summarizing files
  • Answering questions about your project`
    )
    .action(async (questionArgs, options) => {
      const logger = new Logger('ask');
      const llmManager = new LLMManager();
      let db;
      let contextManager;
      let context;

      try {
        // Get the question
        const question = questionArgs.join(' ');
        if (!question) {
          console.error('❌ Please provide a question');
          process.exit(1);
        }

        // Initialize database and context manager
        try {
          // Try project database first
          db = new TaskwerkDatabase();
          await db.connect();
          contextManager = new ContextManager(db.getDB(), { verbose: options.verbose });
        } catch (error) {
          // Fall back to global database
          const globalDb = new TaskwerkDatabase({ isGlobal: true });
          await globalDb.connect();
          contextManager = new ContextManager(globalDb.getDB(), { verbose: options.verbose });
          db = globalDb;
        }

        // Get or create context
        const contextOptions = {
          contextName: options.context,
          forceNew: options.new,
          firstPrompt: question,
        };

        context = await contextManager.getOrCreateContext('ask', contextOptions);

        // Display context unless --quiet
        if (!options.quiet) {
          displayActiveContext(context);
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

        // Build additional context
        let additionalContext = '';

        if (options.file) {
          const readTool = toolExecutor.registry.get('read_file');
          const result = await readTool.execute({ path: options.file });
          additionalContext += `\nFile content (${options.file}):\n${result.content}\n`;
        }

        if (options.tasks) {
          const listTool = toolExecutor.registry.get('list_tasks');
          const tasks = await listTool.execute({ limit: 20 });
          additionalContext += `\nCurrent tasks:\n${JSON.stringify(tasks, null, 2)}\n`;
        }

        // Get conversation history
        const history = await contextManager.getHistory(context.id, 10); // Last 10 turns

        // Build messages
        // Generate dynamic command reference
        const commands = getStandardTaskCommands();
        const commandReference = generateCommandReference(commands);
        const toolReference = generateToolReference(toolExecutor);

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

${commandReference}

You have read-only access to:
- Files in the current directory
- Current tasks and their status
- Task history and metadata

${toolReference}

Key principles:
1. Always think in terms of tasks, projects, and productivity
2. Suggest relevant taskwerk commands when appropriate
3. Help break down complex goals into manageable tasks
4. Focus on actionable insights and recommendations
5. When answering general questions, try to relate them back to task management or productivity

Current working directory: ${process.cwd()}
${additionalContext ? `\nContext:\n${additionalContext}` : ''}

Remember: You can read and analyze, but cannot modify files or tasks. For modifications, suggest the user use 'taskwerk agent' instead.

IMPORTANT: When listing or describing tasks, ONLY mention tasks that actually exist in the database. Never create example tasks or fictional task IDs. If there are no tasks, explicitly say "No tasks found" rather than creating examples.`,
          },
        ];

        // Add conversation history
        for (const turn of history) {
          messages.push({
            role: turn.role,
            content: turn.content,
          });
        }

        // Add current question
        messages.push({
          role: 'user',
          content: question,
        });

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
          if (!finalResponse.content.endsWith('\n')) {
            process.stdout.write('\n');
          }

          // Save conversation turns
          await contextManager.addTurn(context.id, 'user', question);
          await contextManager.addTurn(context.id, 'assistant', finalResponse.content, {
            toolCalls: response.tool_calls,
          });
        } else {
          // No tool calls, just display response
          process.stdout.write(response.content);
          if (!response.content.endsWith('\n')) {
            process.stdout.write('\n');
          }

          // Save conversation turns
          await contextManager.addTurn(context.id, 'user', question);
          await contextManager.addTurn(context.id, 'assistant', response.content);
        }

        if (options.verbose && response.usage) {
          console.error(
            chalk.gray(
              `\n📊 Tokens used: ${response.usage.prompt_tokens + response.usage.completion_tokens}`
            )
          );
        }
      } catch (error) {
        // Only log technical errors in verbose mode
        if (options.verbose) {
          logger.error('Ask failed:', error);
        }

        // Provide specific guidance for common errors
        if (error.message?.includes('No AI provider configured')) {
          console.error('❌ No AI provider configured');
          console.error('\n💡 To fix this, run:');
          console.error('   twrk aiconfig --choose');
          console.error('\nThis will help you select and configure an AI provider.');
        } else if (
          error.message?.toLowerCase().includes('api key') ||
          error.message?.includes('x-api-key')
        ) {
          console.error(`❌ ${error.message}`);

          // Try to get current provider name from config
          try {
            const currentProvider = llmManager.configManager.get('ai.current_provider');
            if (currentProvider) {
              console.error(`⚠️  Current provider: ${currentProvider}`);
            }
          } catch (e) {
            // Ignore if we can't get provider name
          }

          console.error('\n💡 To fix this:');
          console.error('1. Check your API key is correct');
          console.error('2. Run: twrk aiconfig --set <provider>.api_key=<your-key>');
          console.error('3. Or run: twrk aiconfig --choose to select a different provider');
          console.error(
            '4. To use a different provider once: twrk ask --provider <name> "your question"'
          );
          console.error('5. View current config: twrk aiconfig --show');
        } else if (error.message?.includes('No model selected')) {
          console.error('❌ No AI model selected');
          console.error('\n💡 To fix this, run:');
          console.error('   twrk aiconfig --choose');
          console.error('\nThis will help you select a model.');
        } else if (error.message?.includes('rate_limit') || error.message?.includes('Rate limit')) {
          console.error('❌ Rate limit exceeded');
          console.error('\n💡 Try again in a few minutes, or:');
          console.error('1. Use a different provider: twrk ask --provider <name> "your question"');
          console.error('2. Check your usage limits with your AI provider');
        } else if (error.message?.includes('model') && error.message?.includes('Invalid')) {
          console.error('❌ Invalid model selected');
          console.error('\n💡 To fix this:');
          console.error('1. Run: twrk aiconfig --choose to select a valid model');
          console.error('2. Or specify a model: twrk ask --model <model-name> "your question"');
        } else {
          console.error('❌ Ask failed:', error.message);
          console.error('\n💡 For help with AI configuration, run:');
          console.error('   twrk aiconfig --help');
        }

        process.exit(1);
      } finally {
        // Clean up database connection
        if (db) {
          db.close();
        }
      }
    });

  return ask;
}
