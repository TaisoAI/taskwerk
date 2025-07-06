/**
 * API Utilities
 * 
 * @description Helper functions for API initialization
 * @module taskwerk/cli/utils/api
 */

import { TaskwerkAPI } from '../../core/api.js';
import { initializeStorage } from '../../storage/index.js';

/**
 * Get initialized API instance
 * @returns {Promise<TaskwerkAPI>} API instance
 */
export async function getAPI() {
  const storage = await initializeStorage();
  return new TaskwerkAPI({ database: storage.db });
}