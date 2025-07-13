import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';

const DEFAULT_DB_DIR = join(homedir(), '.taskwerk');
const DEFAULT_DB_FILE = 'taskwerk.db';

export class TaskwerkDatabase {
  constructor(dbPath = null) {
    this.dbPath = dbPath || this.getDefaultDbPath();
    this.db = null;
  }

  getDefaultDbPath() {
    if (!existsSync(DEFAULT_DB_DIR)) {
      mkdirSync(DEFAULT_DB_DIR, { recursive: true });
    }
    return join(DEFAULT_DB_DIR, DEFAULT_DB_FILE);
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
