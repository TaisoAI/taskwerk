import { TaskManager } from '../core/task-manager.js';
import { GitManager } from '../git/git-manager.js';
import { loadConfig } from '../utils/config.js';

export async function stageCommand(options) {
  try {
    const config = await loadConfig();
    const taskManager = new TaskManager(config);
    const gitManager = new GitManager();

    if (!(await gitManager.isGitRepository())) {
      console.error('❌ Not a git repository');
      process.exit(1);
    }

    // Get completed tasks since last commit
    const completedTasks = await getCompletedTasksSinceLastCommit(taskManager, gitManager);

    if (completedTasks.length === 0) {
      console.log('📝 No completed tasks found since last commit');
      return;
    }

    // Get current git changes
    const changedFiles = await gitManager.getChangedFiles();

    if (changedFiles.length === 0) {
      console.log('📝 No file changes to stage');
      return;
    }

    console.log(
      `📋 Found ${completedTasks.length} completed task(s) and ${changedFiles.length} changed file(s)\n`
    );

    // Show completed tasks
    console.log('✅ Completed Tasks:');
    for (const task of completedTasks) {
      console.log(`   ${task.id}: ${task.description}`);
      if (task.filesChanged && task.filesChanged.length > 0) {
        console.log(`      Files: ${task.filesChanged.join(', ')}`);
      }
      if (task.note) {
        console.log(`      Note: ${task.note}`);
      }
    }

    console.log('\n📁 Changed Files:');
    for (const file of changedFiles) {
      console.log(`   ${file}`);
    }

    // Generate commit message preview
    const commitMessage = generateCommitMessage(completedTasks, changedFiles);

    console.log('\n📝 Commit Message Preview:');
    console.log('─'.repeat(50));
    console.log(commitMessage);
    console.log('─'.repeat(50));

    if (options.preview) {
      console.log('\n💡 Use --auto to stage files or --review for interactive staging');
      return;
    }

    if (options.auto) {
      // Auto-stage all changes
      await gitManager.stageFiles(changedFiles);
      console.log('\n✅ All files staged for commit');
      console.log('💡 Use taskwerk commit to create the commit');
    } else if (options.review) {
      // Interactive review (simplified for now)
      console.log('\n🔍 Interactive staging not yet implemented');
      console.log('💡 Use --auto to stage all files');
    } else {
      console.log('\n💡 Options:');
      console.log('   --auto     Stage all files automatically');
      console.log('   --preview  Show commit message preview only');
      console.log('   --review   Interactive file staging (coming soon)');
    }
  } catch (error) {
    console.error('❌ Failed to stage:', error.message);
    process.exit(1);
  }
}

async function getCompletedTasksSinceLastCommit(taskManager, gitManager) {
  try {
    const completed = await taskManager.getRecentlyCompleted(50);

    // Get the timestamp of the last commit
    const lastCommitTime = await getLastCommitTime(gitManager);

    if (!lastCommitTime) {
      // No commits yet, return all recently completed tasks
      return completed.slice(0, 10);
    }

    // Filter tasks completed after the last commit
    return completed.filter(task => {
      const completedTime = new Date(task.completedAt);
      return completedTime > lastCommitTime;
    });
  } catch (error) {
    console.error('Warning: Could not get completed tasks:', error.message);
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

function generateCommitMessage(completedTasks, changedFiles) {
  if (completedTasks.length === 0) {
    return 'chore: Update files\n\nFiles modified:\n' + changedFiles.map(f => `- ${f}`).join('\n');
  }

  // Determine commit type based on tasks
  let commitType = 'feat';
  const hasBugFixes = completedTasks.some(
    t => t.category === 'bugs' || t.description.toLowerCase().includes('fix')
  );
  const hasFeatures = completedTasks.some(
    t => t.category === 'features' || t.description.toLowerCase().includes('add')
  );
  const hasRefactor = completedTasks.some(t => t.category === 'refactor');
  const hasDocs = completedTasks.some(t => t.category === 'docs');

  if (hasBugFixes) {
    commitType = 'fix';
  } else if (hasRefactor) {
    commitType = 'refactor';
  } else if (hasDocs) {
    commitType = 'docs';
  } else if (hasFeatures) {
    commitType = 'feat';
  }

  // Generate summary
  let summary;
  if (completedTasks.length === 1) {
    summary = completedTasks[0].description;
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

  // Add files section if there are many files
  if (changedFiles.length > 5) {
    message += `\nFiles modified: ${changedFiles.length} files\n`;
    message += changedFiles
      .slice(0, 5)
      .map(f => `- ${f}`)
      .join('\n');
    if (changedFiles.length > 5) {
      message += `\n- ... and ${changedFiles.length - 5} more files`;
    }
  } else if (changedFiles.length > 0) {
    message += '\nFiles modified:\n';
    message += changedFiles.map(f => `- ${f}`).join('\n');
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

  return message.trim();
}
