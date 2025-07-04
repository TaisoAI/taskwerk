/**
 * TaskWerk v3 Ready Command
 *
 * Show tasks that are ready to start (no blockers)
 */

import { BaseCommand } from '../cli/base-command.js';
import { DependencyResolver } from '../core/dependency-resolver.js';
import { TaskManager } from '../core/task-manager.js';
import { loadConfig } from '../utils/config.js';
import chalk from 'chalk';

/**
 * Ready command implementation for v3
 */
export class ReadyCommand extends BaseCommand {
  constructor() {
    super('ready', 'Show tasks ready to start (no blockers)');

    // Set category
    this.category = 'Dependencies';

    // Define options
    this.option('-c, --category <category>', 'Filter by category')
      .option('-a, --assignee <assignee>', 'Filter by assignee')
      .option('-n, --limit <number>', 'Limit number of results', '10')
      .option('--all', 'Show all ready tasks (no limit)')
      .option('--score', 'Show priority scores')
      .option('--json', 'Output in JSON format');
  }

  /**
   * Execute ready command
   */
  async execute(args, options) {
    // Create dependency resolver
    const resolver = new DependencyResolver(this.config.databasePath);
    await resolver.initialize();

    try {
      // Get ready tasks
      const readyTasks = await resolver.getReadyTasks({
        category: options.category,
        assignee: options.assignee,
        limit: options.all ? null : parseInt(options.limit, 10),
      });

      if (readyTasks.length === 0) {
        if (options.json) {
          console.log(JSON.stringify({ tasks: [], count: 0 }, null, 2));
        } else {
          console.log(chalk.yellow('No tasks are ready to start.'));
          console.log();
          console.log('This could mean:');
          console.log('  - All tasks have unresolved dependencies');
          console.log('  - All tasks are already in progress or completed');
          console.log('  - No tasks match your filter criteria');
          console.log();
          console.log(`Run ${chalk.cyan('taskwerk list')} to see all tasks`);
          console.log(`Run ${chalk.cyan('taskwerk tree')} to visualize dependencies`);
        }
        return;
      }

      if (options.json) {
        const output = {
          tasks: readyTasks.map(t => ({
            id: t.string_id,
            name: t.name,
            priority: t.priority,
            category: t.category,
            assignee: t.assignee,
            estimated: t.estimated,
            priorityScore: t.priorityScore,
          })),
          count: readyTasks.length,
        };
        console.log(JSON.stringify(output, null, 2));
        return;
      }

      // Display ready tasks
      console.log(chalk.bold(`Found ${readyTasks.length} task(s) ready to start:`));
      console.log();

      readyTasks.forEach((task, index) => {
        // Task header
        console.log(
          `${chalk.gray(`${index + 1}.`)} ${chalk.cyan(task.string_id)} - ${chalk.white(task.name)}`
        );

        // Task details
        const details = [];

        if (task.priority) {
          const priorityColor = this.getPriorityColor(task.priority);
          details.push(`Priority: ${priorityColor(task.priority)}`);
        }

        if (task.category) {
          details.push(`Category: ${chalk.blue(task.category)}`);
        }

        if (task.assignee) {
          details.push(`Assignee: ${chalk.magenta('@' + task.assignee)}`);
        }

        if (task.estimated) {
          details.push(`Estimate: ${chalk.yellow(task.estimated + 'h')}`);
        }

        if (options.score) {
          details.push(`Score: ${chalk.green(task.priorityScore)}`);
        }

        if (details.length > 0) {
          console.log(`   ${details.join(' | ')}`);
        }

        // Show why it's ready
        console.log(`   ${chalk.green('✓')} ${chalk.gray('No blocking dependencies')}`);

        // Calculate impact
        if (task.dependents_count > 0) {
          console.log(
            `   ${chalk.yellow('→')} ${chalk.gray(`Unblocks ${task.dependents_count} other task(s)`)}`
          );
        }

        console.log();
      });

      // Show summary and next steps
      this.showSummary(readyTasks);
    } finally {
      resolver.close();
    }
  }

  /**
   * Show summary and recommendations
   */
  showSummary(tasks) {
    console.log(chalk.bold('Summary:'));

    // Priority breakdown
    const byPriority = {
      high: tasks.filter(t => t.priority === 'high').length,
      medium: tasks.filter(t => t.priority === 'medium').length,
      low: tasks.filter(t => t.priority === 'low').length,
    };

    if (byPriority.high > 0 || byPriority.medium > 0 || byPriority.low > 0) {
      console.log(`  Priority breakdown:`);
      if (byPriority.high > 0) {
        console.log(`    - ${chalk.red('High')}: ${byPriority.high}`);
      }
      if (byPriority.medium > 0) {
        console.log(`    - ${chalk.yellow('Medium')}: ${byPriority.medium}`);
      }
      if (byPriority.low > 0) {
        console.log(`    - ${chalk.green('Low')}: ${byPriority.low}`);
      }
    }

    // Total estimate
    const totalEstimate = tasks.reduce((sum, t) => sum + (t.estimated || 0), 0);
    if (totalEstimate > 0) {
      console.log(`  Total estimate: ${chalk.cyan(totalEstimate + ' hours')}`);
    }

    // Recommendations
    console.log();
    console.log(chalk.bold('Recommendations:'));

    const highPriorityTasks = tasks.filter(t => t.priority === 'high');
    if (highPriorityTasks.length > 0) {
      console.log(
        `  ${chalk.red('!')} Start with high-priority task: ${chalk.cyan(highPriorityTasks[0].string_id)}`
      );
    } else {
      const topTask = tasks[0];
      console.log(
        `  ${chalk.blue('→')} Start with highest-scored task: ${chalk.cyan(topTask.string_id)}`
      );
    }

    console.log();
    console.log(chalk.bold('Next steps:'));
    console.log(`  - Run ${chalk.cyan('taskwerk start <task-id>')} to begin work`);
    console.log(`  - Run ${chalk.cyan('taskwerk tree <task-id>')} to see task dependencies`);
    console.log(`  - Run ${chalk.cyan('taskwerk ready --all')} to see all ready tasks`);
  }

  /**
   * Get color function for priority
   */
  getPriorityColor(priority) {
    switch (priority) {
      case 'high':
        return chalk.red;
      case 'medium':
        return chalk.yellow;
      case 'low':
        return chalk.green;
      default:
        return chalk.white;
    }
  }
}

// Export as default for auto-discovery
export default ReadyCommand;

// Export legacy function for v2 CLI compatibility
export async function readyCommand() {
  try {
    const config = await loadConfig();
    const taskManager = new TaskManager(config);

    // In v2, we'll show tasks without dependencies
    const tasks = await taskManager.getTasks();
    const readyTasks = tasks.filter(
      task => task.status === 'todo' && (!task.dependencies || task.dependencies.length === 0)
    );

    if (readyTasks.length === 0) {
      console.log('No tasks are ready to start.');
      return;
    }

    console.log(`Found ${readyTasks.length} task(s) ready to start:\n`);

    readyTasks.forEach(task => {
      console.log(`${task.id} - ${task.description}`);
      if (task.priority) {
        console.log(`  Priority: ${task.priority}`);
      }
    });
  } catch (error) {
    console.error('❌ Failed to get ready tasks:', error.message);
    process.exit(1);
  }
}
