import { readFile, writeFile } from 'fs/promises';
import { TaskParser } from './task-parser.js';
import { SessionManager } from './session-manager.js';
import { generateTaskId } from '../utils/id-generator.js';

export class TaskManager {
  constructor(config) {
    this.config = config;
    this.parser = new TaskParser();
    this.sessionManager = new SessionManager(config);
  }

  async addTask({ description, priority = 'medium', category }) {
    const tasksFile = this.config.tasksFile;
    const content = await this._readTasksFile();

    const tasks = this.parser.parseTasks(content);

    // Also get completed tasks to avoid ID conflicts
    const completedContent = await this._readCompletedFile();
    const completedTasks = this.parser.parseTasks(completedContent);

    // Combine both active and completed tasks for ID generation
    const allTasks = [...tasks, ...completedTasks];
    const taskId = generateTaskId(allTasks);

    const task = {
      id: taskId,
      description,
      priority,
      category,
      status: 'todo',
      createdAt: new Date().toISOString(),
    };

    const updatedContent = this.parser.addTaskToContent(content, task, allTasks);
    await writeFile(tasksFile, updatedContent, 'utf8');

    return task;
  }

  async getTasks(filters = {}) {
    const content = await this._readTasksFile();
    const tasks = this.parser.parseTasks(content);

    return this._filterTasks(tasks, filters);
  }

  async getTask(taskId) {
    const tasks = await this.getTasks();
    const task = tasks.find(t => t.id === taskId);

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    return task;
  }

  async startTask(taskId) {
    const task = await this.getTask(taskId);

    if (task.status === 'in_progress') {
      throw new Error(`Task ${taskId} is already in progress`);
    }

    await this._updateTaskStatus(taskId, 'in_progress');
    await this.sessionManager.startTask(taskId);

    return { ...task, status: 'in_progress' };
  }

  async completeTask(taskId, options = {}) {
    const task = await this.getTask(taskId);
    const session = await this.sessionManager.getCurrentSession();

    // Add session info to completion options
    const completionOptions = {
      ...options,
      filesChanged: session.filesModified || [],
    };

    await this._moveTaskToCompleted(task, completionOptions);
    await this.sessionManager.completeTask(taskId);

    return task;
  }

  async pauseTask(taskId) {
    const task = await this.getTask(taskId);

    await this._updateTaskStatus(taskId, 'todo');
    await this.sessionManager.pauseTask(taskId);

    return { ...task, status: 'todo' };
  }

  async searchTasks(query) {
    const tasks = await this.getTasks();
    const lowercaseQuery = query.toLowerCase();

    return tasks.filter(
      task =>
        task.description.toLowerCase().includes(lowercaseQuery) ||
        (task.category && task.category.toLowerCase().includes(lowercaseQuery))
    );
  }

  async getStats() {
    const tasks = await this.getTasks();
    const completedContent = await this._readCompletedFile();
    const completedTasks = this.parser.parseTasks(completedContent);

    return {
      total: tasks.length,
      todo: tasks.filter(t => t.status === 'todo').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      blocked: tasks.filter(t => t.status === 'blocked').length,
      completed: completedTasks.length,
      priorities: {
        high: tasks.filter(t => t.priority === 'high').length,
        medium: tasks.filter(t => t.priority === 'medium').length,
        low: tasks.filter(t => t.priority === 'low').length,
      },
    };
  }

  async getRecentlyCompleted(limit = 10) {
    const content = await this._readCompletedFile();
    const tasks = this.parser.parseTasks(content);

    return tasks.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt)).slice(0, limit);
  }

  async getCurrentSession() {
    return this.sessionManager.getCurrentSession();
  }

  async updateSession(updates) {
    return this.sessionManager.updateSession(updates);
  }

  async getTaskContext(taskId) {
    const session = await this.getCurrentSession();
    const task = await this.getTask(taskId);

    return {
      task,
      session,
      relatedFiles: session.filesModified || [],
      branch: session.branch,
      baseBranch: session.baseBranch,
    };
  }

  async _readTasksFile() {
    try {
      return await readFile(this.config.tasksFile, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(
          `Tasks file not found: ${this.config.tasksFile}. Run 'taskwerk init' first.`
        );
      }
      throw error;
    }
  }

  async _readCompletedFile() {
    try {
      return await readFile(this.config.completedFile, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        return '# Completed Tasks\n\n';
      }
      throw error;
    }
  }

  async _updateTaskStatus(taskId, status) {
    const content = await this._readTasksFile();
    const updatedContent = this.parser.updateTaskStatus(content, taskId, status);
    await writeFile(this.config.tasksFile, updatedContent, 'utf8');
  }

  async _moveTaskToCompleted(task, options) {
    // Get all tasks for header update
    const tasksContent = await this._readTasksFile();
    const activeTasks = this.parser.parseTasks(tasksContent);
    const completedContent = await this._readCompletedFile();
    const completedTasks = this.parser.parseTasks(completedContent);
    const allTasks = [...activeTasks, ...completedTasks];

    // Remove from active tasks
    const updatedTasksContent = this.parser.removeTask(tasksContent, task.id, allTasks);
    await writeFile(this.config.tasksFile, updatedTasksContent, 'utf8');

    // Add to completed tasks
    const completedTask = {
      ...task,
      status: 'completed',
      completedAt: new Date().toISOString(),
      note: options.note,
      filesChanged: options.filesChanged || [],
    };

    const updatedCompletedContent = this.parser.addCompletedTask(completedContent, completedTask);
    await writeFile(this.config.completedFile, updatedCompletedContent, 'utf8');
  }

  _filterTasks(tasks, filters) {
    let filtered = tasks;

    if (filters.priority) {
      filtered = filtered.filter(t => t.priority === filters.priority);
    }

    if (filters.category) {
      filtered = filtered.filter(
        t => t.category && t.category.toLowerCase().includes(filters.category.toLowerCase())
      );
    }

    if (filters.status) {
      filtered = filtered.filter(t => t.status === filters.status);
    }

    return filtered;
  }
}
