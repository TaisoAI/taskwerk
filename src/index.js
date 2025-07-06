/**
 * Taskwerk v3 - Main Entry Point
 * 
 * @description Git-aware task management CLI for developers and AI agents
 * @version 0.3.11
 * @module taskwerk
 */

export { TaskwerkAPI } from './core/api.js';
export { TaskStatus, Priority } from './core/constants.js';

// Re-export for convenience
export default {
  name: 'taskwerk',
  version: '0.3.11',
  description: 'Git-aware task management CLI'
};