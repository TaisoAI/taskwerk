import { readFile, writeFile } from 'fs/promises';
import { YamlTaskParser } from './yaml-task-parser.js';
import { TaskParser } from './task-parser.js';
import { TaskSchema } from './task-schema.js';
import { MigrationUtil } from './migration-util.js';
import { SessionManager } from './session-manager.js';
import { generateTaskId } from '../utils/id-generator.js';

/**
 * TaskWerk v2.0 Enhanced Task Manager
 *
 * Supports both v1 and v2 formats with graceful migration,
 * enhanced task schema, timeline management, subtasks, and dependencies.
 */
export class V2TaskManager {
  constructor(config) {
    this.config = config;
    this.v1Parser = new TaskParser();
    this.v2Parser = new YamlTaskParser();
    this.v2Parser.setV1Parser(this.v1Parser);
    this.migrationUtil = new MigrationUtil();
    this.sessionManager = new SessionManager(config);
  }

  /**
   * Add a new task with v2 schema support
   */
  async addTask({
    description,
    priority = 'medium',
    category,
    assignee,
    estimated,
    dependencies = [],
  }) {
    const tasksFile = this.config.tasksFile;
    const content = await this._readTasksFile();

    // Parse existing tasks (handles both v1 and v2 formats)
    const tasks = this.v2Parser.parseTasks(content);

    // Get completed tasks to avoid ID conflicts
    const completedContent = await this._readCompletedFile();
    const completedTasks = this.v2Parser.parseTasks(completedContent);

    // Combine for ID generation
    const allTasks = [...tasks, ...completedTasks];
    const taskId = generateTaskId(allTasks);

    // Create v2 task with enhanced schema
    const task = TaskSchema.createV2Task({
      id: taskId,
      description,
      priority,
      category,
      assignee,
      estimated,
      dependencies,
      status: 'todo',
    });

    // Validate the task before saving
    const validation = TaskSchema.validateV2Task(task);
    if (!validation.valid) {
      throw new Error(`Task validation failed: ${validation.errors.join(', ')}`);
    }

    // Add timeline entry for creation
    task.timeline.push({
      timestamp: new Date().toISOString(),
      action: 'created',
      user: assignee || 'system',
    });

    // Auto-migrate content to v2 if needed
    const migratedContent = await this._ensureV2Format(content);

    // Add task to content
    const updatedContent = this._addV2TaskToContent(migratedContent, task);
    await writeFile(tasksFile, updatedContent, 'utf8');

    return task;
  }

  /**
   * Get tasks with enhanced filtering for v2 features
   */
  async getTasks(filters = {}) {
    // Handle completed/archived tasks
    if (filters.completed || filters.archived || filters.allClosed) {
      const content = await this._readCompletedFile();
      const tasks = this.v2Parser.parseTasks(content);

      if (filters.archived) {
        return this._filterTasks(
          tasks.filter(t => t.status === 'archived'),
          filters
        );
      } else if (filters.completed) {
        return this._filterTasks(
          tasks.filter(t => t.status === 'completed'),
          filters
        );
      } else if (filters.allClosed) {
        return this._filterTasks(
          tasks.filter(t => t.status === 'completed' || t.status === 'archived'),
          filters
        );
      }
    }

    // Get active tasks
    const content = await this._readTasksFile();
    const tasks = this.v2Parser.parseTasks(content);

    // Filter out completed and archived tasks for default "active" view
    const activeTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'archived');

    return this._filterTasks(activeTasks, filters);
  }

  /**
   * Get a single task by ID
   */
  async getTask(taskId) {
    // Try active tasks first
    try {
      const activeTasks = await this.getTasks();
      const task = activeTasks.find(t => t.id === taskId);
      if (task) {
        return task;
      }
    } catch (error) {
      // Continue to search completed tasks
    }

    // Try completed/archived tasks
    const completedTasks = await this.getTasks({ allClosed: true });
    const task = completedTasks.find(t => t.id === taskId);

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    return task;
  }

  /**
   * Start a task with enhanced timeline tracking
   */
  async startTask(taskId, options = {}) {
    const task = await this.getTask(taskId);

    if (task.status === 'in_progress') {
      throw new Error(`Task ${taskId} is already in progress`);
    }

    if (task.status === 'completed' || task.status === 'archived') {
      throw new Error(`Cannot start ${task.status} task ${taskId}`);
    }

    // Check dependencies
    if (task.dependencies && task.dependencies.length > 0) {
      await this._validateDependencies(task.dependencies);
    }

    // Update task with timeline
    const updatedTask = await this._updateTaskWithTimeline(taskId, 'in_progress', {
      action: 'started',
      user: options.user || 'system',
      note: options.note,
    });

    await this.sessionManager.startTask(taskId);

    return updatedTask;
  }

  /**
   * Complete a task with enhanced completion tracking
   */
  async completeTask(taskId, options = {}) {
    const task = await this.getTask(taskId);
    const session = await this.sessionManager.getCurrentSession();

    // Enhanced completion options
    const completionOptions = {
      ...options,
      filesChanged: session.filesModified || [],
      user: options.user || 'system',
    };

    // Update subtasks completion if this is a parent task
    if (task.subtasks && task.subtasks.length > 0) {
      await this._completeAllSubtasks(task);
    }

    await this._moveTaskToCompleted(task, completionOptions);
    await this.sessionManager.completeTask(taskId);

    return task;
  }

  /**
   * Pause a task with timeline tracking
   */
  async pauseTask(taskId, options = {}) {
    await this.getTask(taskId); // Validate task exists

    const updatedTask = await this._updateTaskWithTimeline(taskId, 'todo', {
      action: 'paused',
      user: options.user || 'system',
      note: options.note,
    });

    await this.sessionManager.pauseTask(taskId);

    return updatedTask;
  }

  /**
   * Block a task with reason tracking
   */
  async blockTask(taskId, options = {}) {
    await this.getTask(taskId); // Validate task exists

    if (!options.reason) {
      throw new Error('Block reason is required');
    }

    const updatedTask = await this._updateTaskWithTimeline(taskId, 'blocked', {
      action: 'blocked',
      user: options.user || 'system',
      note: options.reason,
    });

    return updatedTask;
  }

  /**
   * Unblock a task
   */
  async unblockTask(taskId, options = {}) {
    const task = await this.getTask(taskId);

    if (task.status !== 'blocked') {
      throw new Error(`Task ${taskId} is not blocked`);
    }

    const updatedTask = await this._updateTaskWithTimeline(taskId, 'todo', {
      action: 'unblocked',
      user: options.user || 'system',
      note: options.note,
    });

    return updatedTask;
  }

  /**
   * Archive a task (enhanced from v1)
   */
  async archiveTask(taskId, options = {}) {
    const task = await this.getTask(taskId);
    const session = await this.sessionManager.getCurrentSession();

    if (!options.reason) {
      throw new Error('Archive reason is required');
    }

    const archiveOptions = {
      ...options,
      filesChanged: session.filesModified || [],
      user: options.user || 'system',
    };

    await this._moveTaskToArchived(task, archiveOptions);
    await this.sessionManager.completeTask(taskId);

    return task;
  }

  /**
   * Add a subtask to an existing task
   */
  async addSubtask(parentTaskId, subtaskData) {
    const parentTask = await this.getTask(parentTaskId);

    // Generate subtask ID
    const subtaskCount = parentTask.subtasks ? parentTask.subtasks.length : 0;
    const subtaskId = `${parentTaskId}.${subtaskCount + 1}`;

    const subtask = {
      id: subtaskId,
      description: subtaskData.description,
      status: 'todo',
      assignee: subtaskData.assignee || parentTask.assignee,
    };

    // Update parent task
    if (!parentTask.subtasks) {
      parentTask.subtasks = [];
    }
    parentTask.subtasks.push(subtask);

    await this._updateTaskContent(parentTask);

    return subtask;
  }

  /**
   * Update subtask status
   */
  async updateSubtask(parentTaskId, subtaskId, updates) {
    const parentTask = await this.getTask(parentTaskId);

    if (!parentTask.subtasks) {
      throw new Error(`Task ${parentTaskId} has no subtasks`);
    }

    const subtask = parentTask.subtasks.find(st => st.id === subtaskId);
    if (!subtask) {
      throw new Error(`Subtask ${subtaskId} not found`);
    }

    Object.assign(subtask, updates);
    await this._updateTaskContent(parentTask);

    return subtask;
  }

  /**
   * Add dependency to a task
   */
  async addDependency(taskId, dependencyTaskId) {
    const task = await this.getTask(taskId);

    // Validate dependency exists
    try {
      await this.getTask(dependencyTaskId);
    } catch (error) {
      throw new Error(`Dependency ${dependencyTaskId} not found`);
    }

    // Check for circular dependencies
    await this._checkCircularDependency(taskId, dependencyTaskId);

    if (!task.dependencies) {
      task.dependencies = [];
    }

    if (!task.dependencies.includes(dependencyTaskId)) {
      task.dependencies.push(dependencyTaskId);
      await this._updateTaskContent(task);
    }

    return task;
  }

  /**
   * Remove dependency from a task
   */
  async removeDependency(taskId, dependencyTaskId) {
    const task = await this.getTask(taskId);

    if (task.dependencies) {
      task.dependencies = task.dependencies.filter(dep => dep !== dependencyTaskId);
      await this._updateTaskContent(task);
    }

    return task;
  }

  /**
   * Get tasks that are ready to work on (no blocking dependencies)
   */
  async getReadyTasks() {
    const tasks = await this.getTasks({ status: 'todo' });
    const readyTasks = [];

    for (const task of tasks) {
      if (!task.dependencies || task.dependencies.length === 0) {
        readyTasks.push(task);
      } else {
        const dependenciesCompleted = await this._areAllDependenciesCompleted(task.dependencies);
        if (dependenciesCompleted) {
          readyTasks.push(task);
        }
      }
    }

    return readyTasks;
  }

  /**
   * Get dependency tree for a task
   */
  async getDependencyTree(taskId) {
    const task = await this.getTask(taskId);
    const tree = { task, dependencies: [] };

    if (task.dependencies && task.dependencies.length > 0) {
      for (const depId of task.dependencies) {
        try {
          const depTree = await this.getDependencyTree(depId);
          tree.dependencies.push(depTree);
        } catch (error) {
          // Dependency not found - mark as missing
          tree.dependencies.push({
            task: { id: depId, description: 'MISSING DEPENDENCY', status: 'missing' },
            dependencies: [],
          });
        }
      }
    }

    return tree;
  }

  /**
   * Enhanced search with v2 fields
   */
  async searchTasks(query) {
    const tasks = await this.getTasks();
    const lowercaseQuery = query.toLowerCase();

    return tasks.filter(task => {
      return (
        task.description.toLowerCase().includes(lowercaseQuery) ||
        (task.category && task.category.toLowerCase().includes(lowercaseQuery)) ||
        (task.assignee && task.assignee.toLowerCase().includes(lowercaseQuery)) ||
        (task.markdownContent && task.markdownContent.toLowerCase().includes(lowercaseQuery)) ||
        (task.note && task.note.toLowerCase().includes(lowercaseQuery))
      );
    });
  }

  /**
   * Enhanced stats with v2 metrics
   */
  async getStats() {
    const tasks = await this.getTasks();
    const completedTasks = await this.getTasks({ allClosed: true });
    const completedOnly = completedTasks.filter(t => t.status === 'completed');
    const archivedOnly = completedTasks.filter(t => t.status === 'archived');

    // Calculate completion rate including archived tasks
    const totalTasks = tasks.length + completedTasks.length;
    const completionRate =
      totalTasks > 0
        ? Math.round(((completedOnly.length + archivedOnly.length) / totalTasks) * 100)
        : 0;

    return {
      total: tasks.length,
      todo: tasks.filter(t => t.status === 'todo').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      blocked: tasks.filter(t => t.status === 'blocked').length,
      completed: completedOnly.length,
      archived: archivedOnly.length,
      completionRate,
      priorities: {
        high: tasks.filter(t => t.priority === 'high').length,
        medium: tasks.filter(t => t.priority === 'medium').length,
        low: tasks.filter(t => t.priority === 'low').length,
      },
      categories: this._getCategoryStats(tasks),
      assignees: this._getAssigneeStats(tasks),
      withDependencies: tasks.filter(t => t.dependencies && t.dependencies.length > 0).length,
      withSubtasks: tasks.filter(t => t.subtasks && t.subtasks.length > 0).length,
    };
  }

  /**
   * Get recently completed tasks (enhanced)
   */
  async getRecentlyCompleted(limit = 10) {
    const tasks = await this.getTasks({ allClosed: true });

    return tasks
      .filter(t => t.completedAt || t.archivedAt)
      .sort((a, b) => {
        const aDate = new Date(a.completedAt || a.archivedAt);
        const bDate = new Date(b.completedAt || b.archivedAt);
        return bDate - aDate;
      })
      .slice(0, limit);
  }

  // Session management (inherited from v1)
  async getCurrentSession() {
    return this.sessionManager.getCurrentSession();
  }

  async updateSession(updates) {
    return this.sessionManager.updateSession(updates);
  }

  async getTaskContext(taskId) {
    const session = await this.getCurrentSession();
    const task = await this.getTask(taskId);
    const dependencyTree = await this.getDependencyTree(taskId);

    return {
      task,
      session,
      dependencyTree,
      relatedFiles: session.filesModified || [],
      branch: session.branch,
      baseBranch: session.baseBranch,
    };
  }

  // Private helper methods

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

  async _ensureV2Format(content) {
    if (this.migrationUtil.needsMigration(content)) {
      const migrationResult = this.migrationUtil.migrateContent(content);
      return migrationResult.content;
    }
    return content;
  }

  _addV2TaskToContent(content, task) {
    const taskBlock = this.v2Parser.formatV2Task(task);

    // If content is already v2 format, append the new task
    if (this.v2Parser.hasYamlFrontmatter(content)) {
      return content + '\n\n' + taskBlock;
    }

    // Otherwise, start fresh v2 content
    return `<!-- TaskWerk v2.0 Format -->\n\n${taskBlock}`;
  }

  async _updateTaskWithTimeline(taskId, newStatus, timelineEntry) {
    const task = await this.getTask(taskId);

    // Update status
    task.status = newStatus;
    task.updated = new Date();

    // Add timeline entry
    const entry = {
      timestamp: new Date().toISOString(),
      action: timelineEntry.action,
      user: timelineEntry.user,
    };

    if (timelineEntry.note) {
      entry.note = timelineEntry.note;
    }

    if (!task.timeline) {
      task.timeline = [];
    }
    task.timeline.push(entry);

    await this._updateTaskContent(task);

    return task;
  }

  async _updateTaskContent(task) {
    const content = await this._readTasksFile();
    const tasks = this.v2Parser.parseTasks(content);

    // Find and replace the task
    const taskIndex = tasks.findIndex(t => t.id === task.id);
    if (taskIndex === -1) {
      throw new Error(`Task ${task.id} not found for update`);
    }

    tasks[taskIndex] = task;

    // Rebuild content
    const newContent = tasks.map(t => this.v2Parser.formatV2Task(t)).join('\n\n');

    await writeFile(
      this.config.tasksFile,
      `<!-- TaskWerk v2.0 Format -->\n\n${newContent}`,
      'utf8'
    );
  }

  async _moveTaskToCompleted(task, options) {
    // Remove from active tasks and add to completed
    await this._removeTaskFromActive(task.id);

    const completedTask = TaskSchema.createV2Task({
      ...task,
      status: 'completed',
      completedAt: new Date(),
      note: options.note,
      filesChanged: options.filesChanged || [],
    });

    // Add timeline entry
    completedTask.timeline.push({
      timestamp: new Date().toISOString(),
      action: 'completed',
      user: options.user || 'system',
    });

    await this._addToCompletedFile(completedTask);
  }

  async _moveTaskToArchived(task, options) {
    // Remove from active tasks and add to completed as archived
    await this._removeTaskFromActive(task.id);

    const archivedTask = TaskSchema.createV2Task({
      ...task,
      status: 'archived',
      archivedAt: new Date(),
      archiveReason: options.reason,
      supersededBy: options.supersededBy,
      note: options.note,
      filesChanged: options.filesChanged || [],
    });

    // Add timeline entry
    archivedTask.timeline.push({
      timestamp: new Date().toISOString(),
      action: 'archived',
      user: options.user || 'system',
      note: options.reason,
    });

    await this._addToCompletedFile(archivedTask);
  }

  async _removeTaskFromActive(taskId) {
    const content = await this._readTasksFile();
    const tasks = this.v2Parser.parseTasks(content);

    const filteredTasks = tasks.filter(t => t.id !== taskId);

    if (filteredTasks.length === tasks.length) {
      throw new Error(`Task ${taskId} not found in active tasks`);
    }

    const newContent =
      filteredTasks.length > 0
        ? `<!-- TaskWerk v2.0 Format -->\n\n${filteredTasks.map(t => this.v2Parser.formatV2Task(t)).join('\n\n')}`
        : '<!-- TaskWerk v2.0 Format -->\n\n';

    await writeFile(this.config.tasksFile, newContent, 'utf8');
  }

  async _addToCompletedFile(task) {
    const content = await this._readCompletedFile();
    const taskBlock = this.v2Parser.formatV2Task(task);

    // Ensure v2 format for completed file
    const migratedContent = await this._ensureV2Format(content);
    const newContent = migratedContent.trim()
      ? `${migratedContent}\n\n${taskBlock}`
      : `<!-- TaskWerk v2.0 Completed Tasks -->\n\n${taskBlock}`;

    await writeFile(this.config.completedFile, newContent, 'utf8');
  }

  async _validateDependencies(dependencies) {
    for (const depId of dependencies) {
      try {
        const depTask = await this.getTask(depId);
        if (depTask.status !== 'completed') {
          throw new Error(`Dependency ${depId} is not completed (status: ${depTask.status})`);
        }
      } catch (error) {
        if (error.message.includes('not found')) {
          throw new Error(`Dependency ${depId} not found`);
        }
        throw error; // Re-throw if it's the status validation error
      }
    }
  }

  async _areAllDependenciesCompleted(dependencies) {
    try {
      await this._validateDependencies(dependencies);
      return true;
    } catch (error) {
      return false;
    }
  }

  async _checkCircularDependency(taskId, dependencyTaskId) {
    // Direct circular dependency
    if (taskId === dependencyTaskId) {
      throw new Error(`Circular dependency detected: ${taskId} -> ${dependencyTaskId}`);
    }

    // Check if the dependency task eventually depends on the current task
    // This would create a circular dependency if we add taskId -> dependencyTaskId
    const visited = new Set();

    const hasPathTo = async (fromId, toId) => {
      if (fromId === toId) {
        return true;
      }

      if (visited.has(fromId)) {
        return false; // Already checked this path
      }

      visited.add(fromId);

      try {
        const task = await this.getTask(fromId);
        if (task.dependencies && task.dependencies.length > 0) {
          for (const depId of task.dependencies) {
            if (await hasPathTo(depId, toId)) {
              return true;
            }
          }
        }
      } catch (error) {
        // Dependency not found - ignore for circular check
      }

      return false;
    };

    // Check if dependencyTaskId has a path back to taskId
    const wouldCreateCycle = await hasPathTo(dependencyTaskId, taskId);
    if (wouldCreateCycle) {
      throw new Error(`Circular dependency detected: ${taskId} -> ${dependencyTaskId}`);
    }
  }

  async _completeAllSubtasks(parentTask) {
    if (parentTask.subtasks) {
      parentTask.subtasks.forEach(subtask => {
        if (subtask.status !== 'completed') {
          subtask.status = 'completed';
        }
      });
      await this._updateTaskContent(parentTask);
    }
  }

  _getCategoryStats(tasks) {
    const categories = {};
    tasks.forEach(task => {
      if (task.category) {
        categories[task.category] = (categories[task.category] || 0) + 1;
      }
    });
    return categories;
  }

  _getAssigneeStats(tasks) {
    const assignees = {};
    tasks.forEach(task => {
      if (task.assignee) {
        assignees[task.assignee] = (assignees[task.assignee] || 0) + 1;
      }
    });
    return assignees;
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

    if (filters.assignee) {
      filtered = filtered.filter(
        t => t.assignee && t.assignee.toLowerCase().includes(filters.assignee.toLowerCase())
      );
    }

    if (filters.hasSubtasks) {
      filtered = filtered.filter(t => t.subtasks && t.subtasks.length > 0);
    }

    if (filters.hasDependencies) {
      filtered = filtered.filter(t => t.dependencies && t.dependencies.length > 0);
    }

    return filtered;
  }
}
