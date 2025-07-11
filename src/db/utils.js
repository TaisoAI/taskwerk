import { copyFileSync, existsSync, unlinkSync } from 'fs';
import { dirname } from 'path';
import { mkdirSync } from 'fs';

export function backupDatabase(dbPath, backupPath) {
  if (!existsSync(dbPath)) {
    throw new Error(`Database file not found: ${dbPath}`);
  }

  const backupDir = dirname(backupPath);
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true });
  }

  copyFileSync(dbPath, backupPath);

  const walPath = `${dbPath}-wal`;
  const shmPath = `${dbPath}-shm`;

  if (existsSync(walPath)) {
    copyFileSync(walPath, `${backupPath}-wal`);
  }

  if (existsSync(shmPath)) {
    copyFileSync(shmPath, `${backupPath}-shm`);
  }

  return true;
}

export function deleteDatabase(dbPath) {
  const files = [dbPath, `${dbPath}-wal`, `${dbPath}-shm`];

  let deleted = false;
  for (const file of files) {
    if (existsSync(file)) {
      unlinkSync(file);
      deleted = true;
    }
  }

  return deleted;
}

export function vacuumDatabase(db) {
  db.pragma('wal_checkpoint(TRUNCATE)');
  db.exec('VACUUM');
  db.exec('ANALYZE');
}

export function getDatabaseInfo(db) {
  const pageSize = db.pragma('page_size', { simple: true });
  const pageCount = db.pragma('page_count', { simple: true });
  const walMode = db.pragma('journal_mode', { simple: true });
  const foreignKeys = db.pragma('foreign_keys', { simple: true });

  const sizeBytes = pageSize * pageCount;
  const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);

  const tables = db
    .prepare(
      `
    SELECT name, sql 
    FROM sqlite_master 
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `
    )
    .all();

  const tableInfo = {};
  for (const table of tables) {
    const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
    tableInfo[table.name] = count.count;
  }

  return {
    sizeBytes,
    sizeMB: parseFloat(sizeMB),
    pageSize,
    pageCount,
    walMode,
    foreignKeys: foreignKeys === 1,
    tables: tableInfo,
  };
}

export function exportToJSON(db) {
  const tables = db
    .prepare(
      `
    SELECT name 
    FROM sqlite_master 
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `
    )
    .all();

  const data = {};
  for (const table of tables) {
    data[table.name] = db.prepare(`SELECT * FROM ${table.name}`).all();
  }

  return data;
}

export function generateTaskId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `TASK-${timestamp}${random}`;
}
