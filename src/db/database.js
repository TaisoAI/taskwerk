import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';
import { applySchema } from './schema.js';
import { MigrationRunner } from './migrations.js';

const DEFAULT_DB_DIR = '.taskwerk';
const DEFAULT_DB_FILE = 'taskwerk.db';
const GLOBAL_DB_DIR = join(homedir(), '.taskwerk');

export class TaskwerkDatabase {
  constructor(options = {}) {
    if (typeof options === 'string') {
      // Legacy: constructor(dbPath)
      this.dbPath = options;
      this.isGlobal = false;
    } else {
      const { dbPath, isGlobal = false } = options;
      this.isGlobal = isGlobal;
      this.dbPath = dbPath || this.getDefaultDbPath();
    }
    this.db = null;
  }

  getDefaultDbPath() {
    if (this.isGlobal) {
      if (!existsSync(GLOBAL_DB_DIR)) {
        mkdirSync(GLOBAL_DB_DIR, { recursive: true });
      }
      return join(GLOBAL_DB_DIR, DEFAULT_DB_FILE);
    } else {
      if (!existsSync(DEFAULT_DB_DIR)) {
        mkdirSync(DEFAULT_DB_DIR, { recursive: true });
      }
      return join(DEFAULT_DB_DIR, DEFAULT_DB_FILE);
    }
  }

  connect() {
    if (this.db) {
      return this.db;
    }

    const dir = dirname(this.dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    // Apply schema and migrations for all databases
    // Global databases get full schema, project databases just get migrations
    if (this.isGlobal) {
      applySchema(this.db);
    }

    // Always run migrations (they are idempotent)
    const migrationRunner = new MigrationRunner(this.db);
    try {
      migrationRunner.runPendingMigrations();
    } catch (error) {
      // Log but don't fail if migrations have issues
      console.warn('Warning: Some migrations failed:', error.message);
    }

    return this.db;
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  isConnected() {
    return this.db !== null && this.db.open;
  }

  getDB() {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db;
  }

  executeTransaction(fn) {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    const transaction = this.db.transaction(fn);
    return transaction();
  }

  prepare(sql) {
    if (!this.db) {
      throw new Error('Database not connected');
    }
    return this.db.prepare(sql);
  }

  exec(sql) {
    if (!this.db) {
      throw new Error('Database not connected');
    }
    return this.db.exec(sql);
  }
}

let defaultInstance = null;

export function getDatabase() {
  if (!defaultInstance) {
    defaultInstance = new TaskwerkDatabase();
  }
  return defaultInstance;
}

export function closeDatabase() {
  if (defaultInstance) {
    defaultInstance.close();
    defaultInstance = null;
  }
}

export function setDatabase(database) {
  if (defaultInstance) {
    defaultInstance.close();
  }
  defaultInstance = database;
}
