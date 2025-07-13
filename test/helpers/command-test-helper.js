import { vi, expect } from 'vitest';
import { createTestDatabase } from './database-test-helper.js';
import { setDatabase, closeDatabase } from '../../src/db/database.js';
import { homedir } from 'os';
import { join } from 'path';

export function setupCommandTest(withDatabase = false) {
  const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
  
  let dbSetup = null;
  if (withDatabase) {
    dbSetup = createTestDatabase();
    // Set the test database as the global instance
    setDatabase(dbSetup.database);
  }

  return {
    consoleLogSpy,
    consoleErrorSpy,
    consoleWarnSpy,
    processExitSpy,
    dbSetup,
    cleanup: () => {
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
      processExitSpy.mockRestore();
      if (dbSetup) {
        closeDatabase();
        dbSetup.cleanup();
      }
    },
  };
}

export function expectNotImplemented(consoleLogSpy, processExitSpy, commandName, description) {
  expect(consoleLogSpy).toHaveBeenCalledWith(`Not implemented: ${commandName} - ${description}`);
  expect(processExitSpy).toHaveBeenCalledWith(0);
}
