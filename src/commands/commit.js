import { TaskManager } from '../core/task-manager.js';
import { GitManager } from '../git/git-manager.js';
import { TaskRules } from '../core/task-rules.js';
import { loadConfig } from '../utils/config.js';

export async function commitCommand(options = {}) {
  try {
    const config = await loadConfig();
    const taskManager = new TaskManager(config);
    const gitManager = new GitManager();
    const taskRules = new TaskRules(config);

    if (!(await gitManager.isGitRepository())) {
      console.error('❌ Not a git repository');
      process.exit(1);
    }

    // Detect workflow mode to apply appropriate rules
    const workflowMode = await taskRules.detectWorkflowMode();
    const rules = await taskRules.loadRules();
    const commitRules = rules[workflowMode].commitRules;

    console.log(`🔧 Workflow mode: ${workflowMode.toUpperCase()}`);

    // Auto-stage files if enabled by rules or forced
    if (commitRules.autoStage || options.autoStage) {
      const stagedCount = await taskRules.autoStageFiles();
      if (stagedCount > 0) {
        console.log(`📁 Auto-staged ${stagedCount} file(s)`);
      }
    }

    // Check for staged files
    const stagedFiles = await gitManager.getStagedFiles();

    if (stagedFiles.length === 0) {
      console.log('⚠️  No files staged for commit');
      console.log('💡 Use git add to stage files manually, or enable auto-staging');
      return;
    }

    // Auto-bump version if enabled by rules or forced
    let newVersion = null;
    if (commitRules.autoVersionBump || options.versionBump) {
      const versionType = options.versionBump || commitRules.versionBumpType || 'patch';
      newVersion = await taskRules.bumpVersion(versionType);
      if (newVersion) {
        console.log(`📈 Version bumped (${versionType}): ${newVersion}`);
      }
    }

    let commitMessage;

    if (options.message) {
      // Use custom message but still add Co-Authored-By
      commitMessage = addCoAuthoredBy(options.message, workflowMode);
    } else {
      // Generate message from completed tasks
      const completedTasks = await getCompletedTasksSinceLastCommit(taskManager, gitManager);

      if (completedTasks.length === 0) {
        console.log('⚠️  No completed tasks found since last commit');
        if (!options.allowEmpty) {
          console.log('💡 Use --allow-empty to commit anyway, or complete some tasks first');
          return;
        }
        commitMessage = generateGenericCommitMessage(stagedFiles, newVersion, workflowMode);
      } else {
        commitMessage = generateTaskBasedCommitMessage(completedTasks, stagedFiles, newVersion, workflowMode);
      }
    }

    // Show commit message preview
    if (options.review || (!options.message && !options.auto)) {
      console.log('\n📝 Commit Message:');
      console.log('─'.repeat(50));
      console.log(commitMessage);
      console.log('─'.repeat(50));

      if (!options.auto) {
        console.log('\n💡 Options:');
        console.log('   --auto     Commit automatically without review');
        console.log('   --review   Show this preview (default behavior)');
        console.log('   --message "msg"  Use custom commit message');
        return;
      }
    }

    // Create the commit using HEREDOC for proper formatting
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      // Use HEREDOC for proper commit message formatting
      const commitCmd = `git commit -m "$(cat <<'EOF'\n${commitMessage}\nEOF\n)"`;
      await execAsync(commitCmd);

      const commitHash = await gitManager.getLatestCommitHash();

      console.log(`\n✅ Committed changes successfully`);
      console.log(`📝 Commit: ${commitHash}`);
      console.log(`📁 Files: ${stagedFiles.length} file(s)`);
      if (newVersion) {
        console.log(`📈 Version: ${newVersion}`);
      }
      console.log(`🔧 Mode: ${workflowMode}`);
    } catch (error) {
      throw new Error(`Failed to create commit: ${error.message}`);
    }
  } catch (error) {
    console.error('❌ Failed to commit:', error.message);
    process.exit(1);
  }
}

async function getCompletedTasksSinceLastCommit(taskManager, gitManager) {
  try {
    const completed = await taskManager.getRecentlyCompleted(50);

    // Get the timestamp of the last commit
    const lastCommitTime = await getLastCommitTime(gitManager);

    if (!lastCommitTime) {
      // No commits yet, return recent tasks
      return completed.slice(0, 10);
    }

    // Filter tasks completed after the last commit
    return completed.filter(task => {
      const completedTime = new Date(task.completedAt);
      return completedTime > lastCommitTime;
    });
  } catch (error) {
    return [];
  }
}

async function getLastCommitTime(_gitManager) {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    const { stdout } = await execAsync('git log -1 --format=%ci');
    return new Date(stdout.trim());
  } catch (error) {
    return null;
  }
}

function addCoAuthoredBy(message, workflowMode) {
  // Add Co-Authored-By tags as required by workflow rules
  let result = message;
  
  if (workflowMode === 'ai') {
    // Add Claude co-authorship for AI mode
    if (!result.includes('Co-Authored-By:')) {
      result += '\n\nCo-Authored-By: Claude <noreply@anthropic.com>';
    }
  }
  
  return result;
}

function generateGenericCommitMessage(stagedFiles, newVersion, workflowMode) {
  let message = 'chore: Update files\n\nFiles modified:\n' + stagedFiles.map(f => `- ${f}`).join('\n');
  
  if (newVersion) {
    message += `\n\nVersion: ${newVersion}`;
  }
  
  return addCoAuthoredBy(message, workflowMode);
}

function generateTaskBasedCommitMessage(completedTasks, stagedFiles, newVersion, workflowMode) {
  // Determine commit type based on tasks
  let commitType = 'feat';
  const hasBugFixes = completedTasks.some(
    t =>
      t.category === 'bugs' ||
      t.description.toLowerCase().includes('fix') ||
      t.description.toLowerCase().includes('bug')
  );
  const hasFeatures = completedTasks.some(
    t =>
      t.category === 'features' ||
      t.description.toLowerCase().includes('add') ||
      t.description.toLowerCase().includes('implement')
  );
  const hasRefactor = completedTasks.some(
    t => t.category === 'refactor' || t.description.toLowerCase().includes('refactor')
  );
  const hasDocs = completedTasks.some(
    t => t.category === 'docs' || t.description.toLowerCase().includes('documentation')
  );

  if (hasBugFixes) {
    commitType = 'fix';
  } else if (hasRefactor) {
    commitType = 'refactor';
  } else if (hasDocs) {
    commitType = 'docs';
  } else if (hasFeatures) {
    commitType = 'feat';
  } else {
    commitType = 'chore';
  }

  // Generate summary
  let summary;
  if (completedTasks.length === 1) {
    summary = completedTasks[0].description;
    if (summary.length > 60) {
      summary = summary.substring(0, 57) + '...';
    }
  } else {
    summary = `Complete ${completedTasks.length} tasks`;
  }

  // Build commit message
  let message = `${commitType}: ${summary}\n\n`;

  // Add tasks section
  message += 'Tasks completed:\n';
  for (const task of completedTasks) {
    message += `- ${task.id}: ${task.description}\n`;
  }

  // Add files section
  if (stagedFiles.length > 0) {
    message += '\nFiles modified:\n';
    if (stagedFiles.length > 10) {
      message += stagedFiles
        .slice(0, 10)
        .map(f => `- ${f}`)
        .join('\n');
      message += `\n- ... and ${stagedFiles.length - 10} more files`;
    } else {
      message += stagedFiles.map(f => `- ${f}`).join('\n');
    }
  }

  // Add version information if bumped
  if (newVersion) {
    message += `\n\nVersion: ${newVersion}`;
  }

  // Add side effects if any
  const tasksWithSideEffects = completedTasks.filter(
    t => t.sideEffects && t.sideEffects.length > 0
  );
  if (tasksWithSideEffects.length > 0) {
    message += '\n\nSide effects:\n';
    for (const task of tasksWithSideEffects) {
      for (const effect of task.sideEffects) {
        message += `- ${effect}\n`;
      }
    }
  }

  // Add Co-Authored-By tags as required by workflow rules
  return addCoAuthoredBy(message.trim(), workflowMode);
}

// Version bumping is now handled by TaskRules.bumpVersion()
// This function is kept for backward compatibility but delegates to TaskRules
async function updateVersion(bumpType) {
  console.warn('⚠️  updateVersion is deprecated. Use TaskRules.bumpVersion() instead.');
  
  try {
    const { TaskRules } = await import('../core/task-rules.js');
    const taskRules = new TaskRules({});
    const newVersion = await taskRules.bumpVersion(bumpType);
    
    if (newVersion) {
      console.log(`📈 Version updated to: ${newVersion}`);
    }
  } catch (error) {
    console.error(`⚠️  Failed to update version: ${error.message}`);
  }
}
