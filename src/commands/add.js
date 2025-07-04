/**
 * TaskWerk v3 Add Command
 *
 * Creates new tasks with full metadata support and validation
 */

import { BaseCommand } from '../cli/base-command.js';
import { TaskManager } from '../core/task-manager.js';
import { loadConfig } from '../utils/config.js';

/**
 * Add command implementation for v3
 */
export class AddCommand extends BaseCommand {
  constructor() {
    super('add', 'Add a new task to the task list');

    // Set category
    this.category = 'Task Management';

    // Define arguments
    this.argument('description', 'Task description');

    // Define options
    this.option('-p, --priority <level>', 'Priority level (high|medium|low)', 'medium')
      .option('-c, --category <category>', 'Task category (bugs, features, docs, etc.)')
      .option('-a, --assignee <assignee>', 'Task assignee')
      .option('-e, --estimate <hours>', 'Estimated hours to complete')
      .option('--status <status>', 'Initial task status', 'todo');
  }

  /**
   * Execute add command
   */
  async execute(args, options) {
    const description = args[0];

    if (!description) {
      throw new Error('Task description is required');
    }

    // Validate priority
    if (options.priority && !['high', 'medium', 'low'].includes(options.priority)) {
      throw new Error('Priority must be one of: high, medium, low');
    }

    // Validate status
    if (options.status && !['todo', 'in_progress', 'completed'].includes(options.status)) {
      throw new Error('Status must be one of: todo, in_progress, completed');
    }

    // Prepare task data
    const taskData = {
      name: description,
      description: description,
      priority: options.priority,
      category: options.category,
      assignee: options.assignee,
      status: options.status,
    };

    // Add estimated hours if provided
    if (options.estimate) {
      const estimate = parseFloat(options.estimate);
      if (isNaN(estimate) || estimate <= 0) {
        throw new Error('Estimate must be a positive number');
      }
      taskData.estimated = estimate;
    }

    this.info(`Creating task: "${description}"`);

    try {
      // Create the task using v3 API
      const task = await this.apis.task.createTask(taskData);

      this.success(`Added task: ${task.string_id} - ${task.name}`);

      // Show task details
      this.info(`  Priority: ${task.priority}`);
      if (task.category) {
        this.info(`  Category: ${task.category}`);
      }
      if (task.assignee) {
        this.info(`  Assignee: ${task.assignee}`);
      }
      if (task.estimated) {
        this.info(`  Estimate: ${task.estimated} hours`);
      }
      this.info(`  Status: ${task.status}`);

      return task;
    } catch (error) {
      throw new Error(`Failed to create task: ${error.message}`);
    }
  }
}

// Export as default for auto-discovery
export default AddCommand;

// Export legacy function for v2 CLI compatibility
export async function addCommand(description, options) {
  try {
    const config = await loadConfig();
    const taskManager = new TaskManager(config);

    const task = await taskManager.addTask({
      description,
      priority: options.priority || config.defaultPriority,
      category: options.category,
    });

    console.log(`✅ Added task: ${task.id} - ${task.description}`);
  } catch (error) {
    console.error('❌ Failed to add task:', error.message);
    process.exit(1);
  }
}
