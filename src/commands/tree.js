/**
 * TaskWerk v3 Tree Command
 *
 * Display task dependency hierarchies
 */

import { BaseCommand } from '../cli/base-command.js';
import { DependencyResolver } from '../core/dependency-resolver.js';
import { TaskWerkError } from '../cli/error-handler.js';
import { TaskManager } from '../core/task-manager.js';
import { loadConfig } from '../utils/config.js';
import chalk from 'chalk';

/**
 * Tree command implementation for v3
 */
export class TreeCommand extends BaseCommand {
  constructor() {
    super('tree', 'Display task dependency tree');

    // Set category
    this.category = 'Dependencies';

    // Define arguments
    this.argument('[taskId]', 'Task ID to show tree for (e.g., TASK-001)');

    // Define options
    this.option('-d, --depth <number>', 'Maximum tree depth', '5')
      .option('--dependencies', 'Show dependencies (tasks this depends on)', true)
      .option('--dependents', 'Show dependents (tasks that depend on this)')
      .option('--subtasks', 'Include subtasks in tree')
      .option('--all', 'Show all relationships')
      .option('--critical-path', 'Highlight critical path')
      .option('--json', 'Output in JSON format')
      .option('--ascii', 'Use ASCII characters only');
  }

  /**
   * Execute tree command
   */
  async execute(args, options) {
    const taskId = args[0];

    // Create dependency resolver
    const resolver = new DependencyResolver(this.config.databasePath);
    await resolver.initialize();

    try {
      if (!taskId) {
        // Show forest view of all root tasks
        await this.showForest(resolver, options);
        return;
      }

      // Build dependency tree
      const tree = await resolver.buildDependencyTree(taskId, {
        maxDepth: parseInt(options.depth, 10),
        includeDependencies: options.all || options.dependencies !== false,
        includeDependents: options.all || options.dependents,
        includeSubtasks: options.all || options.subtasks,
      });

      if (!tree) {
        throw new TaskWerkError('TASK_NOT_FOUND', {
          message: `Task ${taskId} not found`,
          taskId,
        });
      }

      // Check for circular dependencies
      if (await resolver.hasCircularDependency(tree.id)) {
        const circularPath = await resolver.findCircularPath(tree.id);
        this.warn('Circular dependency detected!');
        if (circularPath) {
          console.log(chalk.red('Circular path:'));
          console.log(circularPath.map(t => `${t.stringId} (${t.name})`).join(' → '));
        }
        console.log();
      }

      if (options.json) {
        console.log(JSON.stringify(tree, null, 2));
        return;
      }

      // Calculate critical path if requested
      let criticalPath = null;
      if (options.criticalPath) {
        try {
          const result = await resolver.calculateCriticalPath(tree.id);
          criticalPath = new Set(result.path.map(t => t.id));
        } catch (error) {
          this.warn(`Could not calculate critical path: ${error.message}`);
        }
      }

      // Display the tree
      console.log(chalk.bold('Task Dependency Tree:'));
      console.log();
      this.displayNode(tree, '', true, options, criticalPath);

      // Show statistics
      console.log();
      this.showStatistics(tree);

      // Show next steps
      console.log();
      console.log(chalk.bold('Next steps:'));
      console.log(`  - Run ${chalk.cyan('taskwerk ready')} to see tasks ready to start`);
      console.log(
        `  - Run ${chalk.cyan('taskwerk tree --critical-path')} to highlight critical path`
      );
      console.log(
        `  - Run ${chalk.cyan('taskwerk tree --dependents')} to see reverse dependencies`
      );
    } finally {
      resolver.close();
    }
  }

  /**
   * Display a node in the tree
   */
  displayNode(node, prefix = '', isLast = true, options = {}, criticalPath = null) {
    const chars = options.ascii
      ? { pipe: '|', corner: '\\', tee: '+', line: '-' }
      : { pipe: '│', corner: '└', tee: '├', line: '─' };

    // Node connector
    const connector = isLast ? chars.corner : chars.tee;
    const extension = chars.line + chars.line + ' ';

    // Status icon
    const statusIcon = this.getStatusIcon(node.status);

    // Priority color
    const priorityColor = this.getPriorityColor(node.priority);

    // Critical path highlight
    const isOnCriticalPath = criticalPath && criticalPath.has(node.id);
    const nodeColor = isOnCriticalPath ? chalk.red.bold : chalk.white;

    // Build node display
    let nodeText = `${statusIcon} ${nodeColor(node.stringId)} - ${node.name}`;

    // Add metadata
    const metadata = [];
    if (node.priority) {
      metadata.push(priorityColor(node.priority));
    }
    if (node.assignee) {
      metadata.push(chalk.magenta('@' + node.assignee));
    }
    if (node.estimated) {
      metadata.push(chalk.yellow(node.estimated + 'h'));
    }
    if (node.progress && node.progress > 0) {
      metadata.push(chalk.cyan(node.progress + '%'));
    }

    if (metadata.length > 0) {
      nodeText += ` ${chalk.gray('[')}${metadata.join(', ')}${chalk.gray(']')}`;
    }

    // Print the node
    console.log(prefix + connector + extension + nodeText);

    // Prepare prefix for children
    const childPrefix = prefix + (isLast ? '    ' : chars.pipe + '   ');

    // Display relationships
    const allChildren = [];

    if (node.dependencies && node.dependencies.length > 0) {
      allChildren.push(
        ...node.dependencies.map(child => ({
          ...child,
          relationType: 'depends on',
        }))
      );
    }

    if (node.dependents && node.dependents.length > 0) {
      allChildren.push(
        ...node.dependents.map(child => ({
          ...child,
          relationType: 'blocks',
        }))
      );
    }

    if (node.subtasks && node.subtasks.length > 0) {
      allChildren.push(
        ...node.subtasks.map(child => ({
          ...child,
          relationType: 'subtask',
        }))
      );
    }

    // Group children by type if mixed
    if (options.all && allChildren.length > 0) {
      const grouped = {};
      allChildren.forEach(child => {
        if (!grouped[child.relationType]) {
          grouped[child.relationType] = [];
        }
        grouped[child.relationType].push(child);
      });

      let groupIndex = 0;
      const groupCount = Object.keys(grouped).length;

      for (const [relationType, children] of Object.entries(grouped)) {
        if (children.length > 0) {
          console.log(childPrefix + chars.pipe + '   ' + chalk.gray(`[${relationType}]`));
          children.forEach((child, index) => {
            const isLastChild = groupIndex === groupCount - 1 && index === children.length - 1;
            this.displayNode(child, childPrefix, isLastChild, options, criticalPath);
          });
          groupIndex++;
        }
      }
    } else {
      // Display ungrouped children
      allChildren.forEach((child, index) => {
        this.displayNode(
          child,
          childPrefix,
          index === allChildren.length - 1,
          options,
          criticalPath
        );
      });
    }
  }

  /**
   * Show forest view of all root tasks
   */
  async showForest(resolver, options) {
    // Get all tasks without parents and not depending on anything
    const allTasks = await resolver.taskApi.listTasks({
      parent_id: null,
      status: ['todo', 'in_progress', 'paused', 'blocked'],
      limit: 1000,
    });

    const rootTasks = [];
    for (const task of allTasks.tasks) {
      const deps = await resolver.taskApi.getDependencies(task.id);
      if (!deps || deps.length === 0) {
        rootTasks.push(task);
      }
    }

    if (rootTasks.length === 0) {
      console.log(chalk.yellow('No root tasks found.'));
      console.log();
      console.log('Root tasks are tasks that:');
      console.log('  - Have no parent task');
      console.log('  - Have no dependencies');
      console.log('  - Are not completed or archived');
      return;
    }

    console.log(chalk.bold(`Task Forest (${rootTasks.length} root tasks):`));
    console.log();

    for (const task of rootTasks) {
      const tree = await resolver.buildDependencyTree(task.id, {
        maxDepth: parseInt(options.depth, 10),
        includeDependencies: false,
        includeDependents: true,
        includeSubtasks: true,
      });

      if (tree) {
        this.displayNode(tree, '', true, options);
        console.log();
      }
    }
  }

  /**
   * Show tree statistics
   */
  showStatistics(tree) {
    const stats = {
      totalNodes: 0,
      byStatus: {},
      byPriority: {},
      totalEstimate: 0,
      maxDepth: 0,
    };

    const analyze = (node, depth = 0) => {
      stats.totalNodes++;
      stats.maxDepth = Math.max(stats.maxDepth, depth);

      // Count by status
      stats.byStatus[node.status] = (stats.byStatus[node.status] || 0) + 1;

      // Count by priority
      if (node.priority) {
        stats.byPriority[node.priority] = (stats.byPriority[node.priority] || 0) + 1;
      }

      // Sum estimates
      if (node.estimated) {
        stats.totalEstimate += node.estimated;
      }

      // Recurse
      [...(node.dependencies || []), ...(node.dependents || []), ...(node.subtasks || [])].forEach(
        child => analyze(child, depth + 1)
      );
    };

    analyze(tree);

    console.log(chalk.bold('Tree Statistics:'));
    console.log(`  Total tasks: ${stats.totalNodes}`);
    console.log(`  Max depth: ${stats.maxDepth}`);

    if (Object.keys(stats.byStatus).length > 0) {
      console.log(`  By status:`);
      Object.entries(stats.byStatus).forEach(([status, count]) => {
        const icon = this.getStatusIcon(status);
        console.log(`    ${icon} ${status}: ${count}`);
      });
    }

    if (Object.keys(stats.byPriority).length > 0) {
      console.log(`  By priority:`);
      Object.entries(stats.byPriority).forEach(([priority, count]) => {
        const color = this.getPriorityColor(priority);
        console.log(`    ${color(priority)}: ${count}`);
      });
    }

    if (stats.totalEstimate > 0) {
      console.log(`  Total estimate: ${chalk.cyan(stats.totalEstimate + ' hours')}`);
    }
  }

  /**
   * Get status icon
   */
  getStatusIcon(status) {
    switch (status) {
      case 'todo':
        return chalk.gray('○');
      case 'in_progress':
        return chalk.blue('●');
      case 'paused':
        return chalk.yellow('⏸');
      case 'blocked':
        return chalk.red('⛔');
      case 'completed':
        return chalk.green('✓');
      case 'archived':
        return chalk.gray('⧉');
      default:
        return chalk.gray('?');
    }
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
export default TreeCommand;

// Export legacy function for v2 CLI compatibility
export async function treeCommand(taskId) {
  try {
    const config = await loadConfig();
    const taskManager = new TaskManager(config);

    if (!taskId) {
      console.log('Task ID is required for tree view.');
      return;
    }

    const task = await taskManager.getTask(taskId);
    if (!task) {
      console.log(`Task ${taskId} not found.`);
      return;
    }

    // Simple tree display for v2
    console.log('Task Dependency Tree:');
    console.log(`${task.id} - ${task.description}`);

    if (task.subtasks && task.subtasks.length > 0) {
      task.subtasks.forEach((subtask, index) => {
        const isLast = index === task.subtasks.length - 1;
        const prefix = isLast ? '└── ' : '├── ';
        console.log(`${prefix}${subtask.id} - ${subtask.description}`);
      });
    }
  } catch (error) {
    console.error('❌ Failed to display tree:', error.message);
    process.exit(1);
  }
}
