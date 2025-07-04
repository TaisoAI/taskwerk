/**
 * TaskWerk v3 Complete Command
 *
 * Complete a task with validation and rule checking
 */

import { BaseCommand } from '../cli/base-command.js';
import { WorkflowManager } from '../core/workflow-manager.js';
import { TaskWerkError } from '../cli/error-handler.js';
import { TaskManager } from '../core/task-manager.js';
import { GitManager } from '../git/git-manager.js';
import { loadConfig } from '../utils/config.js';
import chalk from 'chalk';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Complete command implementation for v3
 */
export class CompleteCommand extends BaseCommand {
  constructor() {
    super('complete', 'Complete a task with validation');

    // Set category
    this.category = 'Workflow';

    // Define arguments
    this.argument('taskId', 'Task ID to complete (e.g., TASK-001)');

    // Define options
    this.option('-n, --note <note>', 'Add a completion note or summary')
      .option('-l, --level <level>', 'Detail level: basic, standard, detailed', 'standard')
      .option('--files <files>', 'Comma-separated list of files changed')
      .option('--version-impact <impact>', 'Version impact: patch, minor, major, none')
      .option('--side-effects <effects>', 'Comma-separated list of side effects')
      .option('--force', 'Force completion even if workflow validation fails')
      .option('--auto-stage', 'Force auto-staging of files after completion')
      .option('--auto-commit', 'Force auto-commit after completion')
      .option('--no-validate', 'Skip completion requirement validation');
  }

  /**
   * Execute complete command
   */
  async execute(args, options) {
    const taskId = args[0];

    if (!taskId) {
      throw new TaskWerkError('MISSING_REQUIRED_ARG', {
        message: 'Task ID is required',
        argument: 'taskId',
      });
    }

    // Create workflow manager
    const workflow = new WorkflowManager(this.config.databasePath);
    await workflow.initialize();

    try {
      // Get task details before completion
      const task = await workflow.taskApi.getTask(taskId);
      if (!task) {
        throw new TaskWerkError('TASK_NOT_FOUND', {
          message: `Task ${taskId} not found`,
          taskId,
        });
      }

      // Prepare completion details
      const completionDetails = {};
      
      if (options.level !== 'basic') {
        // Collect file changes
        if (options.files) {
          completionDetails.files = options.files.split(',').map(f => f.trim());
        } else {
          // Auto-detect changed files if Git is available
          completionDetails.files = await this.detectChangedFiles();
        }

        // Add side effects if detailed level
        if (options.level === 'detailed' && options.sideEffects) {
          completionDetails.sideEffects = options.sideEffects.split(',').map(e => e.trim());
        }

        // Add version impact if specified
        if (options.versionImpact) {
          completionDetails.versionImpact = options.versionImpact;
        }
      }

      // Complete the task
      const completedTask = await workflow.completeTask(taskId, {
        note: options.note,
        details: completionDetails,
        validateRequirements: options.validate !== false,
        customValidation: options.force ? null : this.createCustomValidation(),
      });

      // Display success message
      this.success(`Completed task: ${completedTask.string_id} - ${completedTask.name}`);

      // Show completion details
      console.log();
      console.log(chalk.bold('Completion Details:'));
      console.log(`  Status: ${chalk.green('✓ completed')}`);
      console.log(`  Completed: ${chalk.gray(new Date().toLocaleString())}`);
      
      if (options.note) {
        console.log(`  Note: ${chalk.gray(options.note)}`);
      }

      // Show time tracking if available
      if (completedTask.estimated || completedTask.actual_hours) {
        console.log();
        console.log(chalk.bold('Time Tracking:'));
        if (completedTask.estimated) {
          console.log(`  Estimated: ${chalk.cyan(completedTask.estimated + ' hours')}`);
        }
        if (completedTask.actual_hours) {
          console.log(`  Actual: ${chalk.cyan(completedTask.actual_hours + ' hours')}`);
          if (completedTask.estimated) {
            const variance = Math.round(
              ((completedTask.actual_hours - completedTask.estimated) / completedTask.estimated) * 100
            );
            const varianceColor = variance > 20 ? chalk.red : variance < -20 ? chalk.green : chalk.yellow;
            console.log(`  Variance: ${varianceColor((variance >= 0 ? '+' : '') + variance + '%')}`);
          }
        }
      }

      // Show files changed if tracking
      if (completionDetails.files && completionDetails.files.length > 0) {
        console.log();
        console.log(chalk.bold('Files Changed:'));
        completionDetails.files.forEach(file => {
          console.log(`  - ${chalk.cyan(file)}`);
        });
      }

      // Check for workflow automation
      if (this.shouldAutomate(options)) {
        console.log();
        console.log(chalk.bold('Workflow Automation:'));
        
        if (options.versionImpact && options.versionImpact !== 'none') {
          await this.bumpVersion(options.versionImpact);
        }

        if (options.autoStage || this.config.workflow?.autoStage) {
          await this.stageFiles(completionDetails.files);
        }

        if (options.autoCommit || this.config.workflow?.autoCommit) {
          await this.createCommit(completedTask, completionDetails);
        }
      }

      // Show next steps
      console.log();
      console.log(chalk.bold('Next steps:'));
      
      const hasChanges = await this.hasUncommittedChanges();
      if (hasChanges) {
        console.log(`  - Run ${chalk.cyan('taskwerk stage')} to review changes`);
        console.log(`  - Run ${chalk.cyan('taskwerk commit')} to create commit`);
      } else {
        console.log(`  - Run ${chalk.cyan('taskwerk add')} to create a new task`);
        console.log(`  - Run ${chalk.cyan('taskwerk list')} to see remaining tasks`);
      }

      return completedTask;
    } finally {
      workflow.close();
    }
  }

  /**
   * Create custom validation function for completion
   */
  createCustomValidation() {
    return async (task) => {
      const errors = [];

      // Check if task has been in progress
      if (task.status !== 'in_progress') {
        errors.push('Task must be in progress before completion');
      }

      // Check for minimum time spent (configurable)
      const minTime = this.config.workflow?.minimumTaskTime || 0;
      if (minTime > 0 && task.started_at) {
        const timeSpent = (new Date() - new Date(task.started_at)) / 60000; // minutes
        if (timeSpent < minTime) {
          errors.push(`Task must be worked on for at least ${minTime} minutes`);
        }
      }

      // Check for required fields based on category
      if (this.config.workflow?.requireNotesByCategory) {
        const requiresNote = this.config.workflow.requireNotesByCategory[task.category];
        if (requiresNote && !task.notes?.length) {
          errors.push(`Tasks in '${task.category}' category require at least one note`);
        }
      }

      return errors;
    };
  }

  /**
   * Detect changed files using Git
   */
  async detectChangedFiles() {
    try {
      const gitManager = new GitManager();
      if (await gitManager.isGitRepository()) {
        return await gitManager.getChangedFiles();
      }
      return [];
    } catch (error) {
      // Git not available or not in a repo
      return [];
    }
  }

  /**
   * Check if we should run automation
   */
  shouldAutomate(options) {
    return options.autoStage || options.autoCommit || options.versionImpact;
  }

  /**
   * Bump version in package.json
   */
  async bumpVersion(impact) {
    try {
      const packagePath = join(process.cwd(), 'package.json');
      if (!existsSync(packagePath)) {
        this.warn('No package.json found, skipping version bump');
        return;
      }

      const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
      const currentVersion = pkg.version || '0.0.0';
      const newVersion = this.incrementVersion(currentVersion, impact);

      pkg.version = newVersion;
      
      const { writeFileSync } = await import('fs');
      writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');

      this.success(`Bumped version: ${currentVersion} → ${newVersion}`);
    } catch (error) {
      this.warn(`Failed to bump version: ${error.message}`);
    }
  }

  /**
   * Increment semantic version
   */
  incrementVersion(version, impact) {
    const parts = version.split('.').map(n => parseInt(n, 10));
    
    switch (impact) {
      case 'major':
        return `${parts[0] + 1}.0.0`;
      case 'minor':
        return `${parts[0]}.${parts[1] + 1}.0`;
      case 'patch':
      default:
        return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
    }
  }

  /**
   * Stage files for commit
   */
  async stageFiles(files) {
    try {
      const gitManager = new GitManager();
      if (files && files.length > 0) {
        for (const file of files) {
          await gitManager.stageFile(file);
        }
        this.success(`Staged ${files.length} files`);
      } else {
        await gitManager.stageAll();
        this.success('Staged all changes');
      }
    } catch (error) {
      this.warn(`Failed to stage files: ${error.message}`);
    }
  }

  /**
   * Create commit for completed task
   */
  async createCommit(task, details) {
    try {
      const gitManager = new GitManager();
      
      // Generate commit message
      const type = this.getCommitType(task.category);
      const scope = task.scope || '';
      const message = task.name;
      
      let commitMessage = `${type}${scope ? `(${scope})` : ''}: ${message}`;
      
      if (task.notes && task.notes.length > 0) {
        commitMessage += '\n\n' + task.notes.map(n => `- ${n.content}`).join('\n');
      }

      commitMessage += `\n\nCompleted: ${task.string_id}`;

      // Create commit
      await gitManager.commit(commitMessage);
      this.success('Created commit');
    } catch (error) {
      this.warn(`Failed to create commit: ${error.message}`);
    }
  }

  /**
   * Get conventional commit type from category
   */
  getCommitType(category) {
    const typeMap = {
      bug: 'fix',
      feature: 'feat',
      docs: 'docs',
      refactor: 'refactor',
      test: 'test',
      build: 'build',
      ci: 'ci',
      perf: 'perf',
      style: 'style',
    };

    return typeMap[category?.toLowerCase()] || 'feat';
  }

  /**
   * Check for uncommitted changes
   */
  async hasUncommittedChanges() {
    try {
      const gitManager = new GitManager();
      if (await gitManager.isGitRepository()) {
        const status = await gitManager.getStatus();
        return status.length > 0;
      }
      return false;
    } catch {
      return false;
    }
  }
}

// Export as default for auto-discovery
export default CompleteCommand;

// Export legacy function for v2 CLI compatibility
export async function completeCommand(taskId, options) {
  try {
    const config = await loadConfig();
    const taskManager = new TaskManager(config);
    const gitManager = new GitManager();

    // Get changed files from git (optional, for context)
    let files = [];
    if (options.files) {
      files = options.files.split(',');
    } else if (await gitManager.isGitRepository()) {
      files = await gitManager.getChangedFiles();
    }

    // Complete the task
    const completionData = {
      note: options.note,
      files: files,
      level: options.level || 'standard',
      sideEffects: options.sideEffects ? options.sideEffects.split(',') : [],
      versionImpact: options.versionImpact,
    };

    const completedTask = await taskManager.completeTask(taskId, completionData);

    console.log(`✅ Completed task: ${completedTask.id} - ${completedTask.description}`);

    if (completedTask.note) {
      console.log(`📝 Note: ${completedTask.note}`);
    }

    if (files.length > 0) {
      console.log(`📁 Files: ${files.join(', ')}`);
    }

    if (options.versionImpact && options.versionImpact !== 'none') {
      console.log(`📈 Version impact: ${options.versionImpact}`);
    }

    if (options.sideEffects) {
      console.log(`⚠️  Side effects: ${options.sideEffects}`);
    }
  } catch (error) {
    console.error('❌ Failed to complete task:', error.message);
    process.exit(1);
  }
}
