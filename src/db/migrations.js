import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class MigrationRunner {
  constructor(db) {
    this.db = db;
    this.migrationsPath = join(__dirname, 'migrations');
  }

  createMigrationsTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL UNIQUE,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  getAppliedMigrations() {
    const rows = this.db.prepare('SELECT filename FROM migrations ORDER BY id').all();
    return new Set(rows.map(row => row.filename));
  }

  getMigrationFiles() {
    if (!existsSync(this.migrationsPath)) {
      return [];
    }

    return readdirSync(this.migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort();
  }

  runMigration(filename) {
    const filepath = join(this.migrationsPath, filename);
    const sql = readFileSync(filepath, 'utf8');

    this.db.transaction(() => {
      this.db.exec(sql);
      this.db.prepare('INSERT INTO migrations (filename) VALUES (?)').run(filename);
    })();

    return true;
  }

  runPendingMigrations() {
    this.createMigrationsTable();

    const applied = this.getAppliedMigrations();
    const files = this.getMigrationFiles();
    const pending = files.filter(file => !applied.has(file));

    if (pending.length === 0) {
      return { count: 0, migrations: [] };
    }

    const results = [];
    for (const filename of pending) {
      try {
        this.runMigration(filename);
        results.push({ filename, status: 'success' });
      } catch (error) {
        results.push({ filename, status: 'error', error: error.message });
        throw error;
      }
    }

    return { count: results.length, migrations: results };
  }

  getMigrationStatus() {
    this.createMigrationsTable();

    const applied = this.getAppliedMigrations();
    const files = this.getMigrationFiles();

    return {
      applied: Array.from(applied),
      pending: files.filter(file => !applied.has(file)),
      total: files.length,
    };
  }
}
