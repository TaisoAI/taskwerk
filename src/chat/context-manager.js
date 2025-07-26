import { Logger } from '../logging/logger.js';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Manages chat contexts for both project and global scopes
 */
export class ContextManager {
  constructor(db, config = {}) {
    this.db = db;
    this.logger = new Logger('context-manager');
    this.config = {
      autoCreateGeneral: true,
      continuationWindow: 3600 * 1000, // 1 hour in milliseconds
      verbose: false,
      ...config,
    };
  }

  /**
   * Detect if we're in a project directory
   * @returns {Promise<{isProject: boolean, projectId: string|null}>}
   */
  async detectProject() {
    // Check for .taskwerk directory in current directory
    const taskwerkDir = join(process.cwd(), '.taskwerk');
    if (existsSync(taskwerkDir)) {
      // Extract project name from path
      const projectPath = process.cwd();
      const projectName = projectPath.split('/').pop() || 'unnamed';
      return { isProject: true, projectId: projectName };
    }
    return { isProject: false, projectId: null };
  }

  /**
   * Get or create appropriate context based on location and options
   * @param {string} type - 'ask' or 'agent'
   * @param {Object} options - { contextName, forceNew, firstPrompt }
   * @returns {Promise<Object>} Context object
   */
  async getOrCreateContext(type, options = {}) {
    const { contextName, forceNew = false, firstPrompt = '' } = options;

    // Detect project
    const { isProject, projectId } = await this.detectProject();

    if (contextName) {
      // Explicit context requested
      return this.getOrCreateNamedContext(contextName, type, firstPrompt);
    }

    if (isProject) {
      // In a project - use project context
      return this.getOrCreateProjectContext(projectId, type, forceNew, firstPrompt);
    } else {
      // Not in a project - use global general context
      return this.getOrCreateGlobalContext(type, forceNew, firstPrompt);
    }
  }

  /**
   * Get or create project-specific context
   */
  async getOrCreateProjectContext(projectId, type, forceNew, firstPrompt) {
    if (!forceNew) {
      // Try to find recent active context
      const recent = await this.findRecentContext(projectId, type);
      if (recent) {
        this.logger.debug('Continuing existing project context', { id: recent.id });
        return recent;
      }
    }

    // Create new project context
    const id = await this.generateContextId();
    const name = this.generateContextName(firstPrompt || 'conversation');

    const context = {
      id,
      name,
      project_id: projectId,
      type,
      first_prompt: firstPrompt,
      scope: 'project',
      display: `[Project: ${projectId}]`,
      turn_count: 0,
    };

    await this.createContext(context);
    if (this.config.verbose) {
      this.logger.info('Created new project context', { id, name, projectId });
    }

    return context;
  }

  /**
   * Get or create global context
   */
  async getOrCreateGlobalContext(type, forceNew, firstPrompt) {
    if (!forceNew) {
      // Use default 'general' context for the specific type
      const general = await this.findContextByNameAndType('general', 'GLOBAL', type);
      if (general) {
        this.logger.debug('Using general global context', { type });
        return general;
      }
    }

    // Create general context if it doesn't exist
    const id = await this.generateContextId();
    const name = forceNew ? this.generateContextName(firstPrompt) : 'general';

    const context = {
      id,
      name,
      project_id: 'GLOBAL',
      type,
      first_prompt: firstPrompt || 'General conversation',
      scope: 'global',
      display: `[Global: ${name}]`,
      turn_count: 0,
    };

    await this.createContext(context);
    if (this.config.verbose) {
      this.logger.info('Created new global context', { id, name });
    }

    return context;
  }

  /**
   * Get or create named global context
   */
  async getOrCreateNamedContext(name, type, firstPrompt) {
    // Check if it exists for this type
    const existing = await this.findContextByNameAndType(name, 'GLOBAL', type);
    if (existing) {
      this.logger.debug('Using existing named context', { name, type });
      return existing;
    }

    // Create new named context
    const id = await this.generateContextId();

    const context = {
      id,
      name,
      project_id: 'GLOBAL',
      type,
      first_prompt: firstPrompt || `Named context: ${name}`,
      scope: 'global',
      display: `[Global: ${name}]`,
      turn_count: 0,
    };

    await this.createContext(context);
    if (this.config.verbose) {
      this.logger.info('Created new named global context', { id, name });
    }

    return context;
  }

  /**
   * Find recent active context within continuation window
   */
  async findRecentContext(projectId, type) {
    const cutoff = new Date(Date.now() - this.config.continuationWindow).toISOString();

    const stmt = this.db.prepare(`
      SELECT *, 
        CASE WHEN project_id = 'GLOBAL' THEN 'global' ELSE 'project' END as scope,
        CASE 
          WHEN project_id = 'GLOBAL' THEN '[Global: ' || name || ']'
          ELSE '[Project: ' || project_id || ']'
        END as display,
        turn_count
      FROM chat_contexts
      WHERE project_id = ? 
        AND type = ?
        AND status = 'active'
        AND datetime(last_active) > datetime(?)
      ORDER BY last_active DESC
      LIMIT 1
    `);

    const result = stmt.get(projectId, type, cutoff);
    if (result) {
      this.logger.debug('Found recent context', { id: result.id, projectId, type });
    } else {
      this.logger.debug('No recent context found', { projectId, type, cutoff });
    }
    return result;
  }

  /**
   * Find context by name
   */
  async findContextByName(name, projectId) {
    const stmt = this.db.prepare(`
      SELECT *,
        CASE WHEN project_id = 'GLOBAL' THEN 'global' ELSE 'project' END as scope,
        CASE 
          WHEN project_id = 'GLOBAL' THEN '[Global: ' || name || ']'
          ELSE '[Project: ' || project_id || ']'
        END as display,
        turn_count
      FROM chat_contexts
      WHERE name = ? AND project_id = ?
    `);

    return stmt.get(name, projectId);
  }

  /**
   * Find context by name and type
   */
  async findContextByNameAndType(name, projectId, type) {
    const stmt = this.db.prepare(`
      SELECT *,
        CASE WHEN project_id = 'GLOBAL' THEN 'global' ELSE 'project' END as scope,
        CASE 
          WHEN project_id = 'GLOBAL' THEN '[Global: ' || name || ']'
          ELSE '[Project: ' || project_id || ']'
        END as display,
        turn_count
      FROM chat_contexts
      WHERE name = ? AND project_id = ? AND type = ?
    `);

    return stmt.get(name, projectId, type);
  }

  /**
   * Create a new context
   */
  async createContext(context) {
    const stmt = this.db.prepare(`
      INSERT INTO chat_contexts (id, name, project_id, type, first_prompt, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `);

    stmt.run(context.id, context.name, context.project_id, context.type, context.first_prompt);

    return context;
  }

  /**
   * Generate unique context ID
   */
  async generateContextId() {
    // Find the highest existing CHAT-XXX id
    const result = this.db
      .prepare(
        `
      SELECT MAX(CAST(SUBSTR(id, 6) AS INTEGER)) as max_id 
      FROM chat_contexts 
      WHERE id GLOB 'CHAT-[0-9]*'
    `
      )
      .get();

    const nextId = (result?.max_id || 0) + 1;
    return `CHAT-${String(nextId).padStart(3, '0')}`;
  }

  /**
   * Generate context name from prompt
   */
  generateContextName(prompt) {
    // Take first 3-4 meaningful words, kebab-case
    const words = prompt
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .split(/\s+/)
      .filter(
        w => !['the', 'a', 'an', 'and', 'or', 'i', 'we', 'to', 'for', 'how', 'do'].includes(w)
      )
      .slice(0, 4);

    return words.join('-') || 'conversation';
  }

  /**
   * Add a turn to the context
   */
  async addTurn(contextId, role, content, metadata = {}) {
    // Get current turn count
    const context = this.db
      .prepare('SELECT turn_count FROM chat_contexts WHERE id = ?')
      .get(contextId);
    if (!context) {
      throw new Error(`Context not found: ${contextId}`);
    }

    const turnNumber = context.turn_count + 1;

    const stmt = this.db.prepare(`
      INSERT INTO chat_turns (
        context_id, turn_number, role, content, created_task_ids, tool_calls
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      contextId,
      turnNumber,
      role,
      content,
      metadata.createdTaskIds ? JSON.stringify(metadata.createdTaskIds) : null,
      metadata.toolCalls ? JSON.stringify(metadata.toolCalls) : null
    );

    this.logger.debug('Added turn to context', { contextId, turnNumber, role });
  }

  /**
   * Get conversation history for a context
   */
  async getHistory(contextId, limit = 50) {
    const stmt = this.db.prepare(`
      SELECT * FROM chat_turns
      WHERE context_id = ?
      ORDER BY turn_number DESC
      LIMIT ?
    `);

    const turns = stmt.all(contextId, limit).reverse();

    // Parse JSON fields
    return turns.map(turn => ({
      ...turn,
      created_task_ids: turn.created_task_ids ? JSON.parse(turn.created_task_ids) : [],
      tool_calls: turn.tool_calls ? JSON.parse(turn.tool_calls) : [],
    }));
  }

  /**
   * List contexts (project or global)
   */
  async listContexts(options = {}) {
    const { projectId, global = false, all = false } = options;

    let query = `
      SELECT *,
        CASE WHEN project_id = 'GLOBAL' THEN 'global' ELSE 'project' END as scope
      FROM chat_contexts
    `;

    const params = [];
    const conditions = [];

    if (all) {
      // Show everything
    } else if (global) {
      conditions.push('project_id = ?');
      params.push('GLOBAL');
    } else if (projectId) {
      conditions.push('project_id = ?');
      params.push(projectId);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY last_active DESC';

    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }

  /**
   * Rename a context
   */
  async renameContext(contextId, newName) {
    const stmt = this.db.prepare('UPDATE chat_contexts SET name = ? WHERE id = ?');
    const result = stmt.run(newName, contextId);

    if (result.changes === 0) {
      throw new Error(`Context not found: ${contextId}`);
    }

    if (this.config.verbose) {
      this.logger.info('Renamed context', { contextId, newName });
    }
  }

  /**
   * Clean up old contexts
   */
  async cleanupContexts(daysOld = 90) {
    const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();

    // Find contexts to delete
    const toDelete = this.db
      .prepare(
        `
      SELECT id, name, project_id, last_active 
      FROM chat_contexts 
      WHERE last_active < ?
    `
      )
      .all(cutoff);

    if (toDelete.length === 0) {
      return { count: 0, contexts: [] };
    }

    // Delete them
    const stmt = this.db.prepare('DELETE FROM chat_contexts WHERE id = ?');
    const deleteMany = this.db.transaction(contexts => {
      for (const context of contexts) {
        stmt.run(context.id);
      }
    });

    deleteMany(toDelete);

    if (this.config.verbose) {
      this.logger.info('Cleaned up old contexts', { count: toDelete.length });
    }
    return { count: toDelete.length, contexts: toDelete };
  }

  /**
   * Get context details with stats
   */
  async getContextDetails(contextId) {
    const context = this.db
      .prepare(
        `
      SELECT *,
        CASE WHEN project_id = 'GLOBAL' THEN 'global' ELSE 'project' END as scope,
        CASE 
          WHEN project_id = 'GLOBAL' THEN '[Global: ' || name || ']'
          ELSE '[Project: ' || project_id || ']'
        END as display
      FROM chat_contexts
      WHERE id = ?
    `
      )
      .get(contextId);

    if (!context) {
      return null;
    }

    // Get task count
    const taskCount = this.db
      .prepare(
        `
      SELECT COUNT(*) as count 
      FROM tasks 
      WHERE context_id = ?
    `
      )
      .get(contextId);

    // Get recent turns
    const recentTurns = await this.getHistory(contextId, 5);

    return {
      ...context,
      task_count: taskCount.count,
      recent_turns: recentTurns,
    };
  }

  /**
   * Get a context by ID
   */
  async getContext(contextId) {
    return this.db
      .prepare(
        `
      SELECT *,
        CASE WHEN project_id = 'GLOBAL' THEN 'global' ELSE 'project' END as scope
      FROM chat_contexts
      WHERE id = ?
    `
      )
      .get(contextId);
  }

  /**
   * Delete a context and all its turns
   */
  async deleteContext(contextId) {
    const deleteContext = this.db.transaction(() => {
      // Delete turns first
      this.db.prepare('DELETE FROM chat_turns WHERE context_id = ?').run(contextId);

      // Delete context
      this.db.prepare('DELETE FROM chat_contexts WHERE id = ?').run(contextId);
    });

    deleteContext();
  }

  /**
   * Get current context (for display purposes)
   */
  async getCurrentContext() {
    // This is a placeholder - in reality, we'd need to track the current context
    // For now, return null
    return null;
  }
}
