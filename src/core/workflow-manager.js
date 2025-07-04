/**
 * TaskWerk v3 Workflow Manager
 *
 * Manages task workflow states, transitions, and validation
 */

import { TaskAPI } from '../api/task-api.js';
import { NotesAPI } from '../api/notes-api.js';
import { EventEmitter } from 'events';

/**
 * Valid workflow states
 */
export const WorkflowStates = {
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  PAUSED: 'paused',
  BLOCKED: 'blocked',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
};

/**
 * Valid state transitions
 */
const VALID_TRANSITIONS = {
  [WorkflowStates.TODO]: [WorkflowStates.IN_PROGRESS, WorkflowStates.ARCHIVED],
  [WorkflowStates.IN_PROGRESS]: [
    WorkflowStates.PAUSED,
    WorkflowStates.BLOCKED,
    WorkflowStates.COMPLETED,
    WorkflowStates.TODO,
  ],
  [WorkflowStates.PAUSED]: [WorkflowStates.IN_PROGRESS, WorkflowStates.TODO],
  [WorkflowStates.BLOCKED]: [WorkflowStates.IN_PROGRESS, WorkflowStates.TODO],
  [WorkflowStates.COMPLETED]: [WorkflowStates.ARCHIVED],
  [WorkflowStates.ARCHIVED]: [], // Terminal state
};

/**
 * Workflow transition reasons
 */
export const TransitionReasons = {
  START: 'task_started',
  PAUSE: 'task_paused',
  RESUME: 'task_resumed',
  COMPLETE: 'task_completed',
  BLOCK: 'task_blocked',
  UNBLOCK: 'task_unblocked',
  ARCHIVE: 'task_archived',
  REOPEN: 'task_reopened',
};

/**
 * Workflow manager for handling task state transitions
 */
export class WorkflowManager extends EventEmitter {
  constructor(databasePath) {
    super();
    this.taskApi = new TaskAPI(databasePath);
    this.notesApi = new NotesAPI(databasePath);
    this.activeTask = null;
    this.sessionStartTime = null;
    this.initialized = false;
  }

  /**
   * Initialize the workflow manager
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    await this.taskApi.initialize();
    await this.notesApi.initialize();

    // Load active task if any
    await this.loadActiveTask();

    this.initialized = true;
  }

  /**
   * Load the currently active task
   */
  async loadActiveTask() {
    try {
      const result = await this.taskApi.listTasks({
        status: WorkflowStates.IN_PROGRESS,
        limit: 1,
      });

      if (result.tasks && result.tasks.length > 0) {
        this.activeTask = result.tasks[0];
        this.emit('activeTaskLoaded', this.activeTask);
      }
    } catch (error) {
      // No active task
      this.activeTask = null;
    }
  }

  /**
   * Start working on a task
   */
  async startTask(taskId, options = {}) {
    const task = await this.taskApi.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Check if another task is already in progress
    if (this.activeTask && this.activeTask.id !== task.id) {
      if (options.force) {
        // Pause the current task
        await this.pauseTask(this.activeTask.id, {
          reason: 'Switching to another task',
          automatic: true,
        });
      } else {
        throw new Error(
          `Task ${this.activeTask.string_id} is already in progress. Use --force to switch tasks.`
        );
      }
    }

    // Validate transition
    if (!this.canTransition(task.status, WorkflowStates.IN_PROGRESS)) {
      throw new Error(`Cannot start task in ${task.status} state. Task must be in 'todo' state.`);
    }

    // Check dependencies
    if (options.validateDependencies !== false) {
      const blockers = await this.checkBlockingDependencies(task.id);
      if (blockers.length > 0) {
        throw new Error(
          `Task has unresolved dependencies: ${blockers.map(b => b.string_id).join(', ')}`
        );
      }
    }

    // Update task status
    const updatedTask = await this.taskApi.updateTask(task.id, {
      status: WorkflowStates.IN_PROGRESS,
      started_at: new Date().toISOString(),
    });

    // Add workflow note
    await this.notesApi.addNote(
      task.id,
      `Task started${options.reason ? ': ' + options.reason : ''}`,
      'system',
      {
        event: TransitionReasons.START,
        previous_status: task.status,
        new_status: WorkflowStates.IN_PROGRESS,
      }
    );

    // Update internal state
    this.activeTask = updatedTask;
    this.sessionStartTime = new Date();

    // Emit event
    this.emit('taskStarted', updatedTask, options);

    return updatedTask;
  }

  /**
   * Pause the current task
   */
  async pauseTask(taskId, options = {}) {
    const task = await this.taskApi.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Validate transition
    if (!this.canTransition(task.status, WorkflowStates.PAUSED)) {
      throw new Error(`Cannot pause task in ${task.status} state`);
    }

    // Calculate time spent
    const timeSpent = this.calculateTimeSpent();

    // Update task
    const updatedTask = await this.taskApi.updateTask(task.id, {
      status: WorkflowStates.PAUSED,
      paused_at: new Date().toISOString(),
    });

    // Add workflow note
    await this.notesApi.addNote(
      task.id,
      `Task paused${options.reason ? ': ' + options.reason : ''}`,
      'system',
      {
        event: TransitionReasons.PAUSE,
        previous_status: task.status,
        new_status: WorkflowStates.PAUSED,
        time_spent: timeSpent,
        automatic: options.automatic || false,
      }
    );

    // Update internal state
    if (this.activeTask?.id === task.id) {
      this.activeTask = null;
      this.sessionStartTime = null;
    }

    // Emit event
    this.emit('taskPaused', updatedTask, options);

    return updatedTask;
  }

  /**
   * Resume a paused task
   */
  async resumeTask(taskId, options = {}) {
    const task = await this.taskApi.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Validate task is paused
    if (task.status !== WorkflowStates.PAUSED) {
      throw new Error(`Task is not paused (current status: ${task.status})`);
    }

    // Check if another task is active
    if (this.activeTask && this.activeTask.id !== task.id) {
      if (options.force) {
        await this.pauseTask(this.activeTask.id, {
          reason: 'Switching to another task',
          automatic: true,
        });
      } else {
        throw new Error(
          `Task ${this.activeTask.string_id} is already in progress. Use --force to switch tasks.`
        );
      }
    }

    // Update task status
    const updatedTask = await this.taskApi.updateTask(task.id, {
      status: WorkflowStates.IN_PROGRESS,
      resumed_at: new Date().toISOString(),
    });

    // Add workflow note
    await this.notesApi.addNote(
      task.id,
      `Task resumed${options.reason ? ': ' + options.reason : ''}`,
      'system',
      {
        event: TransitionReasons.RESUME,
        previous_status: task.status,
        new_status: WorkflowStates.IN_PROGRESS,
      }
    );

    // Update internal state
    this.activeTask = updatedTask;
    this.sessionStartTime = new Date();

    // Emit event
    this.emit('taskResumed', updatedTask, options);

    return updatedTask;
  }

  /**
   * Complete a task
   */
  async completeTask(taskId, options = {}) {
    const task = await this.taskApi.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Validate transition
    if (!this.canTransition(task.status, WorkflowStates.COMPLETED)) {
      throw new Error(`Cannot complete task in ${task.status} state. Task must be in progress.`);
    }

    // Validate completion requirements
    if (options.validateRequirements !== false) {
      await this.validateCompletionRequirements(task, options);
    }

    // Calculate final metrics
    const timeSpent = this.calculateTimeSpent();
    const completionData = {
      status: WorkflowStates.COMPLETED,
      completed_at: new Date().toISOString(),
      progress: 100,
    };

    // Add actual time if tracking
    if (task.estimated && timeSpent) {
      completionData.actual_hours = Math.round(timeSpent / 60) / 60; // Convert to hours
    }

    // Update task
    const updatedTask = await this.taskApi.updateTask(task.id, completionData);

    // Add completion note
    await this.notesApi.addNote(
      task.id,
      `Task completed${options.note ? ': ' + options.note : ''}`,
      'system',
      {
        event: TransitionReasons.COMPLETE,
        previous_status: task.status,
        new_status: WorkflowStates.COMPLETED,
        time_spent: timeSpent,
        completion_details: options.details || {},
      }
    );

    // Update internal state
    if (this.activeTask?.id === task.id) {
      this.activeTask = null;
      this.sessionStartTime = null;
    }

    // Emit event
    this.emit('taskCompleted', updatedTask, options);

    return updatedTask;
  }

  /**
   * Block a task
   */
  async blockTask(taskId, options = {}) {
    if (!options.reason) {
      throw new Error('Block reason is required');
    }

    const task = await this.taskApi.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Validate transition
    if (!this.canTransition(task.status, WorkflowStates.BLOCKED)) {
      throw new Error(`Cannot block task in ${task.status} state`);
    }

    // Update task
    const updatedTask = await this.taskApi.updateTask(task.id, {
      status: WorkflowStates.BLOCKED,
      blocked_at: new Date().toISOString(),
      blocked_by: options.blockedBy || null,
    });

    // Add block note
    await this.notesApi.addNote(task.id, `Task blocked: ${options.reason}`, 'system', {
      event: TransitionReasons.BLOCK,
      previous_status: task.status,
      new_status: WorkflowStates.BLOCKED,
      block_reason: options.reason,
      blocked_by_task: options.blockedBy,
    });

    // Update internal state
    if (this.activeTask?.id === task.id) {
      this.activeTask = null;
      this.sessionStartTime = null;
    }

    // Emit event
    this.emit('taskBlocked', updatedTask, options);

    return updatedTask;
  }

  /**
   * Unblock a task
   */
  async unblockTask(taskId, options = {}) {
    const task = await this.taskApi.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Validate task is blocked
    if (task.status !== WorkflowStates.BLOCKED) {
      throw new Error(`Task is not blocked (current status: ${task.status})`);
    }

    // Determine target status
    const targetStatus = options.resume ? WorkflowStates.IN_PROGRESS : WorkflowStates.TODO;

    // Update task
    const updatedTask = await this.taskApi.updateTask(task.id, {
      status: targetStatus,
      unblocked_at: new Date().toISOString(),
      blocked_by: null,
    });

    // Add unblock note
    await this.notesApi.addNote(
      task.id,
      `Task unblocked${options.reason ? ': ' + options.reason : ''}`,
      'system',
      {
        event: TransitionReasons.UNBLOCK,
        previous_status: task.status,
        new_status: targetStatus,
        unblock_reason: options.reason,
      }
    );

    // Update internal state if resuming
    if (options.resume) {
      this.activeTask = updatedTask;
      this.sessionStartTime = new Date();
    }

    // Emit event
    this.emit('taskUnblocked', updatedTask, options);

    return updatedTask;
  }

  /**
   * Check if a state transition is valid
   */
  canTransition(fromState, toState) {
    const validTransitions = VALID_TRANSITIONS[fromState] || [];
    return validTransitions.includes(toState);
  }

  /**
   * Get valid transitions for a state
   */
  getValidTransitions(state) {
    return VALID_TRANSITIONS[state] || [];
  }

  /**
   * Check for blocking dependencies
   */
  async checkBlockingDependencies(taskId) {
    // Get task dependencies
    const task = await this.taskApi.getTask(taskId);
    if (!task || !task.dependencies || task.dependencies.length === 0) {
      return [];
    }

    // Check each dependency
    const blockers = [];
    for (const dep of task.dependencies) {
      const depTask = await this.taskApi.getTask(dep.depends_on_id);
      if (depTask && depTask.status !== WorkflowStates.COMPLETED) {
        blockers.push(depTask);
      }
    }

    return blockers;
  }

  /**
   * Validate completion requirements
   */
  async validateCompletionRequirements(task, options) {
    const errors = [];

    // Check if estimates are required
    if (options.requireEstimates && !task.estimated) {
      errors.push('Task must have an estimate before completion');
    }

    // Check if all subtasks are completed
    const subtasks = await this.taskApi.listTasks({
      parent_id: task.id,
      status: WorkflowStates.TODO,
      limit: 1,
    });

    if (subtasks.tasks && subtasks.tasks.length > 0) {
      errors.push('All subtasks must be completed first');
    }

    // Check custom validation rules
    if (options.customValidation) {
      const customErrors = await options.customValidation(task);
      errors.push(...customErrors);
    }

    if (errors.length > 0) {
      throw new Error(`Completion validation failed:\n${errors.join('\n')}`);
    }
  }

  /**
   * Calculate time spent in current session
   */
  calculateTimeSpent() {
    if (!this.sessionStartTime) {
      return 0;
    }

    const now = new Date();
    const minutes = Math.round((now - this.sessionStartTime) / 60000);
    return minutes;
  }

  /**
   * Get workflow statistics
   */
  async getWorkflowStats() {
    const stats = {
      byStatus: {},
      transitions: [],
      activeTask: this.activeTask,
      sessionTime: this.calculateTimeSpent(),
    };

    // Count tasks by status
    for (const status of Object.values(WorkflowStates)) {
      const result = await this.taskApi.listTasks({ status, limit: 1000 });
      stats.byStatus[status] = result.total || 0;
    }

    // Get recent transitions
    // This would query workflow events/notes in a real implementation

    return stats;
  }

  /**
   * Close resources
   */
  close() {
    this.taskApi.close();
    this.notesApi.close();
    this.removeAllListeners();
  }
}
