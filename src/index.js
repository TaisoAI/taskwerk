/**
 * Taskwerk v3 - Main Entry Point
 * 
 * @description Git-aware task management CLI for developers and AI agents
 * @module taskwerk
 */

export { TaskwerkAPI } from './core/api.js';
export { TaskStatus, Priority, NoteType } from './core/constants.js';

// Try to export version info
let VERSION = '0.0.0-dev';
let NAME = 'taskwerk';
let DESCRIPTION = 'A git-aware task management CLI for developers and AI agents working together';
let AUTHOR = 'unknown';
let LICENSE = 'MIT';

try {
  const versionModule = await import('./version.js');
  VERSION = versionModule.VERSION;
  NAME = versionModule.NAME;
  DESCRIPTION = versionModule.DESCRIPTION;
  AUTHOR = versionModule.AUTHOR;
  LICENSE = versionModule.LICENSE;
} catch (err) {
  // Silently use sentinel values
}

export { VERSION, NAME, DESCRIPTION, AUTHOR, LICENSE };

// Re-export for convenience
export default {
  name: NAME,
  version: VERSION,
  description: DESCRIPTION
};