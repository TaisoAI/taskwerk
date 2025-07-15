import { Command } from 'commander';
import { TaskwerkAPI } from '../../api/taskwerk-api.js';
import { Logger } from '../../logging/logger.js';

export function taskAddCommand() {
  const add = new Command('add');

  add
    .description('Add a new task')
    .argument('<name>', 'Task name')
    .option('-p, --priority <level>', 'Set priority (low, medium, high, critical)', 'medium')
    .option('-a, --assignee <name>', 'Assign task to a person')
    .option('-e, --estimate <hours>', 'Time estimate in hours')
    .option('-P, --parent <id>', 'Parent task ID')
    .option('-t, --tags <tags...>', 'Add tags to the task')
    .option('-d, --description <text>', 'Task description')
    .addHelpText(
      'after',
      `
Examples:
  Basic usage:
    $ twrk addtask "Fix login bug"                      # Create a simple task
    $ twrk addtask "Update API docs" -p high            # Set high priority
    $ twrk addtask "Refactor auth" -a @john -e 8        # Assign to john, 8hr estimate
  
  With descriptions and tags:
    $ twrk addtask "Security audit" -p critical -t security compliance -d "Q4 audit"
    $ twrk addtask "Fix memory leak" -t bug performance -d "Users report high RAM usage"
    $ twrk addtask "Add dark mode" -t feature ui -a @design-team
  
  Creating subtasks:
    $ twrk addtask "Setup CI/CD" -P TASK-001            # Create subtask under TASK-001
    $ twrk addtask "Write tests" -P 1                   # Use fuzzy matching for parent
    $ twrk addtask "Deploy to staging" -P TASK-001.1    # Subtask of a subtask
  
  For AI/LLM workflows:
    $ twrk addtask "Review PR #123" -a @ai-agent -d "Check for security issues"
    $ twrk addtask "Generate tests" -a @claude -t ai codegen -d "Cover edge cases"
    $ twrk addtask "Optimize query" -a @ai-agent -d "Current query takes 5s, need <100ms"
  
  Quick shortcuts:
    $ twrk addtask "Quick fix" -p high -t urgent        # High priority urgent task
    $ twrk addtask "Document API" -e 4 -t docs          # 4-hour documentation task
    $ twrk addtask "Meeting notes" -t meeting today     # Tagged for easy filtering
  
Note: Task IDs support fuzzy matching - use '1' instead of 'TASK-001'`
    )
    .action(async (name, options) => {
      const logger = new Logger('task-add');

      try {
        const api = new TaskwerkAPI();

        // Build task data
        const taskData = {
          name,
          description: options.description,
          priority: options.priority,
          assignee: options.assignee,
          parent_id: options.parent,
          created_by: 'user',
        };

        // Add estimate if provided
        if (options.estimate) {
          const estimateNum = parseInt(options.estimate);
          if (isNaN(estimateNum)) {
            console.error('❌ Estimate must be a number');
            process.exit(1);
          }
          taskData.estimate = estimateNum;
        }

        // Create the task
        const task = await api.createTask(taskData);

        console.log(`✅ Created task ${task.id}: ${task.name}`);

        // Add tags if provided
        if (options.tags && options.tags.length > 0) {
          await api.addTaskTags(task.id, options.tags, 'user');
          console.log(`🏷️  Added tags: ${options.tags.join(', ')}`);
        }

        // Show task details
        console.log(`\nTask Details:`);
        console.log(`  ID: ${task.id}`);
        console.log(`  Name: ${task.name}`);
        console.log(`  Status: ${task.status}`);
        console.log(`  Priority: ${task.priority}`);
        if (task.assignee) {
          console.log(`  Assignee: ${task.assignee}`);
        }
        if (task.parent_id) {
          console.log(`  Parent: ${task.parent_id}`);
        }
        if (task.estimate) {
          console.log(`  Estimate: ${task.estimate} hours`);
        }
        if (task.description) {
          console.log(`  Description: ${task.description}`);
        }
      } catch (error) {
        logger.error('Failed to create task', error);
        console.error('❌ Failed to create task:', error.message);
        process.exit(1);
      }
    });

  return add;
}
