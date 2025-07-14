#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';

const packageJsonPath = join(process.cwd(), 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

console.log(chalk.bold.blue(`\n🚀 Taskwerk Release Script\n`));

async function getVersion() {
  const currentVersion = packageJson.version;
  
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

    // Check for uncommitted changes
    try {
      execSync('git diff-index --quiet HEAD --');
    } catch {
      console.log(chalk.red('❌ You have uncommitted changes. Please commit or stash them first.'));
      process.exit(1);
    }

    // Get new version
    const newVersion = await getVersion();
    
    console.log(chalk.blue(`\n📝 Preparing release v${newVersion}...\n`));

    // Run build and test cycle
    console.log(chalk.gray('Running build...'));
    try {
      execSync('npm run build', { stdio: 'inherit' });
    } catch (error) {
      console.log(chalk.red('❌ Build failed. Fix errors before releasing.'));
      process.exit(1);
    }

    console.log(chalk.gray('\nRunning tests...'));
    try {
      execSync('npm test', { stdio: 'inherit' });
    } catch (error) {
      console.log(chalk.red('❌ Tests failed. Fix them before releasing.'));
      process.exit(1);
    }

    // Update package.json version only if it changed
    const versionChanged = packageJson.version !== newVersion;
    if (versionChanged) {
      packageJson.version = newVersion;
      writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
      console.log(chalk.green(`✅ Updated package.json to v${newVersion}`));
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
      execSync(`gh release create ${tagName} --title "TaskWerk ${newVersion}" --notes-file ${releaseNotesFile} dist/taskwerk.js`, { stdio: 'inherit' });
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