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
async function waitForCICompletion(timeout = 300000) { // 5 minutes default
  console.log(chalk.gray('\nWaiting for CI to complete...'));
  
  const startTime = Date.now();
  let lastStatus = null;
  
  while (Date.now() - startTime < timeout) {
    try {
      // Get latest workflow run
      const result = spawnSync('gh', [
        'run', 'list', 
        '--branch', 'main', 
        '--limit', '1', 
        '--json', 'status,conclusion,name'
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
            console.log(chalk.gray(`CI status: ${run.status}`));
          }
          
          if (run.status === 'completed') {
            return run.conclusion === 'success';
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
  console.log(chalk.yellow('⚠️  CI check timed out'));
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

    // Check for uncommitted changes
    try {
      execSync('git diff-index --quiet HEAD --');
    } catch {
      console.log(chalk.red('❌ You have uncommitted changes. Please commit or stash them first.'));
      process.exit(1);
    }

    // Read current package.json
    const packageJsonPath = join(process.cwd(), 'package.json');
    let packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    const currentVersion = packageJson.version;

    // Check version consistency
    console.log(chalk.gray('Checking version consistency...'));
    const cliVersion = getCliVersion();
    if (cliVersion && cliVersion !== currentVersion) {
      console.log(chalk.yellow(`⚠️  Version mismatch detected:`));
      console.log(chalk.yellow(`   package.json: ${currentVersion}`));
      console.log(chalk.yellow(`   CLI version:  ${cliVersion}`));
      console.log(chalk.yellow(`   Running build to sync versions...`));
      
      try {
        execSync('npm run build', { stdio: 'inherit' });
      } catch (error) {
        console.log(chalk.red('❌ Build failed. Fix errors before releasing.'));
        process.exit(1);
      }
    }

    // Get new version
    const newVersion = await getVersion(currentVersion);
    
    console.log(chalk.blue(`\n📝 Preparing release v${newVersion}...\n`));

    // Check if release already exists
    console.log(chalk.gray('Checking for existing releases...'));
    const hasGitHubRelease = checkGitHubRelease(newVersion);
    const hasNpmRelease = checkNpmVersion('taskwerk', newVersion);
    
    if (hasGitHubRelease || hasNpmRelease) {
      console.log(chalk.red(`\n❌ Version ${newVersion} already exists:`));
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
      
      // Reload package.json for later use
      packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    }

    // Run build (which will update version.js)
    console.log(chalk.gray('\nRunning build...'));
    try {
      execSync('npm run build', { stdio: 'inherit' });
    } catch (error) {
      console.log(chalk.red('❌ Build failed. Fix errors before releasing.'));
      // Revert package.json if we changed it
      if (versionChanged) {
        execSync('git checkout -- package.json');
      }
      process.exit(1);
    }

    // Run tests
    console.log(chalk.gray('\nRunning tests...'));
    try {
      execSync('npm test', { stdio: 'inherit' });
    } catch (error) {
      console.log(chalk.red('❌ Tests failed. Fix them before releasing.'));
      // Revert package.json if we changed it
      if (versionChanged) {
        execSync('git checkout -- package.json');
      }
      process.exit(1);
    }

    // Verify CLI version matches after build
    const postBuildCliVersion = getCliVersion();
    if (postBuildCliVersion !== newVersion) {
      console.log(chalk.red(`❌ CLI version mismatch after build:`));
      console.log(chalk.red(`   Expected: ${newVersion}`));
      console.log(chalk.red(`   Actual:   ${postBuildCliVersion}`));
      // Revert package.json if we changed it
      if (versionChanged) {
        execSync('git checkout -- package.json');
      }
      process.exit(1);
    }

    // Get release notes
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

    // Confirm release
    console.log(chalk.blue('\n📦 Release Summary:\n'));
    console.log(`Version: ${chalk.yellow(currentVersion)} → ${chalk.green(newVersion)}`);
    console.log(`Branch: ${chalk.cyan(branch)}`);
    console.log('\nRelease notes:');
    console.log(chalk.gray(releaseNotes.split('\n').slice(0, 10).join('\n')));
    if (releaseNotes.split('\n').length > 10) {
      console.log(chalk.gray('...'));
    }

    const { confirmRelease } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmRelease',
        message: `Ready to release v${newVersion}?`,
        default: true
      }
    ]);

    if (!confirmRelease) {
      console.log(chalk.yellow('Release cancelled.'));
      // Revert package.json if we changed it
      if (versionChanged) {
        execSync('git checkout -- package.json');
      }
      process.exit(0);
    }

    // Commit version bump only if version changed
    if (versionChanged) {
      execSync('git add package.json');
      execSync(`git commit -m "chore: bump version to ${newVersion}"`);
      console.log(chalk.green('✅ Committed version bump'));
    }

    // Push to main (but not the tag yet)
    console.log(chalk.gray('\nPushing to main...'));
    execSync('git push origin main');
    console.log(chalk.green('✅ Pushed to main'));

    // Wait for CI to complete
    const ciPassed = await waitForCICompletion();
    
    if (!ciPassed) {
      console.log(chalk.red('\n❌ CI failed or was cancelled.'));
      console.log(chalk.yellow('The version bump has been pushed, but no tag or release was created.'));
      console.log(chalk.yellow('Fix the CI issues and run make-release again.'));
      process.exit(1);
    }

    console.log(chalk.green('✅ CI passed!'));

    // Create and push tag
    const tagName = `v${newVersion}`;
    execSync(`git tag -a ${tagName} -m "Release ${tagName}"`);
    console.log(chalk.green(`✅ Created tag ${tagName}`));

    execSync(`git push origin ${tagName}`);
    console.log(chalk.green('✅ Pushed tag'));

    // Create GitHub release using gh CLI
    console.log(chalk.gray('\nCreating GitHub release...'));
    
    try {
      execSync('gh --version', { stdio: 'ignore' });
    } catch {
      console.log(chalk.yellow('\n⚠️  GitHub CLI (gh) not found.'));
      console.log(chalk.yellow('Install it from: https://cli.github.com'));
      console.log(chalk.yellow('\nThe tag has been pushed. You can create the release manually on GitHub.'));
      process.exit(0);
    }

    // Save release notes to temp file
    const releaseNotesFile = `/tmp/taskwerk-release-notes-${Date.now()}.md`;
    writeFileSync(releaseNotesFile, releaseNotes);

    try {
      // Use newVersion to ensure consistency
      execSync(`gh release create ${tagName} --title "taskwerk ${newVersion}" --notes-file ${releaseNotesFile} dist/taskwerk.js`, { stdio: 'inherit' });
      console.log(chalk.green(`\n✅ GitHub release created: https://github.com/taisoai/taskwerk/releases/tag/${tagName}`));
    } catch (error) {
      console.log(chalk.yellow('\n⚠️  Failed to create GitHub release. You can create it manually.'));
    }

    console.log(chalk.bold.green(`\n🎉 Release v${newVersion} completed!\n`));
    console.log(chalk.gray('The tag will trigger automatic npm publish via GitHub Actions.'));

  } catch (error) {
    console.error(chalk.red('\n❌ Release failed:'), error.message);
    process.exit(1);
  }
}

// Run the script
run();