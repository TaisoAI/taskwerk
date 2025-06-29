import { TaskManager } from '../core/task-manager.js';
import { GitManager } from '../git/git-manager.js';
import { loadConfig } from '../utils/config.js';

export async function commitCommand(options = {}) {
  try {
    const config = await loadConfig();
    const taskManager = new TaskManager(config);
    const gitManager = new GitManager();

    if (!(await gitManager.isGitRepository())) {
      console.error('❌ Not a git repository');
      process.exit(1);
    }

    // Check for staged files
    const stagedFiles = await gitManager.getStagedFiles();

    if (stagedFiles.length === 0) {
      console.log('⚠️  No files staged for commit');
      console.log('💡 Use git add to stage files first');
      return;
    }

    // Version bumping (explicit only)
    let newVersion = null;
    if (options.versionBump) {
      newVersion = await bumpVersion(options.versionBump);
      if (newVersion) {
        console.log(`📈 Version bumped (${options.versionBump}): ${newVersion}`);
      }
    }

    let commitMessage;

    if (options.message) {
      // Use custom message
      commitMessage = options.message;
    } else {
      // Generate message from completed tasks
      const completedTasks = await getCompletedTasksSinceLastCommit(taskManager, gitManager);

      if (completedTasks.length === 0) {
        console.log('⚠️  No completed tasks found since last commit');
        if (!options.allowEmpty && !newVersion) {
          console.log('💡 Use --allow-empty to commit anyway, or complete some tasks first');
          return;
        }
        commitMessage = generateGenericCommitMessage(stagedFiles, newVersion);
      } else {
        commitMessage = generateTaskBasedCommitMessage(completedTasks, stagedFiles, newVersion);
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

async function bumpVersion(versionType) {
  try {
    const { readFile, writeFile } = await import('fs/promises');
    const packagePath = './package.json';

    const packageContent = await readFile(packagePath, 'utf8');
    const packageJson = JSON.parse(packageContent);

    if (!packageJson.version) {
      throw new Error('No version field found in package.json');
    }

    const [major, minor, patch] = packageJson.version.split('.').map(Number);

    let newVersion;
    switch (versionType) {
      case 'major':
        newVersion = `${major + 1}.0.0`;
        break;
      case 'minor':
        newVersion = `${major}.${minor + 1}.0`;
        break;
      case 'patch':
        newVersion = `${major}.${minor}.${patch + 1}`;
        break;
      default:
        throw new Error(`Invalid version bump type: ${versionType}`);
    }

    packageJson.version = newVersion;
    await writeFile(packagePath, JSON.stringify(packageJson, null, 2) + '\n');

    return newVersion;
  } catch (error) {
    console.error(`⚠️  Failed to bump version: ${error.message}`);
    return null;
  }
}

function generateGenericCommitMessage(stagedFiles, newVersion) {
  let message =
    'chore: Update files\n\nFiles modified:\n' + stagedFiles.map(f => `- ${f}`).join('\n');

  if (newVersion) {
    message += `\n\nVersion: ${newVersion}`;
  }

  return message;
}

function generateTaskBasedCommitMessage(completedTasks, stagedFiles, newVersion) {
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
    const task = completedTasks[0];
    summary = `${task.id}: ${task.description}`;
    if (summary.length > 60) {
      summary = summary.substring(0, 57) + '...';
    }
  } else {
    summary = `Complete ${completedTasks.length} tasks`;
  }

  // Build commit message
  let message = `${commitType}: ${summary}\n\n`;

  // Add tasks section
  message += 'Tasks completed since last commit:\n';
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

  return message.trim();
}
