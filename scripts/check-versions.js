#!/usr/bin/env node

import { execSync, spawnSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

console.log(chalk.bold.blue('\n📊 Taskwerk Version Check\n'));

try {
  // Get local version
  const packageJsonPath = join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const localVersion = packageJson.version;

  // Get npm version
  const npmResult = spawnSync('npm', ['view', 'taskwerk', 'version'], {
    encoding: 'utf8',
    stdio: 'pipe'
  });
  const npmVersion = npmResult.stdout.trim();

  // Get latest GitHub release
  let githubVersion = 'none';
  try {
    const ghResult = spawnSync('gh', ['release', 'list', '--limit', '1', '--json', 'tagName'], {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    if (ghResult.status === 0 && ghResult.stdout) {
      const releases = JSON.parse(ghResult.stdout);
      if (releases.length > 0) {
        githubVersion = releases[0].tagName.replace('v', '');
      }
    }
  } catch {
    // gh not available
  }

  // Get all tags
  const tagsResult = execSync('git tag | grep "^v" | sort -V | tail -5').toString().trim();
  const tags = tagsResult.split('\n').map(t => t.replace('v', ''));

  // Display results
  console.log(chalk.cyan('Version Status:\n'));
  console.log(`Local (package.json): ${chalk.yellow(localVersion)}`);
  console.log(`NPM (published):      ${chalk.green(npmVersion)}`);
  console.log(`GitHub Release:       ${chalk.blue(githubVersion)}`);
  
  console.log(chalk.cyan('\nRecent Git Tags:'));
  tags.forEach(tag => {
    console.log(`  ${tag}`);
  });

  // Check for mismatches
  console.log(chalk.cyan('\nAnalysis:'));
  
  if (localVersion === npmVersion && npmVersion === githubVersion) {
    console.log(chalk.green('✅ All versions are in sync!'));
  } else {
    console.log(chalk.yellow('⚠️  Version mismatch detected:\n'));
    
    if (localVersion !== npmVersion) {
      console.log(chalk.yellow(`- Local version (${localVersion}) differs from NPM (${npmVersion})`));
    }
    
    if (npmVersion !== githubVersion) {
      console.log(chalk.yellow(`- NPM version (${npmVersion}) differs from GitHub release (${githubVersion})`));
    }
    
    // Recommendations
    console.log(chalk.cyan('\nRecommendations:'));
    
    if (githubVersion === 'none' || githubVersion < npmVersion) {
      console.log(chalk.blue('1. Create GitHub release for the NPM version:'));
      console.log(chalk.gray(`   gh release create v${npmVersion} --title "taskwerk ${npmVersion}" --generate-notes`));
    }
    
    if (localVersion < npmVersion) {
      console.log(chalk.blue('2. Update local version to match NPM:'));
      console.log(chalk.gray(`   npm version ${npmVersion} --no-git-tag-version`));
      console.log(chalk.gray(`   git add package.json package-lock.json`));
      console.log(chalk.gray(`   git commit -m "chore: sync version to ${npmVersion}"`));
    }
    
    if (localVersion > npmVersion) {
      console.log(chalk.blue('3. You have unpublished changes. Run make-release when ready.'));
    }
  }

  // Check for orphaned tags
  console.log(chalk.cyan('\nChecking for orphaned tags...'));
  for (const tag of tags) {
    const hasGitHub = tag === githubVersion;
    const hasNpm = tag === npmVersion;
    
    if (!hasGitHub && !hasNpm && tag !== localVersion) {
      console.log(chalk.red(`- Tag v${tag} exists but has no GitHub release or NPM publish`));
    }
  }

} catch (error) {
  console.error(chalk.red('Error:'), error.message);
  process.exit(1);
}