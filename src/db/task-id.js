import { getDatabase } from './database.js';

/**
 * Generate the next task ID in TASK-001 format
 * @param {string} prefix - Optional prefix (default: 'TASK')
 * @param {object} db - Optional database instance (defaults to singleton)
 * @returns {Promise<string>} The next available task ID
 */
export async function generateTaskId(prefix = 'TASK', db = null) {
  const database = db || getDatabase();

  // Get the highest existing ID number
  const result = database
    .prepare(
      `
    SELECT MAX(CAST(SUBSTR(id, LENGTH(?) + 2) AS INTEGER)) as max_id
    FROM tasks
    WHERE id GLOB ? || '-[0-9]*'
  `
    )
    .get(prefix, prefix);

  const nextNumber = (result?.max_id || 0) + 1;

  // Format with leading zeros (minimum 3 digits, auto-extend for larger numbers)
  const paddedNumber = nextNumber.toString().padStart(3, '0');
  return `${prefix}-${paddedNumber}`;
}

/**
 * Check if a task ID already exists
 * @param {string} taskId - The task ID to check
 * @param {object} db - Optional database instance (defaults to singleton)
 * @returns {boolean} True if the ID exists
 */
export function taskIdExists(taskId, db = null) {
  const database = db || getDatabase();
  const result = database.prepare('SELECT 1 FROM tasks WHERE id = ?').get(taskId);
  return !!result;
}

/**
 * Validate task ID format (accepts both TASK-1 and TASK-001 formats)
 * @param {string} taskId - The task ID to validate
 * @returns {boolean} True if valid format
 */
export function isValidTaskId(taskId) {
  return /^[A-Z]+-\d+$/.test(taskId);
}

/**
 * Parse task ID into prefix and number
 * @param {string} taskId - The task ID to parse
 * @returns {{prefix: string, number: number} | null} Parsed components or null if invalid
 */
export function parseTaskId(taskId) {
  const match = taskId.match(/^([A-Z]+)-(\d+)$/);
  if (!match) {
    return null;
  }

  return {
    prefix: match[1],
    number: parseInt(match[2], 10),
  };
}

/**
 * Generate a subtask ID
 * @param {string} parentId - The parent task ID
 * @param {object} db - Optional database instance (defaults to singleton)
 * @returns {Promise<string>} The next available subtask ID
 */
export async function generateSubtaskId(parentId, db = null) {
  const database = db || getDatabase();

  // Get the highest existing subtask number
  const result = database
    .prepare(
      `
    SELECT MAX(CAST(SUBSTR(id, LENGTH(?) + 2) AS INTEGER)) as max_id
    FROM tasks
    WHERE parent_id = ? AND id GLOB ? || '.[0-9]*'
  `
    )
    .get(parentId, parentId, parentId);

  const nextNumber = (result?.max_id || 0) + 1;
  return `${parentId}.${nextNumber}`;
}
