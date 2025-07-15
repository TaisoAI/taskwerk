#!/usr/bin/env node

import { spawnSync } from 'child_process';
import chalk from 'chalk';

console.log(chalk.bold.blue('\n🔍 Checking CI Status\n'));

// Check if gh CLI is available
const ghCheck = spawnSync('gh', ['--version'], { stdio: 'pipe' });
if (ghCheck.status !== 0) {
  console.log(chalk.red('❌ GitHub CLI (gh) not found. Install from: https://cli.github.com'));
  process.exit(1);
}

// Get current branch
const branch = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
console.log(chalk.gray(`Current branch: ${branch}`));

// Get latest CI runs
console.log(chalk.gray('\nRecent CI runs:'));
const runs = spawnSync('gh', ['run', 'list', '--branch', branch, '--limit', '5'], { 
  encoding: 'utf8',
  stdio: 'inherit' 
});

// Get detailed info about the latest run
console.log(chalk.gray('\nLatest CI run details:'));
const latestRun = spawnSync('gh', ['run', 'view', '--json', 'status,conclusion,jobs'], {
  encoding: 'utf8',
  stdio: 'pipe'
});

if (latestRun.status === 0 && latestRun.stdout) {
  const runData = JSON.parse(latestRun.stdout);
  console.log(chalk.yellow(`Status: ${runData.status}`));
  console.log(chalk.yellow(`Conclusion: ${runData.conclusion || 'N/A'}`));
  
  if (runData.jobs && runData.jobs.length > 0) {
    console.log(chalk.gray('\nJob details:'));
    runData.jobs.forEach(job => {
      const icon = job.conclusion === 'success' ? '✅' : 
                   job.conclusion === 'failure' ? '❌' : 
                   job.status === 'in_progress' ? '⏳' : '❓';
      console.log(`${icon} ${job.name} (${job.conclusion || job.status})`);
    });
  }
}

// View logs of failed jobs
console.log(chalk.gray('\nTo view logs of failed jobs:'));
console.log(chalk.gray('gh run view --log-failed'));
console.log(chalk.gray('\nTo watch current CI run:'));
console.log(chalk.gray('gh run watch'));