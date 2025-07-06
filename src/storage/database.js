/**
 * Database Connection Module
 * 
 * @description Manages SQLite database connection and initialization
 * @module taskwerk/storage/database
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { DEFAULTS } from '../core/constants.js';

/**
 * Database connection manager
 */
export class DatabaseConnection {
  constructor(options = {}) {
    this.options = {
      projectRoot: process.cwd(),
      dbFilename: DEFAULTS.DB_FILENAME,
      ...options
    };
    
    this.db = null;
    this.dbPath = null;
  }

  /**
   * Initialize database connection
   * @returns {Database} Database instance
   */
  connect() {
    if (this.db) return this.db;

    // Ensure .taskwerk directory exists
    const taskwerkDir = join(this.options.projectRoot, DEFAULTS.TASKWERK_DIR);
    if (!existsSync(taskwerkDir)) {
      mkdirSync(taskwerkDir, { recursive: true });
    }

    // Set up database path
    this.dbPath = join(taskwerkDir, this.options.dbFilename);
    
    // Create or open database
    this.db = new Database(this.dbPath);
    
    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');
    
    // Set journal mode for better concurrency
    this.db.pragma('journal_mode = WAL');
    
    return this.db;
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Check if database is initialized
   * @returns {boolean}
   */
  isInitialized() {
    if (!this.db) this.connect();
    
    try {
      const result = this.db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'"
      ).get();
      return !!result;
    } catch (err) {
      return false;
    }
  }

  /**
   * Get database instance
   * @returns {Database}
   */
  getInstance() {
    if (!this.db) this.connect();
    return this.db;
  }
}

// Singleton instance
let instance = null;

/**
 * Get or create database connection
 * @param {Object} options - Connection options
 * @returns {DatabaseConnection}
 */
export function getDatabase(options) {
  if (!instance) {
    instance = new DatabaseConnection(options);
  }
  return instance;
}

export default DatabaseConnection;