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
import inquirer from 'inquirer';
import chalk from 'chalk';

export function agentCommand() {
  const agent = new Command('agent');

  agent
    .description('AI agent that can read, write files and manage tasks (maintains chat context)')
    .argument('[instruction...]', 'Task for the agent to complete')
    .option('-f, --file <path>', 'Include file content in context')
    .option('-t, --tasks', 'Include current tasks in context')
    .option('--context <name>', 'Use named global context (outside projects)')
    .option('--new', 'Start a new conversation (ignore previous context)')
    .option('--provider <name>', 'Override AI provider')
    .option('--model <name>', 'Override AI model')
    .option('--max-iterations <n>', 'Maximum iterations', parseInt, 10)
    .option('--yolo', 'Skip permission prompts (dangerous!)')
    .option('--verbose', 'Show detailed execution info')
    .option('--quiet', 'Hide context display')
    .addHelpText(
      'after',
      `
Examples:
  $ twrk agent "Create tasks for the authentication feature"
  $ twrk agent "Split task 1 into frontend and backend subtasks"
  $ twrk agent -f spec.md "Create tasks based on this specification"
  $ twrk agent --yolo "Organize all my TODO tasks by priority"
  $ twrk agent --context work "Continue implementing the feature we discussed"

Chat Context:
  • In a project: Conversations are maintained automatically per-project
  • Outside projects: Uses a general global context by default
  • Named contexts: Use --context <name> for topic-specific conversations
  • Fresh start: Use --new to begin a new conversation
  • Context includes: Previous instructions, tasks created, files modified

The AI agent can:
  • Create, update, and delete tasks
  • Read and write files in the working directory
  • Organize and structure your project
  • Execute multi-step plans
  • Remember previous conversations and continue work

Safety:
  • By default, asks permission before each action
  • Use --yolo to skip permissions (use with caution!)
  • Agent is limited to current directory and subdirectories`
    )
    .action(async (instructionArgs, options) => {
      const logger = new Logger('agent');
      const llmManager = new LLMManager();
      let db;
      let contextManager;
      let context;

      try {
        // Get the instruction
        const instruction = instructionArgs.join(' ');
        if (!instruction) {
          console.error('❌ Please provide an instruction for the agent');
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
          firstPrompt: instruction,
        };

        context = await contextManager.getOrCreateContext('agent', contextOptions);

        // Display context unless --quiet
        if (!options.quiet) {
          displayActiveContext(context);
        }

        // Warn about yolo mode
        if (options.yolo) {
          console.log(chalk.yellow('⚠️  YOLO mode enabled - agent will not ask for permissions!'));
        }

        // Initialize tool executor
        const toolExecutor = new ToolExecutor({
          mode: options.yolo ? 'yolo' : 'agent',
          workDir: process.cwd(),
          verbose: options.verbose,
          confirmPermission: async (tool, action, params) => {
            if (options.yolo) {
              return true;
            }

            console.log(chalk.yellow(`\n⚠️  Permission required:`));
            console.log(chalk.yellow(`Tool: ${tool}`));
            console.log(chalk.yellow(`Action: ${action}`));
            if (options.verbose) {
              console.log(chalk.gray(`Parameters: ${JSON.stringify(params, null, 2)}`));
            }

            const { confirm } = await inquirer.prompt([
              {
                type: 'confirm',
                name: 'confirm',
                message: 'Allow this action?',
                default: false,
              },
            ]);

            return confirm;
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

        // Generate dynamic command reference
        const commands = getStandardTaskCommands();
        const commandReference = generateCommandReference(commands);
        const toolReference = generateToolReference(toolExecutor);

        // Initialize conversation
        const messages = [
          {
            role: 'system',
            content: `You are an AI agent for Taskwerk (twrk), a powerful command-line task management and productivity system. You are the active, hands-on assistant that can make changes and execute tasks.

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

${toolReference}

Core principles:
1. Think like a productivity expert and project manager
2. Break complex goals into clear, actionable tasks
3. Always consider the broader project context and workflow
4. Use taskwerk's full capabilities (tags, priorities, notes, dependencies)
5. Create sustainable, maintainable task structures
6. Verify your work and provide clear status updates
7. Be proactive in suggesting improvements to workflow and organization

Current working directory: ${process.cwd()}
${additionalContext ? `\nContext:\n${additionalContext}` : ''}

Guidelines for execution:
- Always read and understand the current state before making changes
- Create meaningful task names with clear, actionable descriptions
- Use appropriate tags, priorities, and notes for organization
- Consider dependencies and logical task ordering
- After making changes, verify results and suggest next steps
- Be careful with file operations - check before overwriting
- Think systematically about task organization and project structure

Remember: You are not just executing commands, you are helping build better productivity systems and workflows.

IMPORTANT: When listing or describing tasks, ONLY mention tasks that actually exist in the database. Never create example tasks or fictional task IDs. If there are no tasks, explicitly say "No tasks found" rather than creating examples. Always use the list_tasks tool to get the actual current tasks.`,
          },
        ];

        // Add conversation history
        for (const turn of history) {
          messages.push({
            role: turn.role,
            content: turn.content,
          });
        }

        // Add current instruction
        messages.push({
          role: 'user',
          content: instruction,
        });

        // Agent loop
        let iterations = 0;
        const maxIterations = options.maxIterations || 10;
        let isComplete = false;
        let response;

        while (!isComplete && iterations < maxIterations) {
          iterations++;

          if (options.verbose) {
            console.error(chalk.gray(`\n🤖 Agent iteration ${iterations}/${maxIterations}...`));
          } else if (process.stderr.isTTY && iterations === 1) {
            // Only show on first iteration for non-verbose mode
            process.stderr.write('🤖 Working on it...\n');
          }

          // Prepare completion parameters
          const completionParams = {
            messages,
            temperature: 0.7,
            maxTokens: 8192,
            tools: toolExecutor.getToolSpecs(),
            verbose: options.verbose,
          };

          // Add provider/model overrides
          if (options.provider) {
            completionParams.provider = options.provider;
          }
          if (options.model) {
            completionParams.model = options.model;
          }

          // Get response
          response = await llmManager.complete(completionParams);

          // Display agent's message
          if (response.content) {
            if (options.verbose) {
              console.log(chalk.cyan('\n🤖 Agent:'), response.content);
            } else {
              // In non-verbose mode, just output the content cleanly
              process.stdout.write(response.content);
              if (!response.content.endsWith('\n')) {
                process.stdout.write('\n');
              }
            }
          }

          // Add assistant message to history
          messages.push({
            role: 'assistant',
            content: response.content || '',
            tool_calls: response.tool_calls,
          });

          // Handle tool calls
          if (response.tool_calls && response.tool_calls.length > 0) {
            if (options.verbose) {
              console.error(chalk.gray(`\n🔧 Executing ${response.tool_calls.length} tools...`));
            }

            const toolResults = await toolExecutor.executeTools(response.tool_calls, {
              verbose: options.verbose,
            });

            // Add tool results to messages
            for (const result of toolResults) {
              messages.push({
                role: 'tool',
                tool_call_id: result.tool_call_id,
                content: result.content,
              });

              if (options.verbose) {
                const data = JSON.parse(result.content);
                if (data.success) {
                  console.error(chalk.green(`✅ Tool succeeded`));
                } else {
                  console.error(chalk.red(`❌ Tool failed: ${data.error}`));
                }
              }
            }
          } else {
            // No tool calls, agent might be done
            const lastMessage = messages[messages.length - 1].content.toLowerCase();
            if (
              lastMessage.includes('complete') ||
              lastMessage.includes('done') ||
              lastMessage.includes('finished')
            ) {
              isComplete = true;
            } else {
              // Ask if task is complete
              messages.push({
                role: 'user',
                content: 'Is the task complete? If not, continue working on it.',
              });
            }
          }
        }

        if (iterations >= maxIterations) {
          console.log(chalk.yellow(`\n⚠️  Reached maximum iterations (${maxIterations})`));
        }

        // Save the conversation turns
        // We need to extract just the user instruction and final assistant response
        // Skip the system message and history that we added
        const historyLength = history.length;
        const conversationStart = 1 + historyLength; // Skip system message and history

        // Save initial instruction
        await contextManager.addTurn(context.id, 'user', instruction);

        // Save final assistant response (combine all assistant messages after the instruction)
        let finalResponse = '';
        for (let i = conversationStart + 1; i < messages.length; i++) {
          if (messages[i].role === 'assistant' && messages[i].content) {
            finalResponse += messages[i].content + '\n';
          }
        }

        if (finalResponse.trim()) {
          await contextManager.addTurn(context.id, 'assistant', finalResponse.trim());
        }

        if (options.verbose && response.usage) {
          console.error(
            chalk.gray(`\n📊 Total conversation tokens: ${messages.length * 1000} (estimate)`)
          );
        }
      } catch (error) {
        // Only log technical errors in verbose mode
        if (options.verbose) {
          logger.error('Agent failed:', error);
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
            '4. To use a different provider once: twrk agent --provider <name> "your instruction"'
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
          console.error(
            '1. Use a different provider: twrk agent --provider <name> "your instruction"'
          );
          console.error('2. Check your usage limits with your AI provider');
        } else if (error.message?.includes('model') && error.message?.includes('Invalid')) {
          console.error('❌ Invalid model selected');
          console.error('\n💡 To fix this:');
          console.error('1. Run: twrk aiconfig --choose to select a valid model');
          console.error(
            '2. Or specify a model: twrk agent --model <model-name> "your instruction"'
          );
        } else {
          console.error('❌ Agent failed:', error.message);
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

  return agent;
}
