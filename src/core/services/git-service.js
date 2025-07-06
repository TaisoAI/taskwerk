import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class GitService {
  constructor(options = {}) {
    this.cwd = options.cwd || process.cwd();
    this.silent = options.silent || false;
  }

  isGitRepository() {
    try {
      this._exec('git rev-parse --git-dir');
      return true;
    } catch {
      return false;
    }
  }

  getCurrentBranch() {
    try {
      return this._exec('git branch --show-current').trim();
    } catch {
      return null;
    }
  }

  getStatus() {
    try {
      const output = this._exec('git status --porcelain');
      return output.split('\n').filter(line => line.trim()).map(line => {
        const status = line.substring(0, 2).trim();
        const file = line.substring(3).trim();
        return {
          status,
          file
        };
      });
    } catch {
      return [];
    }
  }

  hasStagedChanges() {
    try {
      const output = this._exec('git diff --cached --name-only');
      return output.trim().length > 0;
    } catch {
      return false;
    }
  }

  hasUnstagedChanges() {
    try {
      const output = this._exec('git diff --name-only');
      return output.trim().length > 0;
    } catch {
      return false;
    }
  }

  createBranch(branchName, options = {}) {
    const { checkout = true, base = null } = options;
    
    if (!this.isGitRepository()) {
      throw new Error('Not a git repository');
    }

    // Check if branch already exists
    let branchExists = false;
    try {
      this._exec(`git rev-parse --verify ${branchName}`);
      branchExists = true;
    } catch {
      // Branch doesn't exist
    }
    
    if (branchExists) {
      if (checkout) {
        this._exec(`git checkout ${branchName}`);
        return { created: false, checked_out: true, branch: branchName };
      }
      throw new Error(`Branch ${branchName} already exists`);
    }

    // Create new branch
    const baseRef = base || this.getCurrentBranch() || 'HEAD';
    const checkoutFlag = checkout ? '-b' : '';
    
    try {
      if (checkout) {
        this._exec(`git checkout -b ${branchName} ${baseRef}`);
        return { created: true, checked_out: true, branch: branchName };
      } else {
        this._exec(`git branch ${branchName} ${baseRef}`);
        return { created: true, checked_out: false, branch: branchName };
      }
    } catch (error) {
      throw new Error(`Failed to create branch: ${error.message}`);
    }
  }

  async createTaskBranch(taskId, taskService, options = {}) {
    const { prefix = 'feature/', checkout = true, base = null } = options;
    
    // Get task details
    const task = await taskService.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const branchName = `${prefix}${task.string_id}`;
    const result = this.createBranch(branchName, { checkout, base });
    
    // Update task with branch info
    await taskService.updateTask(task.id, { branch: branchName });
    
    return result;
  }

  commit(message, options = {}) {
    const { addAll = false, push = false } = options;
    
    if (!this.isGitRepository()) {
      throw new Error('Not a git repository');
    }

    // Add files if requested
    if (addAll) {
      this._exec('git add -A');
    }

    // Check if there are staged changes
    if (!this.hasStagedChanges()) {
      throw new Error('No staged changes to commit');
    }

    // Commit
    try {
      this._exec(`git commit -m "${message.replace(/"/g, '\\"')}"`);
      
      // Push if requested
      if (push) {
        const branch = this.getCurrentBranch();
        this._exec(`git push origin ${branch}`);
      }
      
      return { committed: true, pushed: push };
    } catch (error) {
      throw new Error(`Failed to commit: ${error.message}`);
    }
  }

  async commitWithTask(taskId, taskService, options = {}) {
    const { message = null, push = false, close = false } = options;
    
    // Get task details
    const task = await taskService.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Generate commit message
    let commitMessage = message;
    if (!commitMessage) {
      // Get staged files
      const stagedFiles = this._exec('git diff --cached --name-only').trim().split('\n').filter(f => f);
      const fileCount = stagedFiles.length;
      
      if (fileCount === 0) {
        throw new Error('No staged changes to commit');
      }
      
      // Build commit message
      const action = fileCount === 1 ? 'Update' : 'Updates to';
      const fileDesc = fileCount === 1 ? path.basename(stagedFiles[0]) : `${fileCount} files`;
      
      commitMessage = `${task.string_id}: ${action} ${fileDesc}`;
      
      if (task.name) {
        commitMessage += `\n\nTask: ${task.name}`;
      }
      if (task.description) {
        commitMessage += `\n\n${task.description}`;
      }
    } else {
      // Ensure task ID is in the message
      if (!message.includes(task.string_id)) {
        commitMessage = `${task.string_id}: ${message}`;
      }
    }

    // Commit
    const result = this.commit(commitMessage, { push });
    
    // Mark task as completed if requested
    if (close && result.committed) {
      const stateMachine = await taskService.getStateMachine();
      await stateMachine.transitionTask(task.id, 'completed');
    }
    
    return { ...result, message: commitMessage };
  }

  getBranchesForTasks() {
    try {
      const branches = this._exec('git branch -a').split('\n')
        .map(b => b.trim().replace(/^\*\s*/, ''))
        .filter(b => b && b.includes('TASK-'));
      
      const taskBranches = {};
      branches.forEach(branch => {
        const match = branch.match(/TASK-\d+/);
        if (match) {
          const taskId = match[0];
          if (!taskBranches[taskId]) {
            taskBranches[taskId] = [];
          }
          taskBranches[taskId].push(branch);
        }
      });
      
      return taskBranches;
    } catch {
      return {};
    }
  }

  async syncTaskBranches(taskService, options = {}) {
    const { prune = false, update = false } = options;
    const results = { updated: [], pruned: [], errors: [] };
    
    if (!this.isGitRepository()) {
      throw new Error('Not a git repository');
    }

    const taskBranches = this.getBranchesForTasks();
    
    for (const [taskId, branches] of Object.entries(taskBranches)) {
      try {
        const task = await taskService.getTaskByStringId(taskId);
        
        if (update && task) {
          // Update task with branch info if not set
          if (!task.branch && branches.length > 0) {
            const localBranch = branches.find(b => !b.startsWith('remotes/')) || branches[0];
            await taskService.updateTask(task.id, { branch: localBranch });
            results.updated.push({ taskId, branch: localBranch });
          }
          
          // Check if task is completed and branch is merged
          if (task.status === 'completed' && prune) {
            for (const branch of branches) {
              if (!branch.startsWith('remotes/')) {
                try {
                  // Check if branch is merged
                  const merged = this._exec(`git branch --merged`).includes(branch);
                  if (merged) {
                    this._exec(`git branch -d ${branch}`);
                    results.pruned.push({ taskId, branch });
                  }
                } catch (error) {
                  results.errors.push({ taskId, branch, error: error.message });
                }
              }
            }
          }
        }
      } catch (error) {
        results.errors.push({ taskId, error: error.message });
      }
    }
    
    return results;
  }

  _exec(command) {
    try {
      return execSync(command, { 
        cwd: this.cwd, 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (error) {
      const errorMessage = error.stderr ? error.stderr.toString() : error.message;
      throw new Error(errorMessage);
    }
  }
}

export default GitService;