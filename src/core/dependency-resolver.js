/**
 * TaskWerk v3 Dependency Resolution Engine
 *
 * Analyzes task dependencies and provides resolution strategies
 */

import { TaskAPI } from '../api/task-api.js';
import { RelationshipAPI } from '../api/relationship-api.js';

/**
 * Dependency types
 */
export const DependencyTypes = {
  BLOCKS: 'blocks', // This task blocks another
  DEPENDS_ON: 'depends_on', // This task depends on another
  RELATED_TO: 'related_to', // Related but not blocking
  PARENT_OF: 'parent_of', // Parent-child relationship
  CHILD_OF: 'child_of', // Child-parent relationship
};

/**
 * Dependency status for resolution
 */
export const DependencyStatus = {
  READY: 'ready', // All dependencies satisfied
  BLOCKED: 'blocked', // Has unresolved dependencies
  PARTIAL: 'partial', // Some dependencies resolved
  CIRCULAR: 'circular', // Circular dependency detected
};

/**
 * Dependency resolver for task management
 */
export class DependencyResolver {
  constructor(databasePath) {
    this.taskApi = new TaskAPI(databasePath);
    this.relationshipApi = new RelationshipAPI(databasePath);
    this.initialized = false;
    this.cache = new Map();
  }

  /**
   * Initialize the resolver
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    await this.taskApi.initialize();
    await this.relationshipApi.initialize();
    this.initialized = true;
  }

  /**
   * Get tasks ready to start (no blockers)
   */
  async getReadyTasks(options = {}) {
    await this.initialize();

    // Get all tasks that are not completed or archived
    const allTasks = await this.taskApi.listTasks({
      status: ['todo', 'paused'],
      limit: 1000,
    });

    const readyTasks = [];

    // Check each task for blockers
    for (const task of allTasks.tasks) {
      const status = await this.getTaskDependencyStatus(task.id);

      if (status === DependencyStatus.READY) {
        // Calculate priority score
        const score = await this.calculatePriorityScore(task);
        readyTasks.push({
          ...task,
          dependencyStatus: status,
          priorityScore: score,
        });
      }
    }

    // Sort by priority score
    readyTasks.sort((a, b) => b.priorityScore - a.priorityScore);

    // Apply filters
    if (options.category) {
      return readyTasks.filter(t => t.category === options.category);
    }

    if (options.assignee) {
      return readyTasks.filter(t => t.assignee === options.assignee);
    }

    if (options.limit) {
      return readyTasks.slice(0, options.limit);
    }

    return readyTasks;
  }

  /**
   * Get task dependency status
   */
  async getTaskDependencyStatus(taskId) {
    // Check cache first
    const cached = this.cache.get(`status:${taskId}`);
    if (cached && Date.now() - cached.time < 60000) {
      return cached.status;
    }

    const dependencies = await this.taskApi.getDependencies(taskId);

    if (!dependencies || dependencies.length === 0) {
      this.cache.set(`status:${taskId}`, {
        status: DependencyStatus.READY,
        time: Date.now(),
      });
      return DependencyStatus.READY;
    }

    // Check for circular dependencies
    if (await this.hasCircularDependency(taskId)) {
      return DependencyStatus.CIRCULAR;
    }

    // Check each dependency
    let hasBlockers = false;
    let hasResolved = false;

    for (const dep of dependencies) {
      const depTask = await this.taskApi.getTask(dep.depends_on_id);
      if (!depTask) {
        continue;
      }

      if (depTask.status === 'completed' || depTask.status === 'archived') {
        hasResolved = true;
      } else {
        hasBlockers = true;
      }
    }

    let status;
    if (!hasBlockers) {
      status = DependencyStatus.READY;
    } else if (hasResolved) {
      status = DependencyStatus.PARTIAL;
    } else {
      status = DependencyStatus.BLOCKED;
    }

    this.cache.set(`status:${taskId}`, { status, time: Date.now() });
    return status;
  }

  /**
   * Build dependency tree for a task
   */
  async buildDependencyTree(taskId, options = {}) {
    const visited = new Set();
    const maxDepth = options.maxDepth || 10;

    const buildNode = async (id, depth = 0) => {
      if (visited.has(id) || depth > maxDepth) {
        return null;
      }

      visited.add(id);

      const task = await this.taskApi.getTask(id);
      if (!task) {
        return null;
      }

      const node = {
        id: task.id,
        stringId: task.string_id,
        name: task.name,
        status: task.status,
        priority: task.priority,
        estimated: task.estimated,
        progress: task.progress,
        assignee: task.assignee,
        depth,
        dependencies: [],
        dependents: [],
        subtasks: [],
      };

      // Get dependencies (tasks this depends on)
      if (options.includeDependencies !== false) {
        const deps = await this.taskApi.getDependencies(id);
        for (const dep of deps || []) {
          const childNode = await buildNode(dep.depends_on_id, depth + 1);
          if (childNode) {
            node.dependencies.push(childNode);
          }
        }
      }

      // Get dependents (tasks that depend on this)
      if (options.includeDependents) {
        const dependents = await this.taskApi.listTasks({
          dependsOn: id,
          limit: 100,
        });
        for (const dep of dependents.tasks || []) {
          const childNode = await buildNode(dep.id, depth + 1);
          if (childNode) {
            node.dependents.push(childNode);
          }
        }
      }

      // Get subtasks
      if (options.includeSubtasks) {
        const subtasks = await this.taskApi.listTasks({
          parent_id: id,
          limit: 100,
        });
        for (const subtask of subtasks.tasks || []) {
          const childNode = await buildNode(subtask.id, depth + 1);
          if (childNode) {
            node.subtasks.push(childNode);
          }
        }
      }

      return node;
    };

    return await buildNode(taskId);
  }

  /**
   * Calculate critical path for a set of tasks
   */
  async calculateCriticalPath(rootTaskId) {
    const tree = await this.buildDependencyTree(rootTaskId, {
      includeDependencies: true,
      includeDependents: false,
      includeSubtasks: false,
    });

    if (!tree) {
      return { path: [], duration: 0 };
    }

    // Build adjacency list
    const graph = new Map();
    const tasks = new Map();

    const collectTasks = node => {
      tasks.set(node.id, node);
      graph.set(
        node.id,
        node.dependencies.map(d => d.id)
      );
      node.dependencies.forEach(collectTasks);
    };

    collectTasks(tree);

    // Topological sort
    const sorted = this.topologicalSort(graph);
    if (!sorted) {
      throw new Error('Circular dependency detected');
    }

    // Calculate earliest start times
    const earliestStart = new Map();
    const earliestFinish = new Map();

    for (const taskId of sorted) {
      const task = tasks.get(taskId);
      const duration = task.estimated || 1; // Default 1 hour if no estimate

      const deps = graph.get(taskId) || [];
      const start = deps.length === 0 ? 0 : Math.max(...deps.map(d => earliestFinish.get(d) || 0));

      earliestStart.set(taskId, start);
      earliestFinish.set(taskId, start + duration);
    }

    // Calculate latest start times (backward pass)
    const latestStart = new Map();
    const latestFinish = new Map();
    const totalDuration = earliestFinish.get(rootTaskId) || 0;

    sorted.reverse();

    for (const taskId of sorted) {
      const task = tasks.get(taskId);
      const duration = task.estimated || 1;

      // Find tasks that depend on this one
      const dependents = [];
      for (const [id, deps] of graph.entries()) {
        if (deps.includes(taskId)) {
          dependents.push(id);
        }
      }

      const finish =
        dependents.length === 0
          ? totalDuration
          : Math.min(...dependents.map(d => latestStart.get(d) || totalDuration));

      latestFinish.set(taskId, finish);
      latestStart.set(taskId, finish - duration);
    }

    // Find critical path (tasks where earliest start = latest start)
    const criticalPath = [];
    for (const [taskId, task] of tasks.entries()) {
      const slack = (latestStart.get(taskId) || 0) - (earliestStart.get(taskId) || 0);
      if (Math.abs(slack) < 0.001) {
        // Float comparison
        criticalPath.push({
          ...task,
          earliestStart: earliestStart.get(taskId),
          latestStart: latestStart.get(taskId),
          duration: task.estimated || 1,
          slack: 0,
        });
      }
    }

    // Sort critical path by start time
    criticalPath.sort((a, b) => a.earliestStart - b.earliestStart);

    return {
      path: criticalPath,
      duration: totalDuration,
      allTasks: Array.from(tasks.values()).map(task => ({
        ...task,
        earliestStart: earliestStart.get(task.id),
        latestStart: latestStart.get(task.id),
        slack: (latestStart.get(task.id) || 0) - (earliestStart.get(task.id) || 0),
      })),
    };
  }

  /**
   * Analyze dependency impact
   */
  async analyzeDependencyImpact(taskId) {
    const impact = {
      directDependents: [],
      totalDependents: 0,
      criticalPathImpact: false,
      estimatedDelay: 0,
      affectedAssignees: new Set(),
      riskLevel: 'low', // low, medium, high
    };

    // Get direct dependents
    const directDeps = await this.taskApi.listTasks({
      dependsOn: taskId,
      limit: 1000,
    });

    impact.directDependents = directDeps.tasks || [];

    // Build full dependency graph to find all affected tasks
    const allAffected = new Set();
    const toProcess = [...impact.directDependents.map(t => t.id)];

    while (toProcess.length > 0) {
      const current = toProcess.shift();
      if (allAffected.has(current)) {
        continue;
      }

      allAffected.add(current);

      const deps = await this.taskApi.listTasks({
        dependsOn: current,
        limit: 100,
      });

      toProcess.push(...(deps.tasks || []).map(t => t.id));
    }

    impact.totalDependents = allAffected.size;

    // Check each affected task
    for (const depId of allAffected) {
      const task = await this.taskApi.getTask(depId);
      if (!task) {
        continue;
      }

      // Collect affected assignees
      if (task.assignee) {
        impact.affectedAssignees.add(task.assignee);
      }

      // Check if task is on critical path
      if (task.priority === 'high' || task.is_milestone) {
        impact.criticalPathImpact = true;
      }

      // Add to estimated delay
      if (task.estimated) {
        impact.estimatedDelay += task.estimated;
      }
    }

    // Calculate risk level
    if (impact.totalDependents > 10 || impact.criticalPathImpact) {
      impact.riskLevel = 'high';
    } else if (impact.totalDependents > 5 || impact.affectedAssignees.size > 3) {
      impact.riskLevel = 'medium';
    }

    impact.affectedAssignees = Array.from(impact.affectedAssignees);

    return impact;
  }

  /**
   * Check for circular dependencies
   */
  async hasCircularDependency(taskId, visited = new Set(), stack = new Set()) {
    if (stack.has(taskId)) {
      return true; // Circular dependency found
    }

    if (visited.has(taskId)) {
      return false; // Already checked this path
    }

    visited.add(taskId);
    stack.add(taskId);

    const dependencies = await this.taskApi.getDependencies(taskId);

    for (const dep of dependencies || []) {
      if (await this.hasCircularDependency(dep.depends_on_id, visited, stack)) {
        return true;
      }
    }

    stack.delete(taskId);
    return false;
  }

  /**
   * Find circular dependency path
   */
  async findCircularPath(taskId) {
    const visited = new Set();

    const findPath = async (id, currentPath = []) => {
      if (currentPath.includes(id)) {
        // Found circular dependency
        const startIdx = currentPath.indexOf(id);
        return currentPath.slice(startIdx).concat(id);
      }

      if (visited.has(id)) {
        return null;
      }

      visited.add(id);
      currentPath.push(id);

      const dependencies = await this.taskApi.getDependencies(id);

      for (const dep of dependencies || []) {
        const result = await findPath(dep.depends_on_id, [...currentPath]);
        if (result) {
          return result;
        }
      }

      return null;
    };

    const circularPath = await findPath(taskId);

    if (circularPath) {
      // Convert IDs to task info
      const tasks = [];
      for (const id of circularPath) {
        const task = await this.taskApi.getTask(id);
        if (task) {
          tasks.push({
            id: task.id,
            stringId: task.string_id,
            name: task.name,
          });
        }
      }
      return tasks;
    }

    return null;
  }

  /**
   * Topological sort for dependency graph
   */
  topologicalSort(graph) {
    const visited = new Set();
    const result = [];
    const tempMark = new Set();

    const visit = node => {
      if (tempMark.has(node)) {
        return false; // Circular dependency
      }

      if (!visited.has(node)) {
        tempMark.add(node);

        const neighbors = graph.get(node) || [];
        for (const neighbor of neighbors) {
          if (!visit(neighbor)) {
            return false;
          }
        }

        tempMark.delete(node);
        visited.add(node);
        result.push(node);
      }

      return true;
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        if (!visit(node)) {
          return null; // Circular dependency found
        }
      }
    }

    return result;
  }

  /**
   * Calculate priority score for a task
   */
  async calculatePriorityScore(task) {
    let score = 0;

    // Base priority score
    switch (task.priority) {
      case 'high':
        score += 100;
        break;
      case 'medium':
        score += 50;
        break;
      case 'low':
        score += 10;
        break;
    }

    // Age factor (older tasks get higher priority)
    const age = Math.floor(
      (Date.now() - new Date(task.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    score += Math.min(age * 2, 50); // Max 50 points for age

    // Milestone bonus
    if (task.is_milestone) {
      score += 50;
    }

    // Dependent tasks factor
    const dependents = await this.taskApi.listTasks({
      dependsOn: task.id,
      limit: 100,
    });
    score += (dependents.total || 0) * 10; // 10 points per dependent

    // Due date factor
    if (task.due_date) {
      const daysUntilDue = Math.floor(
        (new Date(task.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntilDue < 0) {
        score += 200; // Overdue
      } else if (daysUntilDue < 7) {
        score += 100; // Due soon
      } else if (daysUntilDue < 30) {
        score += 50; // Due this month
      }
    }

    return score;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Close resources
   */
  close() {
    this.taskApi.close();
    this.relationshipApi.close();
    this.cache.clear();
  }
}
