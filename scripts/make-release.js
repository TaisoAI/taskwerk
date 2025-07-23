#!/usr/bin/env node

import { execSync, spawnSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';

console.log(chalk.bold.blue(`\n🚀 Taskwerk Release Script\n`));

// Helper to check if a GitHub release exists
function checkGitHubRelease(version) {
  try {
    // First check if gh CLI is available
    const ghCheck = spawnSync('gh', ['--version'], { stdio: 'pipe' });
    if (ghCheck.status !== 0) {
      // gh CLI not available, skip check
      return false;
    }
    
    const result = spawnSync('gh', ['release', 'view', `v${version}`], { 
      encoding: 'utf8',
      stdio: 'pipe' 
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

// Helper to check if an npm version exists
function checkNpmVersion(packageName, version) {
  try {
    const result = spawnSync('npm', ['view', `${packageName}@${version}`, 'version'], {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    return result.stdout.trim() === version;
  } catch {
    return false;
  }
}

// Helper to get CLI version
function getCliVersion() {
  try {
    const result = spawnSync('node', ['bin/taskwerk.js', '--version'], {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    return result.stdout.trim();
  } catch {
    return null;
  }
}

// Helper to check if git tag exists (local or remote)
function checkGitTag(tag) {
  try {
    execSync(`git rev-parse --verify ${tag}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

async function getVersion(currentVersion) {
  // Check if we're on a dev version
  const isDevVersion = currentVersion.includes('-dev.');
  
  let message = `Current version is ${chalk.yellow(currentVersion)}. What would you like to do?`;
  if (isDevVersion) {
    message = chalk.yellow(`⚠️  You're on a development version (${currentVersion}). Run 'npm run dev:finalize' first!`);
  }
  
  const { versionType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'versionType',
      message: message,
      choices: [
        { name: `Release current version (${currentVersion})`, value: 'current' },
        { name: 'Patch bump (bug fixes)', value: 'patch' },
        { name: 'Minor bump (new features)', value: 'minor' },
        { name: 'Major bump (breaking changes)', value: 'major' },
        { name: 'Custom version', value: 'custom' }
      ]
    }
  ]);

  if (versionType === 'current') {
    return currentVersion;
  }

  if (versionType === 'custom') {
    const { customVersion } = await inquirer.prompt([
      {
        type: 'input',
        name: 'customVersion',
        message: 'Enter custom version:',
        validate: (input) => {
          if (!/^\d+\.\d+\.\d+/.test(input)) {
            return 'Version must be in format X.Y.Z';
          }
          return true;
        }
      }
    ]);
    return customVersion;
  }

  // Calculate new version
  const [major, minor, patch] = currentVersion.split('.').map(Number);
  
  switch (versionType) {
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'major':
      return `${major + 1}.0.0`;
  }
}

// Helper to wait for CI to complete
async function waitForCICompletion(commitSha, timeout = 300000) { // 5 minutes default
  console.log(chalk.gray('\n⏱️  Waiting for CI to complete...'));
  console.log(chalk.gray('You can check the status at: https://github.com/taisoai/taskwerk/actions'));
  console.log(chalk.gray(`Waiting for CI run for commit: ${commitSha.substring(0, 7)}`));
  
  const startTime = Date.now();
  let lastStatus = null;
  let dotCount = 0;
  let foundRun = false;
  
  // First wait for the CI run to appear
  while (!foundRun && Date.now() - startTime < 30000) { // 30 seconds to find the run
    try {
      const result = spawnSync('gh', [
        'run', 'list', 
        '--branch', 'main', 
        '--workflow', 'ci.yml',
        '--limit', '5', 
        '--json', 'status,conclusion,name,databaseId,headSha'
      ], {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      if (result.status === 0 && result.stdout) {
        const runs = JSON.parse(result.stdout);
        const ourRun = runs.find(run => run.headSha === commitSha);
        if (ourRun) {
          foundRun = true;
          console.log(chalk.gray(`\nFound CI run for our commit`));
          break;
        }
      }
    } catch {
      // Ignore errors
    }
    
    process.stdout.write('.');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  if (!foundRun) {
    console.log(chalk.yellow('\n⚠️  Could not find CI run for the pushed commit'));
    const { continueAnyway } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'continueAnyway',
        message: 'Could not find CI run. Continue anyway?',
        default: false
      }
    ]);
    return continueAnyway;
  }
  
  // Now wait for it to complete
  dotCount = 0;
  while (Date.now() - startTime < timeout) {
    try {
      // Get workflow runs for our commit
      const result = spawnSync('gh', [
        'run', 'list', 
        '--branch', 'main',
        '--workflow', 'ci.yml', 
        '--limit', '5', 
        '--json', 'status,conclusion,name,databaseId,headSha'
      ], {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      if (result.status === 0 && result.stdout) {
        const runs = JSON.parse(result.stdout);
        const ourRun = runs.find(run => run.headSha === commitSha);
        
        if (ourRun) {
          if (ourRun.status !== lastStatus) {
            lastStatus = ourRun.status;
            console.log(chalk.gray(`\nCI status: ${ourRun.status} (${ourRun.name})`));
            dotCount = 0;
          } else {
            // Show progress dots
            process.stdout.write('.');
            dotCount++;
            if (dotCount > 50) {
              console.log();
              dotCount = 0;
            }
          }
          
          if (ourRun.status === 'completed') {
            console.log(); // New line after dots
            if (ourRun.conclusion === 'success') {
              console.log(chalk.green('✅ CI passed!'));
              return true;
            } else {
              console.log(chalk.red(`❌ CI failed with conclusion: ${ourRun.conclusion}`));
              console.log(chalk.yellow(`View logs: https://github.com/taisoai/taskwerk/actions/runs/${ourRun.databaseId}`));
              return false;
            }
          }
        }
      }
    } catch (error) {
      // Ignore errors and continue waiting
    }
    
    // Wait 5 seconds before checking again
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  // Timeout reached
  console.log(chalk.yellow('\n⚠️  CI check timed out'));
  const { continueAnyway } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'continueAnyway',
      message: 'CI status check timed out. Continue anyway?',
      default: false
    }
  ]);
  
  return continueAnyway;
}

async function run() {
  try {
    // Check if we're on main branch
    const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
    if (branch !== 'main') {
      console.log(chalk.yellow(`⚠️  You're on branch '${branch}', not 'main'.`));
      const { proceed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'proceed',
          message: 'Continue anyway?',
          default: false
        }
      ]);
      if (!proceed) {
        console.log(chalk.red('Release cancelled.'));
        process.exit(0);
      }
    }

    // Read current package.json
    const packageJsonPath = join(process.cwd(), 'package.json');
    let packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    const currentVersion = packageJson.version;

    // Get new version
    const newVersion = await getVersion(currentVersion);
    
    console.log(chalk.blue(`\n📝 Preparing release v${newVersion}...\n`));

    // Check if release already exists
    console.log(chalk.gray('Checking for existing releases...'));
    const tagName = `v${newVersion}`;
    const hasGitTag = checkGitTag(tagName);
    const hasGitHubRelease = checkGitHubRelease(newVersion);
    const hasNpmRelease = checkNpmVersion('taskwerk', newVersion);
    
    if (hasGitTag || hasGitHubRelease || hasNpmRelease) {
      console.log(chalk.red(`\n❌ Version ${newVersion} already exists:`));
      if (hasGitTag) {
        console.log(chalk.red(`   - Git tag ${tagName} exists`));
      }
      if (hasGitHubRelease) {
        console.log(chalk.red(`   - GitHub release v${newVersion} exists`));
      }
      if (hasNpmRelease) {
        console.log(chalk.red(`   - npm package taskwerk@${newVersion} exists`));
      }
      console.log(chalk.yellow('\nPlease choose a different version.'));
      process.exit(1);
    }

    // Update package.json version only if it changed
    const versionChanged = currentVersion !== newVersion;
    if (versionChanged) {
      packageJson.version = newVersion;
      writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
      console.log(chalk.green(`✅ Updated package.json to v${newVersion}`));
    }

    // Step 1: Run full build
    console.log(chalk.blue('\n🔨 Step 1: Running full build...'));
    try {
      execSync('npm run build', { stdio: 'inherit' });
      console.log(chalk.green('✅ Build completed successfully'));
    } catch (error) {
      console.log(chalk.red('❌ Build failed. Fix errors before releasing.'));
      if (versionChanged) {
        execSync('git checkout -- package.json');
        console.log(chalk.gray('Reverted package.json'));
      }
      process.exit(1);
    }

    // Verify CLI version matches after build
    const postBuildCliVersion = getCliVersion();
    if (postBuildCliVersion !== newVersion) {
      console.log(chalk.red(`❌ CLI version mismatch after build:`));
      console.log(chalk.red(`   Expected: ${newVersion}`));
      console.log(chalk.red(`   Actual:   ${postBuildCliVersion}`));
      if (versionChanged) {
        execSync('git checkout -- package.json');
        console.log(chalk.gray('Reverted package.json'));
      }
      process.exit(1);
    }

    // Step 2: Run full test suite
    console.log(chalk.blue('\n🧪 Step 2: Running full test suite...'));
    try {
      execSync('npm test', { stdio: 'inherit' });
      console.log(chalk.green('✅ All tests passed'));
    } catch (error) {
      console.log(chalk.red('❌ Tests failed. Fix them before releasing.'));
      if (versionChanged) {
        execSync('git checkout -- package.json');
        console.log(chalk.gray('Reverted package.json'));
      }
      process.exit(1);
    }

    // Step 3: Check git status
    console.log(chalk.blue('\n📋 Step 3: Checking git status...'));
    
    // Show ALL files including untracked (like dist/)
    console.log(chalk.gray('All changed files (including build artifacts):'));
    execSync('git status --porcelain', { stdio: 'inherit' });
    
    // Check for uncommitted changes (staged or unstaged)
    let hasChanges = false;
    try {
      const statusOutput = execSync('git status --porcelain').toString();
      hasChanges = statusOutput.trim().length > 0;
    } catch {
      hasChanges = true;
    }

    if (hasChanges) {
      console.log(chalk.yellow('\n📝 Changes detected after build:'));
      
      const { commitChanges } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'commitChanges',
          message: 'Commit these changes?',
          default: true
        }
      ]);
      
      if (!commitChanges) {
        console.log(chalk.red('❌ Cannot proceed with uncommitted changes.'));
        if (versionChanged) {
          execSync('git checkout -- package.json');
          console.log(chalk.gray('Reverted package.json'));
        }
        process.exit(1);
      }
    }

    // Get release notes before committing
    console.log(chalk.blue('\n📋 Generate release notes:\n'));
    
    const lastTag = execSync('git describe --tags --abbrev=0 2>/dev/null || echo ""').toString().trim();
    let commitMessages = '';
    
    if (lastTag) {
      commitMessages = execSync(`git log ${lastTag}..HEAD --pretty=format:"- %s"`).toString();
    } else {
      commitMessages = execSync('git log --pretty=format:"- %s"').toString();
    }

    console.log(chalk.gray('Recent commits:'));
    console.log(chalk.gray(commitMessages));

    const { releaseNotes } = await inquirer.prompt([
      {
        type: 'editor',
        name: 'releaseNotes',
        message: 'Edit release notes:',
        default: `# taskwerk ${newVersion}\n\n## Changes\n\n${commitMessages}\n`
      }
    ]);

    // Step 4: Commit changes
    if (versionChanged) {
      console.log(chalk.blue('\n📝 Step 4: Committing version bump...'));
      execSync('git add package.json package-lock.json');
      execSync(`git commit -m "chore: bump version to ${newVersion} for release"`);
      console.log(chalk.green('✅ Committed version bump'));
    }

    // Confirm before pushing
    console.log(chalk.blue('\n📦 Release Summary:\n'));
    console.log(`Version: ${chalk.yellow(currentVersion)} → ${chalk.green(newVersion)}`);
    console.log(`Branch: ${chalk.cyan(branch)}`);
    console.log('\nRelease notes preview:');
    console.log(chalk.gray(releaseNotes.split('\n').slice(0, 10).join('\n')));
    if (releaseNotes.split('\n').length > 10) {
      console.log(chalk.gray('...'));
    }

    const { confirmPush } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmPush',
        message: `Push to main and wait for CI?`,
        default: true
      }
    ]);

    if (!confirmPush) {
      console.log(chalk.yellow('Release cancelled.'));
      if (versionChanged) {
        execSync('git reset --soft HEAD~1');
        execSync('git checkout -- package.json package-lock.json');
        console.log(chalk.gray('Reverted commits and package.json'));
      }
      process.exit(0);
    }

    // Step 5: Push and wait for CI
    console.log(chalk.blue('\n🚀 Step 5: Pushing to main...'));
    execSync('git push origin main');
    console.log(chalk.green('✅ Pushed to main'));
    
    // Get the commit SHA we just pushed
    const pushedCommitSha = execSync('git rev-parse HEAD').toString().trim();

    // Wait for CI to complete
    const ciPassed = await waitForCICompletion(pushedCommitSha);
    
    if (!ciPassed) {
      console.log(chalk.red('\n❌ CI failed or was cancelled.'));
      console.log(chalk.yellow('The version bump has been pushed, but no tag or release was created.'));
      console.log(chalk.yellow('You can:'));
      console.log(chalk.yellow('  1. Fix the CI issues and run make-release again with "current version"'));
      console.log(chalk.yellow('  2. Revert the version bump commit if needed'));
      process.exit(1);
    }

    // Step 6: Create and push tag (this triggers release workflow)
    console.log(chalk.blue('\n🏷️  Step 6: Creating release tag...'));
    
    // Create annotated tag with release notes
    const tagMessage = `Release ${tagName}\n\n${releaseNotes}`;
    execSync(`git tag -a ${tagName} -m "${tagMessage.replace(/"/g, '\\"')}"`);
    console.log(chalk.green(`✅ Created tag ${tagName}`));

    execSync(`git push origin ${tagName}`);
    console.log(chalk.green('✅ Pushed tag (this will trigger the release workflow)'));

    // Step 7: Monitor release workflow
    console.log(chalk.blue('\n📦 Step 7: Release workflow triggered...'));
    console.log(chalk.gray('The release workflow will:'));
    console.log(chalk.gray('  1. Create GitHub release'));
    console.log(chalk.gray('  2. Publish to npm'));
    console.log(chalk.gray('\nYou can monitor progress at:'));
    console.log(chalk.cyan(`https://github.com/taisoai/taskwerk/actions`));

    // Optionally wait for release workflow
    const { waitForRelease } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'waitForRelease',
        message: 'Wait for release workflow to complete?',
        default: true
      }
    ]);

    if (waitForRelease) {
      console.log(chalk.gray('\nWaiting for release workflow...'));
      
      // Give it a moment for the workflow to start
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Check release workflow status
      const releaseSuccess = await waitForReleaseWorkflow(tagName);
      
      if (releaseSuccess) {
        console.log(chalk.bold.green(`\n🎉 Release v${newVersion} completed successfully!\n`));
        console.log(chalk.green(`GitHub Release: https://github.com/taisoai/taskwerk/releases/tag/${tagName}`));
        console.log(chalk.green(`npm Package: https://www.npmjs.com/package/taskwerk/v/${newVersion}`));
      } else {
        console.log(chalk.yellow('\n⚠️  Release workflow may have issues.'));
        console.log(chalk.yellow('Check the workflow status and logs for details.'));
      }
    } else {
      console.log(chalk.bold.green(`\n🎉 Release v${newVersion} tag created!\n`));
      console.log(chalk.gray('The release workflow will complete in the background.'));
    }

  } catch (error) {
    console.error(chalk.red('\n❌ Release failed:'), error.message);
    process.exit(1);
  }
}

// Helper to wait for release workflow
async function waitForReleaseWorkflow(tag, timeout = 600000) { // 10 minutes
  const startTime = Date.now();
  let lastStatus = null;
  let dotCount = 0;
  
  while (Date.now() - startTime < timeout) {
    try {
      // Get workflow runs for the tag
      const result = spawnSync('gh', [
        'run', 'list', 
        '--workflow', 'release.yml',
        '--limit', '1', 
        '--json', 'status,conclusion,name,databaseId'
      ], {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      if (result.status === 0 && result.stdout) {
        const runs = JSON.parse(result.stdout);
        if (runs.length > 0) {
          const run = runs[0];
          
          if (run.status !== lastStatus) {
            lastStatus = run.status;
            console.log(chalk.gray(`\nRelease workflow status: ${run.status}`));
            dotCount = 0;
          } else {
            process.stdout.write('.');
            dotCount++;
            if (dotCount > 50) {
              console.log();
              dotCount = 0;
            }
          }
          
          if (run.status === 'completed') {
            console.log(); // New line after dots
            return run.conclusion === 'success';
          }
        }
      }
    } catch (error) {
      // Ignore errors
    }
    
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  return false;
}

// Run the script
run();