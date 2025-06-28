import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

export class SessionManager {
  constructor(config) {
    this.config = config;
    this.sessionFile = join(process.cwd(), '.task-session.json');
  }

  async getCurrentSession() {
    try {
      const content = await readFile(this.sessionFile, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return this.createDefaultSession();
      }
      throw error;
    }
  }

  async updateSession(updates) {
    const session = await this.getCurrentSession();
    const updatedSession = {
      ...session,
      ...updates,
      lastActivity: new Date().toISOString(),
    };

    await writeFile(this.sessionFile, JSON.stringify(updatedSession, null, 2), 'utf8');
    return updatedSession;
  }

  async startTask(taskId) {
    const session = await this.getCurrentSession();

    if (session.currentTask && session.currentTask !== taskId) {
      console.log(`⚠️  Switching from ${session.currentTask} to ${taskId}`);
    }

    return this.updateSession({
      currentTask: taskId,
      startedAt: new Date().toISOString(),
      agent: this.detectAgent(),
    });
  }

  async completeTask(taskId) {
    const session = await this.getCurrentSession();

    if (session.currentTask === taskId) {
      return this.updateSession({
        currentTask: null,
        startedAt: null,
      });
    }

    return session;
  }

  async pauseTask(taskId) {
    const session = await this.getCurrentSession();

    if (session.currentTask === taskId) {
      return this.updateSession({
        currentTask: null,
        startedAt: null,
      });
    }

    return session;
  }

  createDefaultSession() {
    return {
      currentTask: null,
      startedAt: null,
      branch: null,
      agent: this.detectAgent(),
      baseBranch: 'main',
      filesModified: [],
      lastActivity: new Date().toISOString(),
    };
  }

  detectAgent() {
    if (process.env.CLAUDE_CODE) {
      return 'Claude Code';
    }
    if (process.env.CURSOR) {
      return 'Cursor';
    }
    if (process.env.COPILOT) {
      return 'GitHub Copilot';
    }
    if (process.env.TERM_PROGRAM === 'vscode') {
      return 'VS Code';
    }
    return 'CLI';
  }
}
