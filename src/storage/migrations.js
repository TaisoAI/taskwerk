/**
 * Database Migrations
 * 
 * @description Handles database schema migrations
 * @module taskwerk/storage/migrations
 */

import { SCHEMA_VERSION, getSchemaVersion } from './schema.js';

/**
 * Migration definition
 * @typedef {Object} Migration
 * @property {number} version - Target version
 * @property {string} description - Migration description
 * @property {function} up - Function to apply migration
 * @property {function} down - Function to rollback migration
 */

/**
 * Available migrations
 * Add new migrations here as the schema evolves
 */
export const MIGRATIONS = [
  // Example migration for future use:
  // {
  //   version: 2,
  //   description: 'Add project_id to tasks',
  //   up: (db) => {
  //     db.exec('ALTER TABLE tasks ADD COLUMN project_id INTEGER');
  //   },
  //   down: (db) => {
  //     // SQLite doesn't support DROP COLUMN, would need to recreate table
  //   }
  // }
];

/**
 * Run pending migrations
 * @param {Database} db - Database instance
 * @returns {Object} Migration result
 */
export function runMigrations(db) {
  const currentVersion = getSchemaVersion(db);
  const targetVersion = SCHEMA_VERSION;
  
  if (currentVersion === targetVersion) {
    return {
      success: true,
      message: 'Database is up to date',
      currentVersion,
      migrationsRun: 0
    };
  }
  
  if (currentVersion > targetVersion) {
    throw new Error(
      `Database version (${currentVersion}) is newer than code version (${targetVersion}). ` +
      'Please update Taskwerk to the latest version.'
    );
  }
  
  // Filter migrations to run
  const pendingMigrations = MIGRATIONS.filter(m => 
    m.version > currentVersion && m.version <= targetVersion
  ).sort((a, b) => a.version - b.version);
  
  let migrationsRun = 0;
  
  // Run migrations in transaction
  db.transaction(() => {
    for (const migration of pendingMigrations) {
      console.log(`Running migration ${migration.version}: ${migration.description}`);
      
      try {
        migration.up(db);
        
        // Record migration
        db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(migration.version);
        
        migrationsRun++;
      } catch (err) {
        throw new Error(`Migration ${migration.version} failed: ${err.message}`);
      }
    }
  })();
  
  return {
    success: true,
    message: `Applied ${migrationsRun} migrations`,
    currentVersion: targetVersion,
    migrationsRun
  };
}

/**
 * Check if migrations are needed
 * @param {Database} db - Database instance
 * @returns {boolean}
 */
export function needsMigration(db) {
  const currentVersion = getSchemaVersion(db);
  return currentVersion < SCHEMA_VERSION;
}