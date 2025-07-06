/**
 * Migration Tests
 * 
 * @description Tests for database migration handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initializeStorage } from '../../src/storage/index.js';
import { DatabaseConnection } from '../../src/storage/database.js';
import { join } from 'path';
import { rmSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Storage Migration', () => {
  const testDir = join(__dirname, '../temp/test-migration');
  let storage;
  let consoleLogSpy;
  
  beforeEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    
    // Mock console.log
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  
  afterEach(() => {
    // Restore console.log
    consoleLogSpy.mockRestore();
    
    // Clean up
    if (storage?.close) {
      storage.close();
    }
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should log migration messages when migrations are needed', async () => {
    // First, create a database with an old schema version
    const dbConnection = new DatabaseConnection({ projectRoot: testDir });
    const db = dbConnection.connect();
    
    // Create minimal schema without using initializeSchema
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY,
        string_id TEXT
      );
    `);
    
    // Set schema version to 0 to force migration
    db.prepare('INSERT INTO schema_version (version) VALUES (0)').run();
    dbConnection.close();
    
    // Now initialize storage which should detect the need for migration
    storage = await initializeStorage({ projectRoot: testDir });
    
    // Check that migration messages were logged
    expect(consoleLogSpy).toHaveBeenCalledWith('Running database migrations...');
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Applied 0 migrations'));
  });
});