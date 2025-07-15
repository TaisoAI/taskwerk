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
  const { versionType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'versionType',
      message: `Current version is ${chalk.yellow(currentVersion)}. What would you like to do?`,
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

    // Check CI status on main branch
    if (branch === 'main') {
      console.log(chalk.gray('Checking CI status...'));
      try {
        // Check if gh CLI is available
        const ghCheck = spawnSync('gh', ['--version'], { stdio: 'pipe' });
        if (ghCheck.status === 0) {
          // Get latest CI run status
          const ciStatus = spawnSync('gh', ['run', 'list', '--branch', 'main', '--limit', '1', '--json', 'status,conclusion'], {
            encoding: 'utf8',
            stdio: 'pipe'
          });
          
          if (ciStatus.status === 0 && ciStatus.stdout) {
            const runs = JSON.parse(ciStatus.stdout);
            if (runs.length > 0 && runs[0].conclusion === 'failure') {
              console.log(chalk.red('❌ Latest CI run on main branch failed!'));
              console.log(chalk.yellow('Creating a release with failing CI can lead to npm publish failures.'));
              
              const { proceedWithFailingCI } = await inquirer.prompt([
                {
                  type: 'confirm',
                  name: 'proceedWithFailingCI',
                  message: 'CI is failing. Continue anyway?',
                  default: false
                }
              ]);
              
              if (!proceedWithFailingCI) {
                console.log(chalk.red('Release cancelled. Please fix CI failures first.'));
                console.log(chalk.gray('Tip: Use a feature branch to fix issues, then merge to main.'));
                process.exit(0);
              }
            } else if (runs.length > 0 && runs[0].status === 'in_progress') {
              console.log(chalk.yellow('⏳ CI is currently running on main branch.'));
              const { waitForCI } = await inquirer.prompt([
                {
                  type: 'confirm',
                  name: 'waitForCI',
                  message: 'Wait for CI to complete?',
                  default: true
                }
              ]);
              
              if (!waitForCI) {
                console.log(chalk.yellow('⚠️  Proceeding without waiting for CI to complete.'));
              } else {
                console.log(chalk.red('Please wait for CI to complete and run make-release again.'));
                process.exit(0);
              }
            }
          }
        }
      } catch (error) {
        // gh CLI not available or error checking status, continue with warning
        console.log(chalk.yellow('⚠️  Could not check CI status. Make sure CI is passing before releasing.'));
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
    let commits = '';
    
    if (lastTag) {
      commits = execSync(`git log ${lastTag}..HEAD --pretty=format:"- %s (%h)" --no-merges`).toString();
    } else {
      commits = execSync('git log --pretty=format:"- %s (%h)" --no-merges').toString();
    }
    
    console.log(chalk.gray('Recent commits:'));
    console.log(commits);
    
    const { releaseNotes } = await inquirer.prompt([
      {
        type: 'editor',
        name: 'releaseNotes',
        message: 'Edit release notes (Markdown supported):',
        default: `## What's Changed\n\n${commits}\n\n## Installation\n\n\`\`\`bash\nnpm install -g taskwerk@${newVersion}\n\`\`\`\n`
      }
    ]);

    // Confirm release
    console.log(chalk.blue('\n📦 Release Summary:\n'));
    console.log(`Version: ${chalk.yellow(newVersion)}`);
    console.log(`Branch: ${chalk.yellow(branch)}`);
    console.log('\nRelease Notes:');
    console.log(chalk.gray(releaseNotes));
    
    const { confirmRelease } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmRelease',
        message: chalk.bold('Create this release?'),
        default: true
      }
    ]);

    if (!confirmRelease) {
      // Revert package.json
      execSync('git checkout -- package.json');
      console.log(chalk.red('Release cancelled.'));
      process.exit(0);
    }

    // Commit version bump only if version changed
    if (versionChanged) {
      execSync('git add package.json');
      execSync(`git commit -m "chore: bump version to ${newVersion}"`);
      console.log(chalk.green('✅ Committed version bump'));
    }

    // Create and push tag
    const tagName = `v${newVersion}`;
    execSync(`git tag -a ${tagName} -m "Release ${tagName}"`);
    console.log(chalk.green(`✅ Created tag ${tagName}`));

    // Push changes
    console.log(chalk.gray('\nPushing to GitHub...'));
    execSync('git push origin main');
    execSync(`git push origin ${tagName}`);
    console.log(chalk.green('✅ Pushed to GitHub'));

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
    console.log(chalk.gray('Next steps:'));
    console.log(chalk.gray('1. The GitHub Actions workflow will automatically publish to npm'));
    console.log(chalk.gray('2. Or publish manually with: npm publish'));

  } catch (error) {
    console.error(chalk.red('\n❌ Release failed:'), error.message);
    process.exit(1);
  }
}

// Run the script
run();