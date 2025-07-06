/**
 * Taskwerk Constants
 * 
 * @description Central location for all constants used throughout the application
 * @module taskwerk/core/constants
 */

/**
 * Task status values
 * @readonly
 * @enum {string}
 */
export const TaskStatus = {
  TODO: 'todo',           // Not started
  ACTIVE: 'active',       // Currently being worked on
  PAUSED: 'paused',       // Temporarily stopped
  BLOCKED: 'blocked',     // Cannot proceed
  COMPLETED: 'completed', // Finished successfully
  ARCHIVED: 'archived'    // Hidden from normal views
};

/**
 * Task priority values
 * @readonly
 * @enum {string}
 */
export const Priority = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

/**
 * Note types for task notes
 * @readonly
 * @enum {string}
 */
export const NoteType = {
  COMMENT: 'comment',     // General note
  PLAN: 'plan',          // Implementation plan
  UPDATE: 'update',      // Status update
  BLOCK: 'block',        // Blocking reason
  COMPLETE: 'complete'   // Completion summary
};

/**
 * Change types for history tracking
 * @readonly
 * @enum {string}
 */
export const ChangeType = {
  CREATE: 'create',
  UPDATE: 'update',
  STATUS_CHANGE: 'status_change',
  NOTE_ADDED: 'note_added'
};

/**
 * Default values
 * @readonly
 */
export const DEFAULTS = {
  PRIORITY: Priority.MEDIUM,
  STATUS: TaskStatus.TODO,
  PROGRESS: 0,
  TASKWERK_DIR: '.taskwerk',
  DB_FILENAME: 'taskwerk.db',
  RULES_FILENAME: 'taskwerk_rules.md'
};

/**
 * Valid state transitions
 * @readonly
 */
export const STATE_TRANSITIONS = {
  [TaskStatus.TODO]: [TaskStatus.ACTIVE, TaskStatus.BLOCKED, TaskStatus.COMPLETED, TaskStatus.ARCHIVED],
  [TaskStatus.ACTIVE]: [TaskStatus.PAUSED, TaskStatus.BLOCKED, TaskStatus.COMPLETED],
  [TaskStatus.PAUSED]: [TaskStatus.ACTIVE, TaskStatus.BLOCKED, TaskStatus.COMPLETED],
  [TaskStatus.BLOCKED]: [TaskStatus.TODO, TaskStatus.ACTIVE, TaskStatus.COMPLETED],
  [TaskStatus.COMPLETED]: [TaskStatus.ARCHIVED],
  [TaskStatus.ARCHIVED]: [] // Terminal state
};