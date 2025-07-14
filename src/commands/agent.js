import { Command } from 'commander';
import { LLMManager } from '../ai/llm-manager.js';
import { ToolExecutor } from '../ai/tool-executor.js';
import { Logger } from '../logging/logger.js';
import inquirer from 'inquirer';
import chalk from 'chalk';

export function agentCommand() {
  const agent = new Command('agent');

  agent
    .description('AI agent that can read, write files and manage tasks')
    .argument('[instruction...]', 'Task for the agent to complete')
    .option('-f, --file <path>', 'Include file content in context')
    .option('-t, --tasks', 'Include current tasks in context')
    .option('--provider <name>', 'Override AI provider')
    .option('--model <name>', 'Override AI model')
    .option('--max-iterations <n>', 'Maximum iterations', parseInt, 10)
    .option('--yolo', 'Skip permission prompts (dangerous!)')
    .option('--verbose', 'Show detailed execution info')
    .action(async (instructionArgs, options) => {
      const logger = new Logger('agent');
      const llmManager = new LLMManager();
      
      try {
        // Get the instruction
        const instruction = instructionArgs.join(' ');
        if (!instruction) {
          console.error('❌ Please provide an instruction for the agent');
          process.exit(1);
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
            if (options.yolo) return true;
            
            console.log(chalk.yellow(`\n⚠️  Permission required:`));
            console.log(chalk.yellow(`Tool: ${tool}`));
            console.log(chalk.yellow(`Action: ${action}`));
            if (options.verbose) {
              console.log(chalk.gray(`Parameters: ${JSON.stringify(params, null, 2)}`));
            }
            
            const { confirm } = await inquirer.prompt([{
              type: 'confirm',
              name: 'confirm',
              message: 'Allow this action?',
              default: false
            }]);
            
            return confirm;
          }
        });

        // Build initial context
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

Core principles:
1. Think like a productivity expert and project manager
2. Break complex goals into clear, actionable tasks
3. Always consider the broader project context and workflow
4. Use taskwerk's full capabilities (tags, priorities, notes, dependencies)
5. Create sustainable, maintainable task structures
6. Verify your work and provide clear status updates
7. Be proactive in suggesting improvements to workflow and organization

Current working directory: ${process.cwd()}
${context ? `\nContext:\n${context}` : ''}

Guidelines for execution:
- Always read and understand the current state before making changes
- Create meaningful task names with clear, actionable descriptions
- Use appropriate tags, priorities, and notes for organization
- Consider dependencies and logical task ordering
- After making changes, verify results and suggest next steps
- Be careful with file operations - check before overwriting
- Think systematically about task organization and project structure

Remember: You are not just executing commands, you are helping build better productivity systems and workflows.`
          },
          {
            role: 'user',
            content: instruction
          }
        ];

        // Agent loop
        let iterations = 0;
        const maxIterations = options.maxIterations || 10;
        let isComplete = false;

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
            verbose: options.verbose
          };

          // Add provider/model overrides
          if (options.provider) {
            completionParams.provider = options.provider;
          }
          if (options.model) {
            completionParams.model = options.model;
          }

          // Get response
          const response = await llmManager.complete(completionParams);
          
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
            tool_calls: response.tool_calls
          });

          // Handle tool calls
          if (response.tool_calls && response.tool_calls.length > 0) {
            if (options.verbose) {
              console.error(chalk.gray(`\n🔧 Executing ${response.tool_calls.length} tools...`));
            }

            const toolResults = await toolExecutor.executeTools(response.tool_calls, { verbose: options.verbose });
            
            // Add tool results to messages
            for (const result of toolResults) {
              messages.push({
                role: 'tool',
                tool_call_id: result.tool_call_id,
                content: result.content
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
            if (lastMessage.includes('complete') || 
                lastMessage.includes('done') || 
                lastMessage.includes('finished')) {
              isComplete = true;
            } else {
              // Ask if task is complete
              messages.push({
                role: 'user',
                content: 'Is the task complete? If not, continue working on it.'
              });
            }
          }
        }

        if (iterations >= maxIterations) {
          console.log(chalk.yellow(`\n⚠️  Reached maximum iterations (${maxIterations})`));
        }

        if (options.verbose && response.usage) {
          console.error(chalk.gray(`\n📊 Total conversation tokens: ${messages.length * 1000} (estimate)`));
        }

      } catch (error) {
        logger.error('Agent failed:', error);
        console.error('❌ Agent failed:', error.message);
        process.exit(1);
      }
    });

  return agent;
}