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
            content: `You are an AI agent for Taskwerk with the ability to:
- Read and write files in the working directory
- Create, update, and list tasks
- Execute multiple steps to complete complex instructions

Current working directory: ${process.cwd()}
${context ? `\nContext:\n${context}` : ''}

Guidelines:
1. Break down complex tasks into steps
2. Use tools to gather information and make changes
3. Verify your work by reading files or listing tasks after modifications
4. Be careful with file operations - always check before overwriting
5. Provide clear status updates on what you're doing`
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
          }

          // Prepare completion parameters
          const completionParams = {
            messages,
            temperature: 0.7,
            maxTokens: 8192,
            tools: toolExecutor.getToolSpecs()
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
            console.log(chalk.cyan('\n🤖 Agent:'), response.content);
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

            const toolResults = await toolExecutor.executeTools(response.tool_calls);
            
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