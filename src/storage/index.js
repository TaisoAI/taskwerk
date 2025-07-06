/**
 * Storage Module
 * 
 * @description Main entry point for database storage
 * @module taskwerk/storage
 */

import { getDatabase } from './database.js';
import { initializeSchema } from './schema.js';
import { runMigrations, needsMigration } from './migrations.js';

export { DatabaseConnection, getDatabase } from './database.js';
export { SCHEMA_VERSION, getSchemaVersion } from './schema.js';
export { runMigrations, needsMigration } from './migrations.js';

/**
 * Initialize storage system
 * @param {Object} options - Storage options
 * @returns {Object} Storage interface
 */
export async function initializeStorage(options = {}) {
  const dbConnection = getDatabase(options);
  const db = dbConnection.connect();
  
  // Check if database needs initialization
  if (!dbConnection.isInitialized()) {
    console.log('Initializing database schema...');
    initializeSchema(db);
  }
  
  // Run any pending migrations
  if (needsMigration(db)) {
    console.log('Running database migrations...');
    const result = runMigrations(db);
    console.log(result.message);
  }
  
  return {
    db,
    connection: dbConnection,
    close: () => dbConnection.close()
  };
}

/**
 * Get next task ID in sequence
 * @param {Database} db - Database instance
 * @returns {string} Next task ID (e.g., "TASK-001")
 */
export function getNextTaskId(db) {
  const result = db.prepare(
    "SELECT string_id FROM tasks WHERE string_id LIKE 'TASK-%' ORDER BY id DESC LIMIT 1"
  ).get();
  
  if (!result) {
    return 'TASK-001';
  }
  
  const match = result.string_id.match(/TASK-(\d+)/);
  if (!match) {
    return 'TASK-001';
  }
  
  const nextNum = parseInt(match[1], 10) + 1;
  return `TASK-${String(nextNum).padStart(3, '0')}`;
}

export default initializeStorage;