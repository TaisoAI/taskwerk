import { TaskManager } from '../core/task-manager.js';
import { GitManager } from '../git/git-manager.js';
import { TaskRules } from '../core/task-rules.js';
import { loadConfig } from '../utils/config.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function completeCommand(taskId, options) {
  try {
    const config = await loadConfig();
    const taskManager = new TaskManager(config);
    const gitManager = new GitManager();
    const taskRules = new TaskRules(config);

    // Check workflow rules before completion
    console.log('🔍 Validating task against workflow rules...');
    const validation = await taskRules.validateTask(taskId, 'implement');
    const workflowMode = await taskRules.detectWorkflowMode();

    // Show validation results
    if (workflowMode === 'ai' && !validation.valid) {
      console.log(`\n❌ Task validation failed (AI mode):`);
      for (const error of validation.errors) {
        console.log(`   • ${error}`);
      }

      if (validation.requiredActions.length > 0) {
        console.log(`\n🔧 Required actions:`);
        for (const action of validation.requiredActions) {
          console.log(`   • ${action}`);
        }
      }

      if (!options.force) {
        console.log(`\n💡 Use --force to complete anyway, or fix the issues above`);
        console.log(`💡 Use 'taskwerk rules --validate ${taskId}' for detailed validation`);
        return;
      } else {
        console.log(`\n⚠️  Forcing completion despite validation failures`);
      }
    } else if (validation.warnings.length > 0) {
      console.log(`\n⚠️  Validation warnings:`);
      for (const warning of validation.warnings) {
        console.log(`   • ${warning}`);
      }
    }

    // Capture git state before completion
    const changedFiles = await gitManager.getChangedFiles();
    const gitState = await captureGitState(gitManager, changedFiles);

    const task = await taskManager.completeTask(taskId, {
      note: options.note,
      level: options.level || 'standard',
      filesChanged: options.files ? options.files.split(',') : gitState.files,
      versionImpact: options.versionImpact,
      sideEffects: options.sideEffects ? options.sideEffects.split(',') : [],
      gitState,
    });

    console.log(`✅ Completed task: ${task.id} - ${task.description}`);

    if (task.filesChanged && task.filesChanged.length > 0) {
      console.log(`📁 Files modified: ${task.filesChanged.join(', ')}`);
    }

    if (options.level === 'detailed' && task.sideEffects && task.sideEffects.length > 0) {
      console.log(`⚠️  Side effects: ${task.sideEffects.join(', ')}`);
    }

    if (task.versionImpact && task.versionImpact !== 'none') {
      console.log(`📈 Version impact: ${task.versionImpact}`);
    }

    // Show completion stats
    const completedSinceLastCommit = await getCompletedTasksSinceLastCommit(taskManager);

    // Handle post-completion workflow (version bump, auto-stage, auto-commit)
    const postCompletionOptions = {
      forceBump: options.versionImpact,
      forceStage: options.autoStage,
      forceCommit: options.autoCommit,
      versionImpact: options.versionImpact,
    };

    const workflowResults = await taskRules.handlePostCompletion(taskId, postCompletionOptions);

    // Show workflow results
    if (workflowResults.versionBumped && workflowResults.newVersion) {
      console.log(`🎯 New version: ${workflowResults.newVersion}`);
    }

    if (workflowResults.committed && workflowResults.commitHash) {
      console.log(`🔗 Commit: ${workflowResults.commitHash}`);
    } else if (completedSinceLastCommit.length > 1) {
      console.log(`\n📊 ${completedSinceLastCommit.length} tasks completed since last commit`);
      console.log(`💡 Use 'taskwerk stage' to review and prepare commit`);
    }
  } catch (error) {
    console.error('❌ Failed to complete task:', error.message);
    process.exit(1);
  }
}

async function captureGitState(gitManager, changedFiles) {
  if (!(await gitManager.isGitRepository())) {
    return { files: [], details: [] };
  }

  const fileDetails = [];

  for (const file of changedFiles) {
    try {
      // Get file status (new, modified, deleted)
      const { stdout: status } = await execAsync(`git status --porcelain "${file}"`);
      const statusCode = status.trim().substring(0, 2);

      let action = 'modified';
      if (statusCode.includes('A') || statusCode.includes('??')) {
        action = 'created';
      }
      if (statusCode.includes('D')) {
        action = 'deleted';
      }

      // For new/modified files, get line count changes
      let linesAdded = 0,
        linesDeleted = 0;
      if (action !== 'deleted') {
        try {
          const { stdout: diffStat } = await execAsync(`git diff --numstat HEAD -- "${file}"`);
          if (diffStat.trim()) {
            const [added, deleted] = diffStat.trim().split('\t');
            linesAdded = parseInt(added) || 0;
            linesDeleted = parseInt(deleted) || 0;
          }
        } catch (e) {
          // File might be new or binary
        }
      }

      fileDetails.push({
        path: file,
        action,
        linesAdded,
        linesDeleted,
      });
    } catch (e) {
      // Skip files we can't analyze
      fileDetails.push({
        path: file,
        action: 'modified',
        linesAdded: 0,
        linesDeleted: 0,
      });
    }
  }

  return {
    files: changedFiles,
    details: fileDetails,
  };
}

async function getCompletedTasksSinceLastCommit(taskManager) {
  try {
    const completed = await taskManager.getRecentlyCompleted(50);
    const gitManager = new GitManager();

    if (!(await gitManager.isGitRepository())) {
      return completed;
    }

    const lastCommitHash = await gitManager.getLatestCommitHash();
    if (!lastCommitHash) {
      return completed;
    }

    // Filter tasks completed after the last commit
    // This is a simplified version - in practice we'd need to check git log timestamps
    return completed.filter(task => {
      const completedTime = new Date(task.completedAt);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return completedTime > oneDayAgo;
    });
  } catch (error) {
    return [];
  }
}
