import { getDatabase } from '../db/database.js';

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Distance between strings
 */
function levenshteinDistance(a, b) {
  const matrix = [];

  // If one string is empty, return length of the other
  if (a.length === 0) {
    return b.length;
  }
  if (b.length === 0) {
    return a.length;
  }

  // Initialize the matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Find task IDs that are similar to the input
 * @param {string} input - User input task ID
 * @param {number} maxDistance - Maximum Levenshtein distance for suggestions
 * @param {Object} database - Optional database instance for testing
 * @returns {Array} Array of similar task IDs with their distances
 */
export function findSimilarTaskIds(input, maxDistance = 3, database = null) {
  const db = database || getDatabase();

  // Handle both raw SQLite connections and TaskwerkDatabase instances
  let sqliteDb;
  if (db && typeof db.isConnected === 'function') {
    // It's a TaskwerkDatabase instance
    if (!db.isConnected()) {
      db.connect();
    }
    sqliteDb = db.db;
  } else {
    // It's already a raw SQLite connection
    sqliteDb = db;
  }

  // Normalize input to uppercase for comparison
  const normalizedInput = input.toUpperCase();

  // Get all task IDs
  const stmt = sqliteDb.prepare('SELECT id FROM tasks ORDER BY id');
  const tasks = stmt.all();

  const suggestions = [];

  for (const task of tasks) {
    const taskIdUpper = task.id.toUpperCase();

    // Check for exact match (case-insensitive)
    if (taskIdUpper === normalizedInput) {
      return [{ id: task.id, distance: 0 }];
    }

    // Check for partial matches
    if (taskIdUpper.includes(normalizedInput) || normalizedInput.includes(taskIdUpper)) {
      suggestions.push({
        id: task.id,
        distance: 0.5, // Partial matches get priority
      });
      continue;
    }

    // Calculate Levenshtein distance
    const distance = levenshteinDistance(normalizedInput, taskIdUpper);

    if (distance <= maxDistance) {
      suggestions.push({
        id: task.id,
        distance: distance,
      });
    }
  }

  // Sort by distance, then by ID
  suggestions.sort((a, b) => {
    if (a.distance !== b.distance) {
      return a.distance - b.distance;
    }
    return a.id.localeCompare(b.id);
  });

  return suggestions;
}

/**
 * Try to match a fuzzy task ID input
 * @param {string} input - User input task ID
 * @param {Object} database - Optional database instance for testing
 * @returns {string|null} Matched task ID or null
 */
export function fuzzyMatchTaskId(input, database = null) {
  if (!input) {
    return null;
  }

  const db = database || getDatabase();

  // Handle both raw SQLite connections and TaskwerkDatabase instances
  let sqliteDb;
  if (db && typeof db.isConnected === 'function') {
    // It's a TaskwerkDatabase instance
    if (!db.isConnected()) {
      db.connect();
    }
    sqliteDb = db.db;
  } else {
    // It's already a raw SQLite connection
    sqliteDb = db;
  }

  // First try exact match (case-insensitive)
  const exactStmt = sqliteDb.prepare('SELECT id FROM tasks WHERE UPPER(id) = UPPER(?)');
  const exactMatch = exactStmt.get(input);
  if (exactMatch) {
    return exactMatch.id;
  }

  // Try to handle common variations
  const normalizedInput = input.toUpperCase();

  // Handle missing leading zeros (TASK-1 -> TASK-001)
  if (normalizedInput.match(/^[A-Z]+-\d+$/)) {
    const [prefix, number] = normalizedInput.split('-');
    const paddedNumber = number.padStart(3, '0');
    const paddedId = `${prefix}-${paddedNumber}`;

    const paddedMatch = exactStmt.get(paddedId);
    if (paddedMatch) {
      return paddedMatch.id;
    }
  }

  // Handle subtask variations (TASK-1.1 -> TASK-001.1)
  if (normalizedInput.match(/^[A-Z]+-\d+\.\d+$/)) {
    const [mainPart, subPart] = normalizedInput.split('.');
    const [prefix, number] = mainPart.split('-');
    const paddedNumber = number.padStart(3, '0');
    const paddedId = `${prefix}-${paddedNumber}.${subPart}`;

    const paddedMatch = exactStmt.get(paddedId);
    if (paddedMatch) {
      return paddedMatch.id;
    }
  }

  // Try partial prefix match (just the number part)
  if (normalizedInput.match(/^\d+$/)) {
    const number = normalizedInput.padStart(3, '0');
    // Prioritize TASK- prefix for number-only matches
    const taskStmt = sqliteDb.prepare('SELECT id FROM tasks WHERE id = ?');
    const taskMatch = taskStmt.get(`TASK-${number}`);
    if (taskMatch) {
      return taskMatch.id;
    }

    // If no TASK- match, try any prefix
    const partialStmt = sqliteDb.prepare('SELECT id FROM tasks WHERE id LIKE ? ORDER BY id');
    const partialMatch = partialStmt.get(`%-${number}`);
    if (partialMatch) {
      return partialMatch.id;
    }
  }

  return null;
}

/**
 * Format task not found error with suggestions
 * @param {string} taskId - The task ID that was not found
 * @param {Object} database - Optional database instance for testing
 * @returns {string} Formatted error message with suggestions
 */
export function formatTaskNotFoundError(taskId, database = null) {
  const suggestions = findSimilarTaskIds(taskId, 2, database);

  let message = `Task ${taskId} not found`;

  if (suggestions.length > 0) {
    message += '\n\nDid you mean:';
    suggestions.slice(0, 3).forEach(suggestion => {
      message += `\n  • ${suggestion.id}`;
    });
  }

  return message;
}
