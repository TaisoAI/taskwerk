import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class GitManager {
  async isGitRepository() {
    try {
      await execAsync('git rev-parse --git-dir');
      return true;
    } catch {
      return false;
    }
  }

  async getCurrentBranch() {
    try {
      const { stdout } = await execAsync('git branch --show-current');
      return stdout.trim();
    } catch {
      return 'main';
    }
  }

  async createTaskBranch(task) {
    if (!(await this.isGitRepository())) {
      throw new Error('Not a git repository');
    }

    const branchName = this.generateBranchName(task);

    try {
      // Create and switch to new branch
      await execAsync(`git checkout -b ${branchName}`);
      return branchName;
    } catch (error) {
      // If branch already exists, just switch to it
      try {
        await execAsync(`git checkout ${branchName}`);
        return branchName;
      } catch {
        throw new Error(`Failed to create or switch to branch: ${branchName}`);
      }
    }
  }

  async createTaskCommit(task, _session) {
    if (!(await this.isGitRepository())) {
      throw new Error('Not a git repository');
    }

    const changedFiles = await this.getChangedFiles();

    if (changedFiles.length === 0) {
      throw new Error('No changes to commit');
    }

    // Stage all changes
    await execAsync('git add .');

    const commitMessage = this.generateCommitMessage(task, changedFiles);

    try {
      await execAsync(`git commit -m "${commitMessage}"`);
      const commitHash = await this.getLatestCommitHash();

      return {
        message: commitMessage,
        hash: commitHash,
        files: changedFiles,
      };
    } catch (error) {
      throw new Error(`Failed to commit: ${error.message}`);
    }
  }

  async getChangedFiles() {
    try {
      const { stdout } = await execAsync('git diff --name-only HEAD');
      const stagedFiles = await execAsync('git diff --cached --name-only');

      const changed = stdout
        .trim()
        .split('\n')
        .filter(f => f);
      const staged = stagedFiles.stdout
        .trim()
        .split('\n')
        .filter(f => f);

      return [...new Set([...changed, ...staged])];
    } catch {
      return [];
    }
  }

  async getLatestCommitHash() {
    try {
      const { stdout } = await execAsync('git rev-parse HEAD');
      return stdout.trim().substring(0, 7);
    } catch {
      return null;
    }
  }

  async getFileChangesSince(commit) {
    try {
      const { stdout } = await execAsync(`git diff --name-only ${commit}..HEAD`);
      return stdout
        .trim()
        .split('\n')
        .filter(f => f);
    } catch {
      return [];
    }
  }

  generateBranchName(task) {
    const description = task.description
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 40);

    const taskNumber = task.id.split('-')[1];

    return `feature/task-${taskNumber}-${description}`;
  }

  generateCommitMessage(task, files) {
    const shortDescription =
      task.description.length > 50 ? task.description.substring(0, 47) + '...' : task.description;

    let message = `${task.id}: ${shortDescription}`;

    if (files.length <= 3) {
      message += `\n\nFiles: ${files.join(', ')}`;
    } else {
      message += `\n\nFiles: ${files.slice(0, 3).join(', ')} and ${files.length - 3} more`;
    }

    return message;
  }

  async hasUncommittedChanges() {
    try {
      const { stdout } = await execAsync('git status --porcelain');
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  async pushBranch(branchName) {
    try {
      await execAsync(`git push -u origin ${branchName}`);
      return true;
    } catch {
      return false;
    }
  }
}
